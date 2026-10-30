<template>
  <v-sheet class="d-flex flex-1-1 flex-column h-100 height-min-0">
    <v-row class="flex-0-0 ma-1">
      <v-select
        v-model="shotTimeline"
        :items="undoableStore.shotTimelines"
        :label="$t('components.shotList.selectTrack')"
        class="me-2 shotlist-header-element"
        item-title="name"
        item-value="id"
      />

      <v-select
        v-model="screenshotTimeline"
        :items="undoableStore.screenshotTimelines"
        :label="$t('components.shotList.screenshotTimeline')"
        class="shotlist-header-element"
        item-title="name"
        item-value="id"
      />

      <v-slider
        v-model="thumbZoom"
        :disabled="!screenshotTimeline"
        append-icon="mdi-magnify-plus-outline"
        prepend-icon="mdi-magnify-minus-outline"
        class="ma-2 shotlist-header-element"
        hide-details
        :min="30"
        :max="100"
      ></v-slider>
    </v-row>

    <div id="virtualscroll-containerx" class="flex-1-1 height-min-0 overflow-y-auto">
      <v-virtual-scroll v-if="shotTimeline" ref="virtualScroll" :items="shots">
        <template #default="{ item, index }">
          <div
            class="cursor-pointer pa-3"
            :class="getEntryBgColor(item)"
            @click="shotClicked(item)"
          >
            <div>
              <span class="font-weight-bold">
                {{ $t('components.shotList.id') }} {{ index + 1 }}
              </span>

              <span class="text-medium-emphasis">
                ({{ mainStore.timeReadableFrame(item.start) }} -
                {{ mainStore.timeReadableFrame(item.end) }})
              </span>
            </div>

            <div>
              <p>
                <span> {{ $t('components.shotList.annotation') }}: {{ item.annotation }} </span>
              </p>
            </div>

            <v-row v-if="screenshotTimeline" justify="start" class="ga-3 mx-3 py-3">
              <div
                v-for="img in getShotImages(item)"
                :key="img.id"
                class="screenshot"
                :class="{ 'screenshot-selected': tempStore.selectedSegments.has(img.id) }"
              >
                <img
                  :src="img.image"
                  :style="thumbZoomStyle"
                  loading="lazy"
                  @click.stop="imageClicked($event, img)"
                  @contextmenu.prevent="imageContextMenu($event, img)"
                  @dblclick="imageDoubleClicked(img)"
                />
              </div>
            </v-row>
          </div>
        </template>
      </v-virtual-scroll>
    </div>

    <v-menu v-model="contextMenuVisible" :target="[contextMenuX, contextMenuY]">
      <v-list density="compact">
        <v-list-item
          :title="$t('components.shotList.exportScreenshots')"
          @click="tempStore.exportSelectedScreenshots(mainStore.id)"
        />
      </v-list>
    </v-menu>

    <ImageDialog ref="imageDialog"></ImageDialog>
  </v-sheet>
</template>

<script>
import ImageDialog from '@renderer/components/ImageDialog.vue'
import { mapStores } from 'pinia'
import { useMainStore } from '@renderer/stores/main'
import { useTempStore } from '@renderer/stores/temp'
import { useUndoableStore } from '@renderer/stores/undoable'

export default {
  name: 'ShotList',
  components: { ImageDialog },

  data: () => ({
    contextMenuVisible: false,
    contextMenuX: 0,
    contextMenuY: 0,
    screenshotTimeline: null,
    shotTimeline: null,
    thumbZoom: 50
  }),

  computed: {
    ...mapStores(useMainStore, useTempStore, useUndoableStore),

    playheadShotIndex() {
      const framePos = this.tempStore.playPosition * this.mainStore.fps
      return this.shots.findLastIndex((s) => s.start <= framePos && framePos <= s.end)
    },

    screenshotTimelineData() {
      const timeline = this.undoableStore.screenshotTimelines.find(
        (s) => s.id === this.screenshotTimeline
      )
      return timeline ? [...timeline.data].sort((a, b) => a.frame - b.frame) : []
    },

    shots() {
      const timeline = this.undoableStore.shotTimelines.find((s) => s.id === this.shotTimeline)
      return timeline ? timeline.data : []
    },

    thumbZoomStyle() {
      return {
        height: `${this.thumbZoom}px`
      }
    }
  },

  watch: {
    playheadShotIndex(index) {
      if (index >= 0) this.$refs.virtualScroll?.scrollToIndex(index)
    },

    'undoableStore.timelines'(newVal) {
      const timelineIds = newVal.map((t) => t.id)
      if (!timelineIds.includes(this.shotTimeline)) this.shotTimeline = null
      if (!timelineIds.includes(this.screenshotTimeline)) this.screenshotTimeline = null
    }
  },

  methods: {
    getEntryBgColor(shot) {
      const framePos = this.tempStore.playPosition * this.mainStore.fps
      if (shot.start <= framePos && framePos <= shot.end) {
        return this.$vuetify.theme.global.name === 'dark' ? 'bg-grey-darken-3' : 'bg-grey-lighten-3'
      }
      return ''
    },

    getShotImages(shot) {
      const timeline = this.undoableStore.screenshotTimelines.find(
        (s) => s.id === this.screenshotTimeline
      )
      return timeline
        ? timeline.data.filter((s) => s.frame >= shot.start && s.frame < shot.end)
        : []
    },

    imageClicked(event, img) {
      const selected = this.tempStore.selectedSegments
      // Only allow selection from the same timeline
      const sameTimeline =
        selected.size > 0 && selected.values().next().value === this.screenshotTimeline

      if (event.shiftKey && sameTimeline) {
        const images = this.screenshotTimelineData
        const anchorIdx = images.findIndex((i) => i.id === [...selected.keys()].pop())
        const targetIdx = images.findIndex((i) => i.id === img.id)
        const from = Math.min(anchorIdx, targetIdx)
        const to = Math.max(anchorIdx, targetIdx)
        this.tempStore.selectedSegments = new Map(
          images.slice(from, to + 1).map((i) => [i.id, this.screenshotTimeline])
        )
      } else if ((event.metaKey || event.ctrlKey) && sameTimeline) {
        if (selected.has(img.id)) {
          selected.delete(img.id)
        } else {
          selected.set(img.id, this.screenshotTimeline)
        }
      } else {
        this.tempStore.selectedSegments = new Map([[img.id, this.screenshotTimeline]])
      }
    },

    imageContextMenu(event, img) {
      if (!this.tempStore.selectedSegments.has(img.id)) {
        this.tempStore.selectedSegments = new Map([[img.id, this.screenshotTimeline]])
      }
      this.contextMenuX = event.clientX
      this.contextMenuY = event.clientY
      this.contextMenuVisible = true
    },

    imageDoubleClicked(shot) {
      this.$refs.imageDialog.show(shot)
    },

    jumpPlayer(pos) {
      // Add extra time to ensure we are within the shot bounds
      this.tempStore.playJumpPosition = pos / this.mainStore.fps + 0.001
    },

    shotClicked(shot) {
      this.tempStore.selectedSegments = new Map([[shot.id, this.shotTimeline]])
      this.jumpPlayer(shot.start)
    }
  }
}
</script>

<style scoped>
.screenshot {
  line-height: 0;
}
.screenshot-selected {
  background-color: #fff59d;
}
.screenshot-selected img {
  opacity: 0.5;
}
.shotlist-header-element {
  min-width: 120px;
}
</style>
