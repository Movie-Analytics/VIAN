<template>
  <div class="position-relative w-100">
    <teleport defer to="#timelineAxesContainer">
      <canvas ref="timeCanvas" class="float-right" />
    </teleport>

    <canvas ref="canvas" height="0"></canvas>

    <v-overlay
      v-model="overlayInput"
      scrim="false"
      @keydown.esc="overlayInput = false"
      @click:outside="overlayInput = false"
    >
      <v-card
        :class="{
          'cursor-grabbing': isDragging
        }"
        class="overlay-card position-absolute"
        elevation="10"
        :style="{
          left: overlayPosX + 'px',
          top: overlayPosY + 'px'
        }"
      >
        <v-card-title class="align-center cursor-move d-flex pa-2" @mousedown="startDrag">
          <span class="text-subtitle-1">{{ $t('components.timelineCanvas.annotations') }}</span>

          <v-spacer></v-spacer>

          <v-btn
            icon="mdi-close"
            variant="text"
            density="compact"
            @click="overlayInput = false"
          ></v-btn>
        </v-card-title>

        <v-card-text class="pa-2">
          <v-textarea
            ref="overlayTextfield"
            v-model="overlayInputModel"
            rows="5"
            hide-details="true"
            variant="outlined"
            density="comfortable"
            class="annotation-textarea"
            @keydown.enter.exact.prevent="overlayInputChange"
          ></v-textarea>
        </v-card-text>

        <v-card-actions class="pa-2">
          <v-spacer></v-spacer>

          <v-btn color="warning" @click="overlayInput = false">
            {{ $t('common.cancel') }}
          </v-btn>

          <v-btn color="primary" @click="overlayInputChange">
            {{ $t('common.save') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-overlay>

    <canvas ref="hiddenCanvas" height="0" class="d-none"></canvas>

    <div class="position-fixed" :style="{ left: contextMenuX + 'px', top: contextMenuY + 'px' }">
      <v-menu v-model="contextMenuVisible" activator="parent">
        <v-list density="compact" class="pb-0 pt-0">
          <v-list-item :title="contextMenuAnnotateLabel" @click="contextMenuAnnotate" />

          <template v-if="contextMenuEntry && contextMenuEntry.type === 'shot'">
            <v-list-item
              :disabled="!contextMenuMergable"
              :title="$t('components.timelineCanvas.contextMenu.merge')"
              @click="contextMenuMerge"
            />

            <v-divider />

            <v-list-item
              :title="$t('components.timelineCanvas.contextMenu.removeSegment')"
              @click="contextMenuDelete"
            />
          </template>
        </v-list>
      </v-menu>
    </div>

    <v-snackbar v-model="moveWarning" color="warning" timeout="6000" location="top">
      {{ $t('components.timelineCanvas.moveWarning') }}
    </v-snackbar>

    <teleport defer to="#timelineScrollbarContainer">
      <input
        ref="hScrollbar"
        type="range"
        class="timeline-scrollbar"
        min="0"
        :max="scrollMax"
        :value="scrollBarValue"
        :style="{ '--thumb-width': scrollThumbWidth + 'px' }"
        @input="onScroll(Number($event.target.value))"
      />
    </teleport>
  </div>
</template>

<script>
import * as d3 from 'd3'
import { mapStores } from 'pinia'
import { markRaw } from 'vue'

import shortcuts from '@renderer/shortcuts'
import { useMainStore } from '@renderer/stores/main'
import { useTempStore } from '@renderer/stores/temp'
import { useUndoableStore } from '@renderer/stores/undoable'

const TIMELINE_HEIGHT = 49
const PLAYHEAD_COLOR = '#ff0000'

const truncateText = (ctx, text, maxWidth) => {
  if (ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (t.length > 0 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1)
  return t + '…'
}

const baseFill = (d, selectedTimelineId) => {
  if (d.timeline === selectedTimelineId && d.fill !== '#aa5555') return '#e0e0e0'
  return d.fill
}

const segmentFill = (d, selectedSegments, selectedTimelineId) => {
  if (selectedSegments.has(d.id)) return 'yellow'
  return baseFill(d, selectedTimelineId)
}

const drawSegment = (
  d,
  x,
  xwidth,
  ctx,
  hCtx,
  selectedSegments,
  imageCache,
  rescale,
  fps,
  selectedTimelineId
) => {
  hCtx.fillStyle = d.hiddenColor
  if (d.type === 'shot') {
    ctx.fillStyle = segmentFill(d, selectedSegments, selectedTimelineId)
    ctx.fillRect(x, d.y, xwidth - x, d.height)
    if (xwidth - x > 20) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(x, d.y, xwidth - x, d.height)
      ctx.clip()
      ctx.fillStyle = d.locked ? '#666' : 'black'
      const label = truncateText(ctx, d.annotation, xwidth - x - 20)
      ctx.fillText(label, x + 10, d.y + 15)
      ctx.restore()
    }
    ctx.strokeStyle = '#666666'
    ctx.lineWidth = 1
    ctx.strokeRect(x, d.y, xwidth - x, d.height)
    hCtx.fillRect(x, d.y, xwidth - x, d.height)
  } else if (d.type === 'select') {
    ctx.fillStyle = baseFill(d, selectedTimelineId)
    ctx.fillRect(x, d.y, xwidth - x, d.height)
    ctx.strokeStyle = '#666666'
    ctx.lineWidth = 1
    ctx.strokeRect(x, d.y, xwidth - x, d.height)
    if (selectedSegments.has(d.id)) {
      ctx.strokeStyle = 'yellow'
      ctx.lineWidth = 3
      ctx.strokeRect(x + 2, d.y + 2, xwidth - x - 4, d.height - 4)
    }
    hCtx.fillRect(x, d.y, xwidth - x, d.height)
  } else if (d.type === 'screenshot') {
    const image = imageCache.get(d.uri)
    if (!image) return
    if (selectedSegments.has(d.id)) {
      ctx.fillStyle = 'yellow'
      ctx.fillRect(x, d.y, d.width, d.height)
      ctx.globalAlpha = 0.5
    }
    ctx.drawImage(image, x, d.y, d.width, d.height)
    ctx.globalAlpha = 1.0
    hCtx.fillRect(x, d.y, d.width, d.height)
  } else if (d.type === 'scalar') {
    ctx.beginPath()
    ctx.lineWidth = '1'
    ctx.strokeStyle = 'DimGray'
    ctx.moveTo(rescale(0), d.data[0])
    d.data.forEach((p, i) => {
      ctx.lineTo(rescale((i / d.fps) * fps), p)
    })
    ctx.stroke()
  }
}

export default {
  name: 'TimelineCanvas',

  data() {
    return {
      axisColor: 'black',
      canvasHeight: 0,
      canvasWidth: 500,
      contextMenuEntry: null,
      contextMenuVisible: false,
      contextMenuX: 0,
      contextMenuY: 0,
      ctx: null,
      data: [],
      dpr: window.devicePixelRatio || 1,
      dragStartX: 0,
      dragStartY: 0,
      hCtx: null,
      isDragging: false,
      isDrawingScheduled: false,
      lastClick: Date.now(),
      lockedRows: [],
      moveWarning: false,
      numTimelines: 0,
      overlayInput: false,
      overlayInputEntry: null,
      overlayInputModel: '',
      overlayPosX: 0,
      overlayPosY: 0,
      resizeoberserver: null,
      scale: null,
      scrollBarValue: 0,
      tCtx: null,
      transform: d3.zoomIdentity,
      unloadedImages: 0,
      zoom: null
    }
  },

  computed: {
    ...mapStores(useMainStore, useTempStore, useUndoableStore),

    contextMenuAnnotateLabel() {
      if (this.contextMenuEntry?.type === 'select') {
        return this.$t('components.timelineCanvas.contextMenu.toggleAnnotation')
      }
      return this.$t('components.timelineCanvas.contextMenu.addTextAnnotation')
    },

    contextMenuMergable() {
      if (this.tempStore.selectedSegments.size <= 1) return false
      const timelineId = this.tempStore.selectedSegments.values().next().value
      const timeline = this.undoableStore.timelines.find((t) => t.id === timelineId)
      if (!timeline || timeline.type !== 'shots') return false
      const timelineDataIds = timeline.data.map((d) => d.id)
      const indices = Array.from(this.tempStore.selectedSegments.keys())
        .map((s) => timelineDataIds.indexOf(s))
        .sort((a, b) => a - b)
      return indices[indices.length - 1] - indices[0] === indices.length - 1
    },

    scrollMax() {
      return Math.max(0, Math.round(this.canvasWidth * (this.transform.k - 1)))
    },

    scrollThumbWidth() {
      return Math.max(20, Math.round(this.canvasWidth / this.transform.k))
    },

    scrollValue() {
      return Math.round(-this.transform.x)
    },

    selectedTimelineId() {
      return this.tempStore.selectedTimelineId
    }
  },

  watch: {
    '$vuetify.theme.global.name'(val) {
      if (val === 'dark') {
        this.axisColor = 'white'
      } else {
        this.axisColor = 'black'
      }
      this.requestDraw()
    },

    'mainStore.fps'() {
      if (this.mainStore.videoDuration && this.mainStore.fps) {
        this.drawSetup()
      }
    },

    'mainStore.videoDuration'() {
      if (this.mainStore.videoDuration && this.mainStore.fps) {
        this.drawSetup()
        this.requestDraw()
      }
    },

    scrollValue(val) {
      this.scrollBarValue = val
    },

    'tempStore.playPosition'() {
      const tmpShot = this.tempStore.tmpShot
      if (tmpShot?.ioPending) {
        tmpShot.end = Math.max(this.playHeadFrame(), tmpShot.start)
        tmpShot.invalid = this.shotOverlaps(tmpShot)
      }
      this.requestDraw()
    },

    'tempStore.selectedTimelineId'() {
      if (this.tempStore.tmpShot?.ioPending) this.tempStore.tmpShot = null
      this.requestDraw()
    },

    'tempStore.timelinesFold': {
      deep: true,

      handler() {
        this.drawSetup()
        this.requestDraw()
      }
    },

    'undoableStore.timelines': {
      deep: true,

      handler() {
        this.drawSetup()
        this.requestDraw()
      }
    }
  },

  mounted() {
    this.resizeoberserver = new ResizeObserver(this.onCanvasResize)
    this.resizeoberserver.observe(this.$refs.canvas)

    d3.select(this.$refs.canvas).on('click', (e) => this.clickHandler(e))
    d3.select(this.$refs.canvas).on('contextmenu', (e) => this.contextMenuHandler(e))
    d3.select(this.$refs.canvas).on('mousedown', (e) => this.mousedown(e))
    d3.select(this.$refs.canvas).on('mouseleave', (e) => this.mouseleave(e))
    d3.select(this.$refs.canvas).on('mousemove', (e) => this.mousemove(e))
    d3.select(this.$refs.canvas).on('dblclick', (e) => {
      e.stopImmediatePropagation()
    })
    const panningHandler = (e) => {
      this.zoom.translateBy(d3.select(e.currentTarget), e.wheelDeltaX / this.transform.k, 0)
      this.requestDraw()
    }
    d3.select(this.$refs.canvas).on('wheel', panningHandler)
    d3.select(this.$refs.timeCanvas).on('wheel', panningHandler)
    d3.select(this.$refs.timeCanvas).on('click', this.timeAxisClickHandler)

    const drag = d3
      .drag()
      .filter((e) => {
        const [x, y] = d3.pointer(e, this.$refs.timeCanvas)
        const xdpr = Math.floor(x * this.dpr)
        const ydpr = Math.floor(y * this.dpr)
        const pixel = this.tCtx.getImageData(xdpr, ydpr, 1, 1).data
        const color = this.rgbToHex(pixel[0], pixel[1], pixel[2])
        return color === PLAYHEAD_COLOR
      })
      .on('drag', this.timeAxisDrag)
    d3.select(this.$refs.timeCanvas).call(drag)

    shortcuts.register('i', this.setInPoint)
    shortcuts.register('o', this.setOutPoint)

    this.drawSetup()
    this.requestDraw()
  },

  beforeUnmount() {
    this.resizeoberserver.unobserve(this.$refs.canvas)
    shortcuts.clear('i')
    shortcuts.clear('o')
  },

  methods: {
    clickHandler(event) {
      const rect = this.$refs.canvas.getBoundingClientRect()
      const x = (event.clientX - rect.left) * this.dpr
      const y = (event.clientY - rect.top) * this.dpr
      const entry = this.getEntryAtPosition(x, y)

      if (entry) {
        // Select shots
        if (entry.type === 'select' && !entry.locked) {
          this.undoableStore.addVocabAnnotation(entry.id, entry.tag)
        } else if (Date.now() - this.lastClick < 500 && !entry.locked) {
          this.doubleClickPopup(entry)
          this.tempStore.selectedSegments = new Map([[entry.id, entry.timeline]])
        } else if (
          this.tempStore.selectedSegments.size > 0 &&
          this.tempStore.selectedSegments.values().next().value !== entry.timeline
        ) {
          // Only allow selection from the same timeline
          this.tempStore.selectedSegments = new Map([[entry.id, entry.timeline]])
        } else if (event.shiftKey && this.tempStore.selectedSegments.size > 0) {
          // Range select: select all segments between the current selection anchor and entry
          const anchorId = [...this.tempStore.selectedSegments.keys()].pop()
          const timelineSegments = this.data
            .filter((d) => d.timeline === entry.timeline && d.type !== 'select')
            .sort((a, b) => a.x - b.x)
          const ids = timelineSegments.map((d) => d.id)
          const anchorIdx = ids.indexOf(anchorId)
          const targetIdx = ids.indexOf(entry.id)
          if (anchorIdx !== -1 && targetIdx !== -1) {
            const from = Math.min(anchorIdx, targetIdx)
            const to = Math.max(anchorIdx, targetIdx)
            const rangeEntries = timelineSegments.slice(from, to + 1).map((d) => [d.id, d.timeline])
            this.tempStore.selectedSegments = new Map(rangeEntries)
          } else {
            this.tempStore.selectedSegments = new Map([[entry.id, entry.timeline]])
          }
        } else if (event.metaKey || event.ctrlKey) {
          // Try both key and ctrlKey for macOS
          if (this.tempStore.selectedSegments.has(entry.id)) {
            // Click on selected element de-selects it
            this.tempStore.selectedSegments.delete(entry.id)
          } else {
            this.tempStore.selectedSegments.set(entry.id, entry.timeline)
          }
        } else {
          this.tempStore.selectedSegments = new Map([[entry.id, entry.timeline]])
        }
        this.requestDraw()
      }
      this.lastClick = Date.now()
    },

    contextMenuAnnotate() {
      if (!this.contextMenuEntry) return
      if (this.contextMenuEntry.type === 'select') {
        this.undoableStore.addVocabAnnotation(this.contextMenuEntry.id, this.contextMenuEntry.tag)
      } else {
        this.doubleClickPopup(this.contextMenuEntry)
      }
    },

    contextMenuDelete() {
      if (!this.contextMenuEntry) return
      const timelineId = this.contextMenuEntry.timeline
      const segmentIds = Array.from(this.tempStore.selectedSegments.keys())
      this.undoableStore.deleteSegments(timelineId, segmentIds)
      this.tempStore.selectedSegments = new Map()
    },

    contextMenuHandler(event) {
      event.preventDefault()
      const rect = this.$refs.canvas.getBoundingClientRect()
      const x = (event.clientX - rect.left) * this.dpr
      const y = (event.clientY - rect.top) * this.dpr
      const entry = this.getEntryAtPosition(x, y)
      if (!entry) return

      if (!this.tempStore.selectedSegments.has(entry.id)) {
        this.tempStore.selectedSegments = new Map([[entry.id, entry.timeline]])
        this.requestDraw()
      }

      this.contextMenuEntry = entry
      this.contextMenuX = event.clientX
      this.contextMenuY = event.clientY
      this.contextMenuVisible = true
    },

    contextMenuMerge() {
      if (!this.contextMenuMergable) return
      const segments = this.tempStore.selectedSegments
      this.undoableStore.mergeSegments(segments.values().next().value, Array.from(segments.keys()))
      this.tempStore.selectedSegments = new Map()
    },

    doubleClickPopup(entry) {
      this.overlayInput = true
      this.$nextTick().then(() => {
        const rect = this.$refs.canvas.getBoundingClientRect()
        const x = Math.round(this.transform.rescaleX(this.scale)(entry.x)) + rect.left
        const maxWidth = 500

        // Stay within viewport horizontally
        this.overlayPosX = Math.min(Math.max(x, 0), window.innerWidth - maxWidth)

        // Try to position below segment
        let topPos = entry.y + 46 + rect.top
        // If it goes off-viewport at bottom, position above segment
        if (topPos + 300 > window.innerHeight) {
          topPos = Math.max(0, entry.y + rect.top - 300)
        }
        this.overlayPosY = topPos

        this.overlayInputEntry = this.undoableStore.getSegmentForId(entry.timeline, entry.id)
        this.overlayInputModel = this.overlayInputEntry.annotation
        this.$refs.overlayTextfield.focus()
      })
    },

    draw() {
      const { ctx } = this
      ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight)
      const rescale = this.transform.rescaleX(this.scale)

      this.drawTimelines(rescale)
      this.drawTmpShot(rescale)

      this.drawAxis()
      this.drawPlayHead(rescale(this.tempStore.playPosition * this.mainStore.fps))
    },

    drawAxis() {
      const transScale = this.transform.rescaleX(this.scale)
      const tickSize = 13
      const YbelowText = 28
      const smallTickSize = Math.round(tickSize / 2.5)
      const smallTicks = transScale.ticks(Math.floor(this.canvasWidth / 13))
      const ticks = transScale.ticks(Math.floor(this.canvasWidth / 130))
      const tickFormat = (d) => {
        return this.mainStore.timeReadableSec(Math.round(d / this.mainStore.fps))
      }

      const tCtx = this.tCtx
      tCtx.clearRect(0, 0, this.canvasWidth, 50)

      tCtx.strokeStyle = this.axisColor
      tCtx.lineWidth = '1'

      tCtx.beginPath()
      ticks.forEach((d) => {
        tCtx.moveTo(transScale(d), YbelowText)
        tCtx.lineTo(transScale(d), YbelowText - tickSize)
      })

      smallTicks.forEach((d) => {
        tCtx.moveTo(transScale(d), YbelowText)
        tCtx.lineTo(transScale(d), YbelowText - smallTickSize)
      })
      tCtx.stroke()

      tCtx.beginPath()
      tCtx.moveTo(0, YbelowText)
      tCtx.lineTo(this.canvasWidth, YbelowText)
      tCtx.stroke()

      tCtx.textAlign = 'center'
      tCtx.textBaseline = 'top'
      tCtx.fillStyle = this.axisColor
      ticks.forEach((d) => {
        tCtx.beginPath()
        tCtx.fillText(tickFormat(d), transScale(d), 0)
      })
    },

    drawPlayHead(xPosition) {
      const yPosition = 26
      this.ctx.beginPath()
      this.ctx.strokeStyle = PLAYHEAD_COLOR
      this.ctx.lineWidth = '2'
      this.ctx.moveTo(xPosition, this.canvasHeight)
      this.ctx.lineTo(xPosition, 0)
      this.ctx.stroke()

      this.tCtx.fillStyle = PLAYHEAD_COLOR
      this.tCtx.beginPath()
      this.tCtx.moveTo(xPosition, yPosition)
      this.tCtx.lineTo(xPosition + 8, yPosition - 5)
      this.tCtx.lineTo(xPosition + 8, yPosition - 12)
      this.tCtx.lineTo(xPosition - 8, yPosition - 12)
      this.tCtx.lineTo(xPosition - 8, yPosition - 5)
      this.tCtx.lineTo(xPosition, yPosition)
      this.tCtx.closePath()
      this.tCtx.fill()
      this.tCtx.beginPath()
      this.tCtx.strokeStyle = PLAYHEAD_COLOR
      this.tCtx.lineWidth = '2'
      this.tCtx.moveTo(xPosition, 26)
      this.tCtx.lineTo(xPosition, 32)
      this.tCtx.stroke()
    },

    drawSetup() {
      const data = []
      const lockedRows = []

      this.numTimelines = 0
      for (const timeline of this.undoableStore.timelines) {
        for (const [shotIndex, shot] of timeline.data.entries()) {
          if (timeline.type === 'shots') {
            const effectiveLocked = [timeline.locked, shot.locked].some(Boolean)
            const color = '#aaaaaa'
            const annotation = shotIndex + 1 + ': ' + (shot.annotation ?? '').slice(0, 40)
            data.push({
              annotation,
              fill: color,
              height: 44,
              id: shot.id,
              locked: effectiveLocked,
              selected: this.tempStore.selectedSegments.has(shot.id),
              timeline: timeline.id,
              type: 'shot',
              width: shot.end - shot.start + 1,
              x: shot.start,
              y: this.numTimelines * TIMELINE_HEIGHT
            })
          } else if (timeline.type.startsWith('screenshots')) {
            data.push({
              height: 44,
              id: shot.id,
              selected: this.tempStore.selectedSegments.has(shot.id),
              timeline: timeline.id,
              type: 'screenshot',
              uri: shot.thumbnail,
              width: 44 * (16 / 9),
              x: shot.frame,
              y: this.numTimelines * TIMELINE_HEIGHT
            })
            // Only re-draw after 200 new images were loaded
            if (!this.tempStore.imageCache.has(shot.thumbnail)) {
              this.unloadedImages += 1
              d3.image(shot.thumbnail)
                .then((img) => {
                  this.tempStore.imageCache.set(shot.thumbnail, img)
                })
                .catch((err) => {
                  console.error('Error loading thumbnail', err)
                })
                .finally(() => {
                  this.unloadedImages -= 1
                  if (this.unloadedImages % 200 === 0) this.requestDraw()
                })
            }
          }
        }
        if (timeline.type === 'scalar') {
          data.push({
            data: timeline.data.map(
              (t) => (this.numTimelines + 1) * TIMELINE_HEIGHT - t * (TIMELINE_HEIGHT - 5) - 5
            ),
            fps: timeline.fps,
            height: 44,
            id: timeline.id,
            timeline: timeline.id,
            type: 'scalar'
          })
        }
        const startRow = this.numTimelines
        if (timeline.vocabulary && this.tempStore.timelinesFold[timeline.id].visible) {
          for (const category of this.tempStore.timelinesFold[timeline.id].categories) {
            this.numTimelines += 1
            if (category.visible) {
              for (const tag of category.tags) {
                this.numTimelines += 1
                //TODO: reduce nesting and complexity here
                /* eslint-disable max-depth */
                for (const shot of timeline.data) {
                  let color = '#aaaaaa'
                  if (shot.vocabAnnotation.includes(tag.id)) color = '#aa5555'

                  data.push({
                    fill: color,
                    height: 44,
                    id: shot.id,
                    locked: timeline.locked,
                    tag: tag.id,
                    timeline: timeline.id,
                    type: 'select',
                    width: shot.end - shot.start + 1,
                    x: shot.start,
                    y: this.numTimelines * TIMELINE_HEIGHT
                  })
                }
                /* eslint-enable max-depth */
              }
            }
          }
        }
        if (timeline.locked) {
          for (let row = startRow; row <= this.numTimelines; row += 1) {
            lockedRows.push(row * TIMELINE_HEIGHT)
          }
        }
        this.numTimelines += 1
      }

      this.lockedRows = lockedRows
      this.zoom = d3
        .zoom()
        .wheelDelta((event) => {
          let factor = event.deltaMode === 1 ? 0.05 : 0.01
          if (Math.abs(event.deltaY) > 25) {
            // Mouse scrolling has delta > 200 and touchpad around 20 so limit delta here
            factor *= 25 / Math.abs(event.deltaY)
          }
          return -event.deltaY * factor
        })
        .scaleExtent([1, this.mainStore.videoDuration * 0.15])
        .filter((e) => {
          if (e.ctrlKey) e.preventDefault()
          // Only allow zoom via pinch on touchpad and ctrl+zoom with mouse
          if (e.type === 'wheel') return e.ctrlKey
          return true
        })
        .on('zoom', (event) => {
          this.transform = event.transform

          // Synchronise transform state between the two canvases
          if (event.sourceEvent) {
            if (event.sourceEvent.target === this.$refs.canvas) {
              d3.select(this.$refs.timeCanvas).property('__zoom', event.transform)
            } else {
              d3.select(this.$refs.canvas).property('__zoom', event.transform)
            }
          }

          this.requestDraw()
        })

      const canvas = d3.select(this.$refs.canvas).call(this.zoom)
      this.ctx = canvas.node().getContext('2d')
      this.ctx.scale(this.dpr, this.dpr)

      this.tCtx = d3.select(this.$refs.timeCanvas).call(this.zoom).node().getContext('2d')
      this.tCtx.scale(this.dpr, this.dpr)

      // Picking: selection happens via a hidden canvas that has the same
      // elements with each in a different color
      const hCanvas = d3.select(this.$refs.hiddenCanvas)
      let colorI = 10
      this.hCtx = hCanvas.node().getContext('2d')
      this.hCtx.scale(this.dpr, this.dpr)
      for (const d of data) {
        d.hiddenColor = '#' + colorI.toString(16).padStart(6, '0')
        colorI += 20
      }
      // Modify data first and then access property because property access is slow
      this.data = markRaw(data)

      this.resize()
    },

    drawTimelines(rescale) {
      if (this.data.length === 0) return
      const { hCtx, ctx, data } = this
      const imageCache = this.tempStore.imageCache
      const fps = this.mainStore.fps
      const selectedTimelineId = this.selectedTimelineId
      hCtx.clearRect(0, 0, this.canvasWidth, this.canvasHeight)
      const selectedSegments = new Set(this.tempStore.selectedSegments.keys())
      ctx.textAlign = 'left'
      ctx.font = '15px Arial'
      ctx.textBaseline = 'top'

      const movingId = this.tempStore.tmpShot?.moving
        ? this.tempStore.tmpShot.originalShot?.id
        : null
      const visibleData = movingId === null ? data : data.filter((d) => d.id !== movingId)
      for (const d of visibleData) {
        const x = Math.round(rescale(d.x))
        const xwidth = Math.round(rescale(d.x + d.width))
        if (xwidth < 0 || x > this.canvasWidth || (xwidth - x <= 0 && d.type !== 'screenshot'))
          // eslint-disable-next-line no-continue
          continue

        drawSegment(
          d,
          x,
          xwidth,
          ctx,
          hCtx,
          selectedSegments,
          imageCache,
          rescale,
          fps,
          selectedTimelineId
        )
      }

      ctx.strokeStyle = 'rgba(0,0,0,0.22)'
      ctx.lineWidth = 4
      const step = 16
      for (const y of this.lockedRows) {
        ctx.save()
        ctx.beginPath()
        ctx.rect(0, y, this.canvasWidth, TIMELINE_HEIGHT - 5)
        ctx.clip()
        for (let xi = -TIMELINE_HEIGHT; xi < this.canvasWidth + step; xi += step) {
          ctx.beginPath()
          ctx.moveTo(xi, y)
          ctx.lineTo(xi + TIMELINE_HEIGHT, y + TIMELINE_HEIGHT)
          ctx.stroke()
        }
        ctx.restore()
      }

      if (this.selectedTimelineId) {
        const activeEntry = data.find((d) => d.timeline === this.selectedTimelineId)
        if (activeEntry) {
          const y = activeEntry.y
          const bottom = y + TIMELINE_HEIGHT - 5
          ctx.save()
          ctx.strokeStyle = '#2196f3'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(0, y)
          ctx.lineTo(this.canvasWidth, y)
          ctx.stroke()
          ctx.beginPath()
          ctx.moveTo(0, bottom)
          ctx.lineTo(this.canvasWidth, bottom)
          ctx.stroke()
          ctx.restore()
        }
      }
    },

    drawTmpShot(rescale) {
      if (this.tempStore.tmpShot === null) return
      this.ctx.globalAlpha = this.tempStore.tmpShot.invalid ? 0.4 : 1
      this.ctx.fillStyle = this.tempStore.tmpShot.invalid ? '#ffcccc' : 'yellow'
      this.ctx.fillRect(
        rescale(this.tempStore.tmpShot.start),
        this.tempStore.tmpShot.y,
        rescale(this.tempStore.tmpShot.end + 1) - rescale(this.tempStore.tmpShot.start),
        this.tempStore.tmpShot.height
      )
      this.ctx.globalAlpha = 1

      if (this.tempStore.adjacentShot === null) return
      this.ctx.fillStyle = 'orange'
      this.ctx.fillRect(
        rescale(this.tempStore.adjacentShot.start),
        this.tempStore.adjacentShot.y,
        rescale(this.tempStore.adjacentShot.end + 1) - rescale(this.tempStore.adjacentShot.start),
        this.tempStore.adjacentShot.height
      )
    },

    findEdgeAt(coordX, coordY) {
      const EDGE_ZONE = 8
      const JOINT_ZONE = 2
      const rescale = this.transform.rescaleX(this.scale)
      const data = this.data
      let best = null
      let bestScore = -1

      for (let i = 0; i < data.length; i += 1) {
        const d = data[i]
        if (d.type === 'shot' && coordY >= d.y && coordY <= d.y + d.height) {
          const rightEdgeX = rescale(d.x + d.width)
          const distRight = Math.abs(coordX - rightEdgeX)
          if (distRight <= EDGE_ZONE) {
            const score = (EDGE_ZONE - distRight) * (coordX <= rightEdgeX ? 2 : 1)
            if (score > bestScore) {
              bestScore = score
              const next = data[i + 1]
              const touching =
                next &&
                next.type === 'shot' &&
                next.timeline === d.timeline &&
                d.x + d.width === next.x
              best = { entry: d, joint: touching && distRight <= JOINT_ZONE, leftSide: false }
            }
          }

          const leftEdgeX = rescale(d.x)
          const distLeft = Math.abs(coordX - leftEdgeX)
          if (distLeft <= EDGE_ZONE) {
            const score = (EDGE_ZONE - distLeft) * (coordX >= leftEdgeX ? 2 : 1)
            if (score > bestScore) {
              bestScore = score
              const prev = data[i - 1]
              const touching =
                prev &&
                prev.type === 'shot' &&
                prev.timeline === d.timeline &&
                prev.x + prev.width === d.x
              best = { entry: d, joint: touching && distLeft <= JOINT_ZONE, leftSide: true }
            }
          }
        }
      }

      return best
    },

    getEntryAtPosition(x, y) {
      const colorData = this.hCtx.getImageData(x, y, 1, 1).data
      const color = this.rgbToHex(colorData[0], colorData[1], colorData[2])
      return this.data.find((d) => d.hiddenColor === color) ?? null
    },

    getTimelineForCoordinate(y) {
      let index = 0
      let offset = 0

      for (const timeline of this.undoableStore.timelines) {
        offset += TIMELINE_HEIGHT
        if (offset > y) break

        const fold = this.tempStore.timelinesFold[timeline.id]
        if (fold.visible) {
          for (const category of fold.categories) {
            offset += TIMELINE_HEIGHT
            if (offset > y) break
            if (category.visible) {
              offset += category.tags.length * TIMELINE_HEIGHT
            }
          }
        }
        index += 1
      }

      return index
    },

    getTimelineRowY(timelineId) {
      let rows = 0
      for (const timeline of this.undoableStore.timelines) {
        if (timeline.id === timelineId) return rows * TIMELINE_HEIGHT
        const fold = this.tempStore.timelinesFold[timeline.id]
        if (fold?.visible && fold.categories) {
          for (const category of fold.categories) {
            rows += 1
            if (category.visible) rows += category.tags.length
          }
        }
        rows += 1
      }
      return null
    },

    mousedown(e) {
      this.tempStore.tmpShot = null
      if (e.altKey || e.shiftKey) e.stopImmediatePropagation()
      const rect = this.$refs.canvas.getBoundingClientRect()
      const x = (e.clientX - rect.left) * this.dpr
      const y = (e.clientY - rect.top) * this.dpr
      const coordX = e.clientX - rect.left
      const coordY = e.clientY - rect.top

      if (!e.altKey) return

      const timelineIndex = this.getTimelineForCoordinate(coordY)
      if (this.undoableStore.timelines[timelineIndex].type !== 'shots') return

      // Resize segment boundary
      const edgeHit = this.findEdgeAt(coordX, coordY)
      if (edgeHit) {
        e.stopImmediatePropagation()
        const { entry, leftSide } = edgeHit
        if (entry.locked) return

        window.addEventListener('mouseup', this.mouseup)
        this.tempStore.tmpShot = {
          end: entry.x + entry.width - 1,
          height: 44,
          max: this.mainStore.numFrames,
          min: 0,
          origin: leftSide ? entry.x + entry.width - 1 : entry.x,
          originalShot: entry,
          start: entry.x,
          y: entry.y
        }
        const currentIndex = this.data.indexOf(entry)
        const adjacent = leftSide ? this.data[currentIndex - 1] : this.data[currentIndex + 1]

        if (adjacent?.timeline === entry.timeline) {
          this.tempStore.tmpShot.min = leftSide
            ? adjacent.x + adjacent.width
            : this.tempStore.tmpShot.start
          this.tempStore.tmpShot.max = leftSide ? this.tempStore.tmpShot.end : adjacent.x - 1

          if (edgeHit.joint && adjacent.locked) {
            this.tempStore.tmpShot = null
          } else if (edgeHit.joint) {
            this.tempStore.adjacentShot = {
              diff: leftSide
                ? entry.x - (adjacent.x + adjacent.width - 1)
                : adjacent.x - (entry.x + entry.width - 1),

              end: adjacent.x + adjacent.width - 1,
              height: 44,
              leftSide,
              originalShot: adjacent,
              start: adjacent.x,
              y: adjacent.y
            }
          }
        }
        return
      }

      // Move existing segment
      const entry = this.getEntryAtPosition(x, y)
      if (entry && !entry.locked) {
        const xNew = Math.round(this.transform.rescaleX(this.scale).invert(coordX))
        window.addEventListener('mouseup', this.mouseup)
        this.tempStore.tmpShot = {
          dragOffset: xNew - entry.x,
          end: entry.x + entry.width - 1,
          height: 44,
          max: this.mainStore.numFrames,
          min: 0,
          moving: true,
          originalShot: entry,
          segmentWidth: entry.width - 1,
          start: entry.x,
          y: entry.y
        }
        return
      }

      // Create new segment
      const height = coordY - (coordY % TIMELINE_HEIGHT)
      const start = this.transform.rescaleX(this.scale).invert(coordX)
      window.addEventListener('mouseup', this.mouseup)
      this.tempStore.tmpShot = {
        end: start,
        height: 44,
        max: this.mainStore.numFrames,
        min: 0,
        origin: start,
        originalShot: null,
        start,
        timelineIndex,
        y: height
      }
    },

    mouseleave(e) {
      if (e.buttons === 1) return
      this.$refs.canvas.style.cursor = 'default'
      if (this.tempStore.tmpShot?.ioPending) return
      if (this.tempStore.tmpShot !== null) {
        this.tempStore.tmpShot = null
        this.tempStore.adjacentShot = null
        this.requestDraw()
      }
    },

    mousemove(e) {
      const rect = this.$refs.canvas.getBoundingClientRect()
      const coordX = e.clientX - rect.left
      const xNew = Math.round(this.transform.rescaleX(this.scale).invert(coordX))

      if (e.buttons !== 1) {
        const coordY = e.clientY - rect.top
        const edge = e.altKey ? this.findEdgeAt(coordX, coordY) : null
        if (edge) {
          if (edge.joint) {
            this.$refs.canvas.style.cursor = 'ew-resize'
          } else if (edge.leftSide) {
            this.$refs.canvas.style.cursor = 'e-resize'
          } else {
            this.$refs.canvas.style.cursor = 'w-resize'
          }
        } else {
          this.$refs.canvas.style.cursor = 'default'
        }
      }

      if (e.buttons !== 1 || this.tempStore.tmpShot === null) return
      if (e.altKey || this.tempStore.adjacentShot) e.stopImmediatePropagation()

      // Limit the bounds so that no overlapping or inverted segments (end before start) get created
      const clamp = (v, min, max) => Math.max(min, Math.min(max, v))
      const { tmpShot, adjacentShot } = { ...this.tempStore }
      if (adjacentShot) {
        if (adjacentShot.leftSide) {
          tmpShot.start = clamp(xNew, adjacentShot.start + adjacentShot.diff + 1, tmpShot.origin)
          tmpShot.end = clamp(xNew, tmpShot.end, tmpShot.origin + 1)
          adjacentShot.end = tmpShot.start - adjacentShot.diff
        } else {
          tmpShot.start = clamp(xNew, tmpShot.start, tmpShot.origin - 1)
          tmpShot.end = clamp(xNew, tmpShot.origin + 1, adjacentShot.end - adjacentShot.diff - 1)
          adjacentShot.start = tmpShot.end + adjacentShot.diff
        }
      } else if (tmpShot.moving) {
        const newStart = clamp(
          xNew - tmpShot.dragOffset,
          tmpShot.min,
          tmpShot.max - tmpShot.segmentWidth
        )
        tmpShot.start = newStart
        tmpShot.end = newStart + tmpShot.segmentWidth
        tmpShot.invalid = this.shotOverlaps(tmpShot)
      } else {
        tmpShot.start = clamp(xNew, tmpShot.min, tmpShot.origin)
        tmpShot.end = clamp(xNew, tmpShot.origin, tmpShot.max)
        tmpShot.invalid = this.shotOverlaps(tmpShot)
      }

      this.requestDraw()
      this.tempStore.playJumpPosition = xNew / this.mainStore.fps
    },

    mouseup(e) {
      if (this.tempStore.tmpShot === null) return
      window.removeEventListener('mouseup', this.mouseup)
      e.stopImmediatePropagation()
      const { tmpShot } = this.tempStore
      if (tmpShot.moving) {
        if (tmpShot.invalid) {
          this.moveWarning = true
        } else {
          this.undoableStore.changeShotBoundaries(
            tmpShot.originalShot.id,
            tmpShot.start,
            tmpShot.end
          )
        }
      } else if (tmpShot.originalShot === null) {
        if (!tmpShot.invalid) {
          this.undoableStore.addShotToNth(tmpShot.timelineIndex, tmpShot.start, tmpShot.end)
        }
      } else {
        this.undoableStore.changeShotBoundaries(tmpShot.originalShot.id, tmpShot.start, tmpShot.end)

        if (this.tempStore.adjacentShot) {
          const { adjacentShot } = this.tempStore
          this.undoableStore.changeShotBoundaries(
            adjacentShot.originalShot.id,
            adjacentShot.start,
            adjacentShot.end
          )
        }
      }
      this.tempStore.tmpShot = null
      this.tempStore.adjacentShot = null
      this.$refs.canvas.style.cursor = 'default'
    },

    onCanvasResize() {
      if (this.ctx === null) return

      this.resize()
      this.requestDraw()
      this.overlayInput = false
    },

    onDrag(e) {
      if (!this.isDragging) return
      this.overlayPosX = e.clientX - this.dragStartX
      this.overlayPosY = e.clientY - this.dragStartY
    },

    onScroll(value) {
      const target = d3.zoomIdentity.translate(-value, 0).scale(this.transform.k)
      d3.select(this.$refs.canvas).call(this.zoom.transform, target)
    },

    overlayInputChange() {
      this.overlayInputEntry.annotation = this.overlayInputModel
      this.overlayInput = false
    },

    playHeadFrame() {
      return Math.round(this.tempStore.playPosition * this.mainStore.fps)
    },

    requestDraw() {
      if (!this.isDrawingScheduled) {
        this.isDrawingScheduled = true
        requestAnimationFrame(() => {
          this.draw()
          this.isDrawingScheduled = false
        })
      }
    },

    resize() {
      // Get the display size of the canvas
      const container = this.$refs.canvas.parentElement
      const displayWidth = container.clientWidth
      const displayHeight = this.numTimelines * TIMELINE_HEIGHT

      // Set the canvas display size
      this.canvasWidth = displayWidth
      this.canvasHeight = displayHeight

      // Set the canvas internal (buffer) size
      this.$refs.canvas.width = Math.floor(displayWidth * this.dpr)
      this.$refs.canvas.height = Math.floor(displayHeight * this.dpr)
      this.$refs.canvas.style.width = '100%'
      this.$refs.canvas.style.height = `${displayHeight}px`

      const parent = document.getElementById('timelineSplitter')
      const rightInset =
        parent.offsetWidth - parent.clientWidth + parseFloat(getComputedStyle(parent).paddingRight)
      this.$refs.timeCanvas.style.marginRight = rightInset + 'px'

      this.$refs.timeCanvas.width = Math.floor(displayWidth * this.dpr)
      this.$refs.timeCanvas.height = 32 * this.dpr
      this.$refs.timeCanvas.style.width = getComputedStyle(this.$refs.canvas).width

      if (this.$refs.hScrollbar) {
        this.$refs.hScrollbar.style.marginRight = rightInset + 'px'
        this.$refs.hScrollbar.style.width = getComputedStyle(this.$refs.canvas).width
      }

      // Same for hidden canvas
      this.$refs.hiddenCanvas.width = Math.floor(displayWidth * this.dpr)
      this.$refs.hiddenCanvas.height = Math.floor(displayHeight * this.dpr)

      // Scale the context
      this.ctx.scale(this.dpr, this.dpr)
      this.hCtx.scale(this.dpr, this.dpr)
      this.tCtx.scale(this.dpr, this.dpr)

      const timelineLength = this.mainStore.videoDuration * this.mainStore.fps
      this.scale = d3.scaleLinear([0, timelineLength], [0, this.canvasWidth])
      this.zoom.translateExtent([
        [0, 0],
        [this.canvasWidth, 150]
      ])
    },

    rgbToHex(r, g, b) {
      // eslint-disable-next-line
      return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toLowerCase()
    },

    setInPoint() {
      const timelineId = this.tempStore.selectedTimelineId
      const timeline = this.undoableStore.getTimelineById(timelineId)
      if (!timeline || timeline.type !== 'shots' || timeline.locked) return
      const y = this.getTimelineRowY(timelineId)
      if (y === null) return
      const start = this.playHeadFrame()
      const tmpShot = {
        end: start,
        height: 44,
        ioPending: true,
        originalShot: null,
        start,
        timelineIndex: this.undoableStore.timelines.findIndex((t) => t.id === timelineId),
        y
      }
      tmpShot.invalid = this.shotOverlaps(tmpShot)
      this.tempStore.tmpShot = tmpShot
      this.requestDraw()
    },

    setOutPoint() {
      const tmpShot = this.tempStore.tmpShot
      if (!tmpShot?.ioPending) return
      tmpShot.end = Math.max(this.playHeadFrame(), tmpShot.start)
      if (!this.shotOverlaps(tmpShot)) {
        this.undoableStore.addShotToNth(tmpShot.timelineIndex, tmpShot.start, tmpShot.end)
      }
      this.tempStore.tmpShot = null
      this.requestDraw()
    },

    shotOverlaps(shot) {
      const timeline = shot.originalShot
        ? this.undoableStore.timelines.find((t) => t.id === shot.originalShot.timeline)
        : this.undoableStore.timelines[shot.timelineIndex]
      return (
        timeline?.data.some(
          (s) => s.id !== shot.originalShot?.id && shot.start <= s.end && shot.end >= s.start
        ) ?? false
      )
    },

    startDrag(e) {
      this.isDragging = true
      this.dragStartX = e.clientX - this.overlayPosX
      this.dragStartY = e.clientY - this.overlayPosY
      window.addEventListener('mousemove', this.onDrag)
      window.addEventListener('mouseup', this.stopDrag)
    },

    stopDrag() {
      this.isDragging = false
      window.removeEventListener('mousemove', this.onDrag)
      window.removeEventListener('mouseup', this.stopDrag)
    },

    timeAxisClickHandler(e) {
      const coordX = e.clientX - this.$refs.timeCanvas.getBoundingClientRect().left
      const timePosition = this.transform.rescaleX(this.scale).invert(coordX) / this.mainStore.fps
      this.tempStore.playJumpPosition = timePosition
    },

    timeAxisDrag(e) {
      const x = d3.pointer(e, this.$refs.timeCanvas)[0]
      const timePosition = this.transform.rescaleX(this.scale).invert(x) / this.mainStore.fps
      this.tempStore.playJumpPosition = timePosition
    }
  }
}
</script>

<style scoped>
canvas {
  width: 100%;
}

.timeline-scrollbar {
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  cursor: pointer;
  height: 8px;
  margin: 4px 0 0;
  width: 100%;
}

.timeline-scrollbar::-webkit-slider-runnable-track {
  background: rgba(33, 150, 243, 0.08);
  border-radius: 4px;
  height: 8px;
}

.timeline-scrollbar::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  background: #90caf9;
  border-radius: 4px;
  cursor: pointer;
  height: 8px;
  margin-top: 0;
  width: var(--thumb-width, 40px);
}

.overlay-card {
  min-width: min-content;
  resize: both;
  overflow: hidden;
  display: flex !important;
  flex-direction: column;
}

.overlay-card :deep(.v-card-text) {
  flex: 1;
  overflow: hidden;
  min-height: 60px;
  display: flex;
  flex-direction: column;
}

.annotation-textarea,
.annotation-textarea :deep(.v-input__control),
.annotation-textarea :deep(.v-field),
.annotation-textarea :deep(.v-field__field),
.annotation-textarea :deep(.v-field__input) {
  flex: 1;
  min-height: 0;
}

.annotation-textarea :deep(textarea) {
  resize: none;
  height: 100%;
  overflow: auto;
}
</style>
