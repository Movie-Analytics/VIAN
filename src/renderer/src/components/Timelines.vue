<template>
  <v-sheet class="d-flex flex-1-1 flex-column height-min-0">
    <div class="d-flex flex-row flex-1-1 height-min-0">
      <!-- Vertical segment toolbar -->
      <div class="d-flex flex-column align-center segment-toolbar">
        <span
          v-tooltip="{
            text: $t('components.timelines.tooltips.addSegment'),
            location: 'right'
          }"
        >
          <v-btn
            density="compact"
            variant="text"
            :disabled="!segmentAddable"
            icon
            :aria-label="$t('components.timelines.tooltips.addSegment')"
            @click="segmentAdd"
          >
            <v-icon>mdi-shape-square-plus</v-icon>
          </v-btn>
        </span>

        <span
          v-tooltip="{
            text: $t('components.timelines.tooltips.setInPoint'),
            location: 'right'
          }"
        >
          <v-btn
            density="compact"
            variant="text"
            :disabled="!inPointSettable"
            icon
            :aria-label="$t('components.timelines.tooltips.setInPoint')"
            @click="$refs.timelineCanvas.setInPoint()"
          >
            <v-icon>mdi-logout</v-icon>
          </v-btn>
        </span>

        <span
          v-tooltip="{
            text: $t('components.timelines.tooltips.setOutPoint'),
            location: 'right'
          }"
        >
          <v-btn
            density="compact"
            variant="text"
            :disabled="!outPointSettable"
            icon
            :aria-label="$t('components.timelines.tooltips.setOutPoint')"
            @click="$refs.timelineCanvas.setOutPoint()"
          >
            <v-icon>mdi-login</v-icon>
          </v-btn>
        </span>

        <span
          v-tooltip="{
            text: $t('components.timelines.tooltips.deleteSelectedSegment'),
            location: 'right'
          }"
        >
          <v-btn
            density="compact"
            variant="text"
            :disabled="!segmentDeletable"
            icon
            :aria-label="$t('components.timelines.tooltips.deleteSelectedSegment')"
            @click="segmentDelete"
          >
            <v-icon>mdi-delete</v-icon>
          </v-btn>
        </span>

        <span
          v-tooltip="{
            text: $t('components.timelines.tooltips.splitSelectedSegment'),
            location: 'right'
          }"
        >
          <v-btn
            density="compact"
            variant="text"
            :disabled="!segmentSplitable"
            icon
            :aria-label="$t('components.timelines.tooltips.splitSelectedSegment')"
            @click="segmentSplit"
          >
            <v-icon>mdi-table-split-cell</v-icon>
          </v-btn>
        </span>

        <span
          v-tooltip="{
            text: $t('components.timelines.tooltips.mergeSelectedSegments'),
            location: 'right'
          }"
        >
          <v-btn
            density="compact"
            variant="text"
            :disabled="!segmentMergable"
            icon
            :aria-label="$t('components.timelines.tooltips.mergeSelectedSegments')"
            @click="segmentMerge"
          >
            <v-icon>mdi-table-merge-cells</v-icon>
          </v-btn>
        </span>

        <div class="track-height-control">
          <v-btn
            density="compact"
            variant="text"
            icon
            :aria-label="$t('components.timelines.tooltips.trackHeight')"
          >
            <v-icon size="small">mdi-arrow-expand-vertical</v-icon>
          </v-btn>

          <div class="track-height-slider-popup">
            <v-slider
              :model-value="tempStore.trackScale"
              :aria-label="$t('components.timelines.tooltips.trackHeight')"
              :step="0.05"
              :min="0.5"
              :max="1"
              thumb-size="12"
              track-size="3"
              hide-details
              class="track-height-slider"
              @end="tempStore.trackScale = $event"
            ></v-slider>
          </div>
        </div>
      </div>

      <!-- Axes + tracks -->
      <div class="d-flex flex-column flex-1-1 height-min-0">

        <div id="timelineAxesContainer"></div>

        <div id="timelineSplitter" class="flex-1-1 overflow-y-auto">
      <SplitterContainer :inital-panel1-percent="30" class="overflow-y-auto">
        <template #panel1>
          <v-list
            id="timeline-list"
            lines="one"
            class="height-fit-content pt-0 w-100"
            :opened="openedItems"
          >
            <v-list-group
              v-for="(timeline, id) in visibleTimelinesFold"
              :key="id"
              :value="id"
              class="track-group-separator"
            >
              <template #activator>
                <v-list-item
                  class="pr-2"
                  :class="[{ 'active-track': id === selectedTimelineId }]"
                  :style="{
                    height: trackHeight + 'px',
                    minHeight: trackHeight + 'px',
                    '--row-font-size': trackNameFontSize + 'px'
                  }"
                  draggable="true"
                  @click.stop="selectTimeline(id)"
                  @dragstart="dragStart($event, id)"
                  @dragend="dragEnd"
                  @dragover="dragOver"
                  @drop="dragDrop($event, id)"
                >
                  <template #title>
                    <div class="track-name-wrap">
                      <span
                        :ref="
                          (el) => {
                            if (el) trackNameRefs[id] = el
                          }
                        "
                        class="track-name-text"
                        >{{ timeline.name }}</span
                      >

                      <div v-if="overflowingTracks[id]" class="track-name-popover">
                        {{ timeline.name }}
                      </div>
                    </div>
                  </template>

                  <template #append>
                    <v-list-item-action start>
                      <v-btn
                        v-if="timeline.categories"
                        v-tooltip="{
                          text: timeline.visible
                            ? $t('components.timelines.tooltips.hideCategories')
                            : $t('components.timelines.tooltips.showCategories'),
                          location: 'bottom'
                        }"
                        icon
                        variant="text"
                        density="compact"
                        :aria-label="
                          timeline.visible
                            ? $t('components.timelines.tooltips.hideCategories')
                            : $t('components.timelines.tooltips.showCategories')
                        "
                        @click="timeline.visible = !timeline.visible"
                      >
                        <v-icon :size="trackIconSize">mdi-expand-all</v-icon>
                      </v-btn>

                      <v-btn
                        v-tooltip="{
                          text: $t('components.timelines.tooltips.lockTrack'),
                          location: 'bottom'
                        }"
                        icon
                        variant="text"
                        density="compact"
                        :aria-label="$t('components.timelines.tooltips.lockTrack')"
                        @click.stop="toggleTimelineLock(id)"
                      >
                        <v-icon :size="trackIconSize">{{
                          undoableStore.getTimelineById(id).locked
                            ? 'mdi-lock'
                            : 'mdi-lock-open-outline'
                        }}</v-icon>
                      </v-btn>

                      <v-menu>
                        <template #activator="{ props }">
                          <v-btn
                            v-tooltip="{
                              text: $t('components.timelines.tooltips.timelineOptions'),
                              location: 'bottom'
                            }"
                            variant="text"
                            density="compact"
                            icon
                            :aria-label="$t('components.timelines.tooltips.timelineOptions')"
                            v-bind="props"
                          >
                            <v-icon :size="trackIconSize">mdi-dots-vertical</v-icon>
                          </v-btn>
                        </template>

                        <v-list class="pb-0 pt-0">
                          <v-list-item
                            v-tooltip="{
                              text: $t('components.timelines.tooltips.duplicateTrack'),
                              location: 'right'
                            }"
                            :title="$t('pages.video.timelines.duplicate')"
                            @click="duplicateTimeline(id)"
                          ></v-list-item>

                          <v-list-item
                            v-tooltip="{
                              text: $t('components.timelines.tooltips.deleteTrack'),
                              location: 'right'
                            }"
                            :title="$t('pages.video.timelines.delete')"
                            @click="deleteTimeline(id)"
                          ></v-list-item>

                          <v-list-item
                            v-tooltip="{
                              text: $t('components.timelines.tooltips.renameTrack'),
                              location: 'right'
                            }"
                            :title="$t('pages.video.timelines.rename')"
                            @click="renameDialogOpen(id)"
                          ></v-list-item>

                          <v-list-item
                            v-tooltip="{
                              text: $t('components.timelines.tooltips.linkVocabularyToTrack'),
                              location: 'right'
                            }"
                            :title="$t('pages.video.timelines.linkVocabulary')"
                            :disabled="!canLinkVocabulary(id)"
                            @click="linkVocabDialogOpen(id)"
                          ></v-list-item>

                          <v-list-item
                            v-tooltip="{
                              text: $t('components.timelines.tooltips.hideTrack'),
                              location: 'right'
                            }"
                            :title="$t('pages.video.timelines.hideTrack')"
                            @click="toggleTimelineHidden(id)"
                          ></v-list-item>
                        </v-list>
                      </v-menu>
                    </v-list-item-action>
                  </template>
                </v-list-item>
              </template>

              <template v-if="timeline.categories">
                <v-list class="pb-0 pt-0" :opened="openedItems">
                  <v-list-group
                    v-for="category in timeline.categories"
                    :key="category.id"
                    :value="category.id"
                  >
                    <template #activator>
                      <v-list-item
                        class="bg-surface-light border-t-sm category-header-row"
                        :style="{
                          height: categoryHeaderHeight + 'px',
                          minHeight: categoryHeaderHeight + 'px',
                          '--row-font-size': categoryNameFontSize + 'px'
                        }"
                        @click="category.visible = !category.visible"
                      >
                        <template #title>
                          <div class="track-name-wrap">
                            <span
                              :ref="
                                (el) => {
                                  if (el) trackNameRefs[category.id] = el
                                }
                              "
                              class="track-name-text"
                              >{{ category.name }}</span
                            >

                            <div v-if="overflowingTracks[category.id]" class="track-name-popover">
                              {{ category.name }}
                            </div>
                          </div>
                        </template>
                      </v-list-item>
                    </template>

                    <v-list-item
                      v-for="tag in category.tags"
                      :key="tag.id"
                      :title="tag.name"
                      class="border-t-sm"
                      :style="{
                        height: trackHeight + 'px',
                        minHeight: trackHeight + 'px',
                        '--row-font-size': trackNameFontSize + 'px'
                      }"
                    >
                    </v-list-item>
                  </v-list-group>
                </v-list>
              </template>
            </v-list-group>

            <v-list-item v-tooltip="$t('pages.video.timelines.addTrack')" @click="addTimeline">
              <v-icon>mdi-playlist-plus</v-icon>
            </v-list-item>

            <v-list-item v-if="hiddenTimelineIds.length > 0">
              <v-menu>
                <template #activator="{ props }">
                  <v-btn
                    variant="text"
                    density="compact"
                    prepend-icon="mdi-eye-off-outline"
                    :aria-label="
                      $t('pages.video.timelines.hiddenTracks', {
                        count: hiddenTimelineIds.length
                      })
                    "
                    v-bind="props"
                  >
                    {{
                      $t('pages.video.timelines.hiddenTracks', { count: hiddenTimelineIds.length })
                    }}
                  </v-btn>
                </template>

                <v-list>
                  <v-list-item
                    v-for="id in hiddenTimelineIds"
                    :key="id"
                    v-tooltip="{
                      text: $t('components.timelines.tooltips.showTrack'),
                      location: 'right'
                    }"
                    :title="undoableStore.getTimelineById(id)?.name"
                    append-icon="mdi-eye"
                    @click="toggleTimelineHidden(id)"
                  ></v-list-item>
                </v-list>
              </v-menu>
            </v-list-item>
          </v-list>
        </template>

        <template #panel2>
          <TimelineCanvas ref="timelineCanvas"></TimelineCanvas>
        </template>
      </SplitterContainer>
        </div>
      </div>
    </div>

    <div id="timelineScrollbarContainer"></div>

    <v-dialog v-model="renameDialog" persistent max-width="400">
      <v-card>
        <v-card-title>{{ $t('pages.video.timelines.renameTimelineTitle') }}</v-card-title>

        <v-card-text>
          <v-text-field
            v-model="timelineName"
            :label="$t('pages.video.timelines.newTimelineName')"
          ></v-text-field>
        </v-card-text>

        <v-card-actions>
          <v-btn color="warning" @click="renameDialog = false">{{ $t('common.cancel') }}</v-btn>

          <v-btn color="primary" @click="renameTimeline">{{ $t('common.save') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="linkVocabDialog" persistent max-width="400">
      <v-card>
        <v-card-title>{{ $t('pages.video.timelines.linkVocabularyTitle') }}</v-card-title>

        <v-card-text>
          <v-select
            v-model="selectedVocab"
            :label="$t('pages.video.timelines.selectVocabulary')"
            :items="vocabularies"
          ></v-select>
        </v-card-text>

        <v-card-actions>
          <v-btn color="warning" @click="linkVocabDialog = false">{{ $t('common.cancel') }}</v-btn>

          <v-btn color="primary" @click="linkVocab">{{ $t('common.save') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-sheet>
</template>

<script>
import { mapStores } from 'pinia'

import SplitterContainer from '@renderer/components/SplitterContainer.vue'
import TimelineCanvas from '@renderer/components/TimelineCanvas.vue'
import api from '@renderer/api'
import shortcuts from '@renderer/shortcuts'
import { toRaw } from 'vue'
import { useMainStore } from '@renderer/stores/main'
import { useTempStore } from '@renderer/stores/temp'
import { useUndoableStore } from '@renderer/stores/undoable'

const BASE_TRACK_HEIGHT = 49
const CATEGORY_HEADER_HEIGHT = 27

export default {
  name: 'Timelines',
  components: { SplitterContainer, TimelineCanvas },

  data() {
    return {
      linkVocabDialog: false,
      overflowingTracks: {},
      renameDialog: false,
      selectedTimeline: null,
      selectedVocab: null,
      timelineName: '',
      trackListResizeObserver: null,
      trackNameRefs: {}
    }
  },

  computed: {
    ...mapStores(useMainStore, useTempStore, useUndoableStore),

    categoryHeaderHeight() {
      return CATEGORY_HEADER_HEIGHT
    },

    categoryNameFontSize() {
      return Math.max(10, Math.round(16 * (CATEGORY_HEADER_HEIGHT / BASE_TRACK_HEIGHT)))
    },

    hiddenTimelineIds() {
      return Object.keys(this.tempStore.timelinesFold).filter(
        (id) => this.undoableStore.getTimelineById(id)?.hidden
      )
    },

    inPointSettable() {
      const timeline = this.undoableStore.getTimelineById(this.tempStore.selectedTimelineId)
      return Boolean(timeline) && timeline.type === 'shots' && !timeline.locked
    },

    openedItems() {
      const openedTimelines = Object.entries(this.tempStore.timelinesFold)
        .filter((e) => e[1].visible)
        .map((e) => e[0])
      const openedCategories = Object.values(this.tempStore.timelinesFold)
        .filter((v) => v.categories)
        .map((v) => v.categories.filter((c) => c.visible).map((c) => c.id))
        .flat()
      return openedTimelines.concat(openedCategories)
    },

    outPointSettable() {
      return Boolean(this.tempStore.tmpShot?.ioPending)
    },

    segmentAddable() {
      return this.newSegmentBounds() !== null
    },

    segmentDeletable() {
      return this.tempStore.selectedSegments.size > 0 && !this.segmentsLocked
    },

    segmentMergable() {
      if (this.tempStore.selectedSegments.size <= 1 || this.segmentsLocked) return false
      const timeline = this.undoableStore.timelines.filter(
        (t) => t.id === this.tempStore.selectedSegments.values().next().value
      )[0]
      if (timeline.type !== 'shots') return false

      const timelineDataIds = timeline.data.map((d) => d.id)
      const indices = Array.from(this.tempStore.selectedSegments.keys())
        .map((s) => timelineDataIds.indexOf(s))
        .sort((a, b) => a - b)
      return indices[indices.length - 1] - indices[0] === indices.length - 1
    },

    segmentSplitable() {
      if (this.tempStore.selectedSegments.size !== 1 || this.segmentsLocked) return false
      const playFps = Math.round(this.tempStore.playPosition * this.mainStore.fps)
      const [shotid, timelineid] = this.tempStore.selectedSegments.entries().next().value
      const segment = this.undoableStore.getSegmentForId(timelineid, shotid)
      return segment.start < playFps && segment.end > playFps
    },

    segmentsLocked() {
      return Array.from(this.tempStore.selectedSegments.entries())
        .map(([shotId, timelineId]) => {
          const timeline = this.undoableStore.getTimelineById(timelineId)
          return timeline.locked || this.undoableStore.getSegmentForId(timelineId, shotId).locked
        })
        .some((v) => v)
    },

    selectedTimelineId() {
      return this.tempStore.selectedTimelineId
    },

    shotTimelinesExists() {
      return this.undoableStore.timelines.filter((t) => t.type === 'shots').length > 0
    },

    trackHeight() {
      return Math.round(BASE_TRACK_HEIGHT * this.tempStore.trackScale)
    },

    trackNameFontSize() {
      return Math.max(10, Math.round(16 * (this.trackHeight / BASE_TRACK_HEIGHT)))
    },

    trackIconSize() {
      return Math.max(12, Math.round(20 * (this.trackHeight / BASE_TRACK_HEIGHT)))
    },

    visibleTimelinesFold() {
      return Object.fromEntries(
        Object.entries(this.tempStore.timelinesFold).filter(
          ([id]) => !this.undoableStore.getTimelineById(id)?.hidden
        )
      )
    },

    vocabularies() {
      return this.undoableStore.vocabularies.map((v) => ({ title: v.name, value: v.id }))
    },

    vocabularyExists() {
      return this.undoableStore.vocabularies.length > 0
    }
  },

  watch: {
    'undoableStore.timelines.length'(newVal, oldVal) {
      if (newVal !== oldVal) {
        this.createTimelineFolds()
        this.checkTrackNameOverflow()
      }
    },

    'undoableStore.vocabularies': {
      deep: true,

      handler() {
        this.createTimelineFolds()
      }
    }
  },

  mounted() {
    this.checkTrackNameOverflow()
    this.trackListResizeObserver = new ResizeObserver(() => this.checkTrackNameOverflow())
    this.trackListResizeObserver.observe(document.getElementById('timeline-list'))
    // Register shorcuts and menu actions
    shortcuts.register('Delete', this.segmentDelete)
    shortcuts.register('Backspace', this.segmentDelete)
    shortcuts.register('m', this.segmentMerge)
    shortcuts.register('c', this.segmentSplit)
    api.onSegmentDelete(this.segmentDelete)
    api.onSegmentMerge(this.segmentMerge)
    api.onSegmentSplit(this.segmentSplit)
    this.createTimelineFolds()
  },

  beforeUnmount() {
    this.trackListResizeObserver?.disconnect()
    for (const key of ['m', 'c', 'Delete', 'Backspace']) {
      shortcuts.clear(key)
    }
  },

  methods: {
    addTimeline() {
      this.undoableStore.addNewTimeline()
    },

    canLinkVocabulary(timelineId) {
      const timeline = this.undoableStore.getTimelineById(timelineId)

      return !(
        !this.vocabularyExists ||
        typeof timeline.vocabulary === 'string' ||
        timeline.type !== 'shots'
      )
    },

    checkTrackNameOverflow() {
      this.$nextTick().then(() => {
        const overflowing = {}
        for (const [id, el] of Object.entries(this.trackNameRefs)) {
          overflowing[id] = el.scrollWidth > el.offsetWidth
        }
        this.overflowingTracks = overflowing
      })
    },

    createTimelineFolds() {
      this.tempStore.timelinesFold = Object.fromEntries(
        this.undoableStore.timelines.map((t) => {
          if (typeof t.vocabulary !== 'string') {
            return [t.id, { name: t.name, visible: false }]
          }
          const categories = structuredClone(
            toRaw(this.undoableStore.vocabularies.find((v) => v.id === t.vocabulary).categories)
          )
          categories.forEach((c) => {
            c.visible = false
          })
          return [t.id, { categories, name: t.name, visible: false }]
        })
      )
    },

    deleteTimeline(id) {
      this.undoableStore.deleteTimeline(id)
    },

    dragDrop(e, id) {
      e.preventDefault()
      const draggedId = e.dataTransfer.getData('text/plain')
      if (draggedId !== id) {
        const index = this.undoableStore.timelines.findIndex((t) => t.id === id)
        this.undoableStore.reorderTimelines(draggedId, index)
        this.createTimelineFolds()
      }
    },

    dragEnd(e) {
      e.target.style.opacity = '1'
    },

    dragOver(e) {
      e.preventDefault()
    },

    dragStart(e, id) {
      e.dataTransfer.setData('text/plain', id)
      e.dataTransfer.effectAllowed = 'move'
      e.target.style.opacity = '0.5'
    },

    duplicateTimeline(id) {
      this.undoableStore.duplicateTimeline(id)
    },

    linkVocab() {
      this.undoableStore.linkTimelineToVocabulary(this.selectedTimeline, this.selectedVocab)
      this.linkVocabDialog = false
      this.createTimelineFolds()
    },

    linkVocabDialogOpen(id) {
      this.linkVocabDialog = true
      this.selectedTimeline = id
      this.selectedVocab = null
    },

    newSegmentBounds() {
      const timeline = this.undoableStore.getTimelineById(this.tempStore.selectedTimelineId)
      if (!timeline || timeline.type !== 'shots' || timeline.locked) return null
      const start = Math.round(this.tempStore.playPosition * this.mainStore.fps)
      if (timeline.data.some((s) => s.start <= start && s.end >= start)) return null
      const nextStarts = timeline.data.filter((s) => s.start > start).map((s) => s.start - 1)
      const end = Math.min(
        start + Math.round(this.mainStore.fps * 10),
        this.mainStore.numFrames - 1,
        ...nextStarts
      )
      return end > start ? { end, start, timelineId: timeline.id } : null
    },

    renameDialogOpen(id) {
      this.timelineName = ''
      this.renameDialog = true
      this.selectedTimeline = id
    },

    renameTimeline() {
      this.undoableStore.renameTimeline(this.selectedTimeline, this.timelineName)
      this.renameDialog = false
      this.createTimelineFolds()
      this.checkTrackNameOverflow()
    },

    segmentAdd() {
      const bounds = this.newSegmentBounds()
      if (bounds === null) return
      const index = this.undoableStore.timelines.findIndex((t) => t.id === bounds.timelineId)
      this.undoableStore.addShotToNth(index, bounds.start, bounds.end)
    },

    segmentDelete() {
      if (!this.segmentDeletable) return
      const segments = this.tempStore.selectedSegments
      this.undoableStore.deleteSegments(segments.values().next().value, Array.from(segments.keys()))
      this.tempStore.selectedSegments = new Map()
    },

    segmentMerge() {
      if (!this.segmentMergable) return
      const segments = this.tempStore.selectedSegments
      this.undoableStore.mergeSegments(segments.values().next().value, Array.from(segments.keys()))
      this.tempStore.selectedSegments = new Map()
    },

    segmentSplit() {
      if (!this.segmentSplitable) return
      const [shotid, timelineid] = this.tempStore.selectedSegments.entries().next().value
      this.undoableStore.splitSegment(
        timelineid,
        shotid,
        Math.round(this.tempStore.playPosition * this.mainStore.fps)
      )
      this.tempStore.selectedSegments = new Map()
    },

    selectTimeline(id) {
      this.tempStore.selectedSegments = new Map()
      this.tempStore.activeTimelineId = id
    },

    toggleTimelineHidden(id) {
      const timeline = this.undoableStore.getTimelineById(id)
      timeline.hidden = !timeline.hidden
    },

    toggleTimelineLock(id) {
      const timeline = this.undoableStore.getTimelineById(id)
      timeline.locked = !timeline.locked
    }
  }
}
</script>

<style scoped>
.track-height-slider {
  width: 130px;
}

.segment-toolbar {
  border-right: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  flex-shrink: 0;
  padding: 4px 0;
  width: 36px;
}

.track-height-control {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.track-height-slider-popup {
  display: none;
  position: absolute;
  left: 100%;
  top: 50%;
  transform: translateY(-50%);
  z-index: 100;
  align-items: center;
  padding: 4px 8px;
  background-color: rgb(var(--v-theme-surface));
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.track-height-control:hover .track-height-slider-popup {
  display: flex;
}

.track-height-slider :deep(> .v-input__control) {
  min-width: 80px;
}

.track-group-separator {
  box-shadow: 0 1px 0 0 rgba(var(--v-border-color), var(--v-border-opacity));
}

.category-header-row {
  padding-bottom: 0;
  padding-top: 0;
}

#timeline-list {
  padding-top: 30px;
}

#timelineSplitter {
  /* gap between the timeline and the vertical scrollbar */
  padding-right: 8px;
}

#timelineSplitter::-webkit-scrollbar {
  width: 8px;
}

#timelineSplitter::-webkit-scrollbar-track {
  background: rgba(33, 150, 243, 0.08);
  border-radius: 4px;
}

#timelineSplitter::-webkit-scrollbar-thumb {
  background: #90caf9;
  border-radius: 4px;
}

#timelineScrollbarContainer {
  display: flex;
  justify-content: flex-end;
}

:deep(.active-track) {
  background-color: rgba(var(--v-theme-primary), 0.15);
}

:deep(.active-track .v-list-item-title) {
  font-weight: 600;
}

#timeline-list :deep(.v-list-item-title),
#timeline-list :deep(.v-list-item__content) {
  overflow: visible;
}

#timeline-list :deep(.v-list-item-title) {
  font-size: var(--row-font-size, 1rem);
}

#timeline-list :deep(.v-list-item) {
  padding-top: 0;
  padding-bottom: 0;
  align-items: center;
}

.track-name-wrap {
  position: relative;
}

.track-name-text {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.track-name-popover {
  display: none;
  position: absolute;
  top: 50%;
  left: 0;
  transform: translateY(-50%);
  z-index: 100;
  background-color: rgb(var(--v-theme-surface));
  white-space: normal;
  max-width: 240px;
  padding: 2px 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  border-radius: 3px;
  line-height: 1.4;
}

.track-name-wrap:hover .track-name-popover {
  display: block;
}
</style>
