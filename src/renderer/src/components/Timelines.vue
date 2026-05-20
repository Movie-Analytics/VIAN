<template>
  <v-sheet class="d-flex flex-1-1 flex-column height-min-0">
    <div>
      <span
        v-tooltip="{
          text: $t('components.timelines.tooltips.deleteSelectedSegment'),
          location: 'bottom'
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
          location: 'bottom'
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
          location: 'bottom'
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
    </div>

    <div id="timelineAxesContainer"></div>

    <div id="timelineSplitter" class="overflow-y-auto">
      <SplitterContainer :inital-panel1-percent="30" class="overflow-y-auto">
        <template #panel1>
          <v-list
            id="timeline-list"
            lines="one"
            class="height-fit-content pt-0 w-100"
            :opened="openedItems"
          >
            <v-list-group
              v-for="(timeline, id) in tempStore.timelinesFold"
              :key="id"
              :value="id"
              class="border-b-sm"
            >
              <template #activator>
                <v-list-item
                  class="pr-2"
                  :class="[{ 'active-track': id === selectedTimelineId }]"
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
                        <v-icon>mdi-expand-all</v-icon>
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
                        <v-icon size="x-small">{{
                          undoableStore.getTimelineById(id).locked
                            ? 'mdi-lock'
                            : 'mdi-lock-open-outline'
                        }}</v-icon>
                      </v-btn>

                      <v-menu>
                        <template #activator="{ props }">
                          <v-btn variant="text" density="compact" icon v-bind="props">
                            <v-icon>mdi-dots-vertical</v-icon>
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
                        class="border-t-sm mt-1px"
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
                      class="border-t-sm mt-1px"
                    >
                    </v-list-item>
                  </v-list-group>
                </v-list>
              </template>
            </v-list-group>

            <v-list-item v-tooltip="$t('pages.video.timelines.addTrack')" @click="addTimeline">
              <v-icon>mdi-playlist-plus</v-icon>
            </v-list-item>
          </v-list>
        </template>

        <template #panel2>
          <TimelineCanvas></TimelineCanvas>
        </template>
      </SplitterContainer>
    </div>

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
    shortcuts.register('s', this.segmentSplit)
    api.onSegmentDelete(this.segmentDelete)
    api.onSegmentMerge(this.segmentMerge)
    api.onSegmentSplit(this.segmentSplit)
    this.createTimelineFolds()
  },

  beforeUnmount() {
    this.trackListResizeObserver?.disconnect()
    for (const key of ['m', 's', 'Delete', 'Backspace']) {
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

    toggleTimelineLock(id) {
      const timeline = this.undoableStore.getTimelineById(id)
      timeline.locked = !timeline.locked
    }
  }
}
</script>

<style scoped>
#timeline-list {
  padding-top: 30px;
}

#timelineSplitter::-webkit-scrollbar {
  width: 8px;
}

#timelineSplitter::-webkit-scrollbar-track {
  background: #e0e0e0;
  border-radius: 4px;
}

#timelineSplitter::-webkit-scrollbar-thumb {
  background: #aaaaaa;
  border-radius: 4px;
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
