<template>
  <v-sheet class="d-flex flex-1-1 flex-column height-min-0">
    <div>
      <v-tooltip
        :text="$t('components.timelines.tooltips.deleteSelectedSegment')"
        location="bottom"
      >
        <template #activator="{ props }">
          <span v-bind="props">
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
        </template>
      </v-tooltip>

      <v-tooltip :text="$t('components.timelines.tooltips.splitSelectedSegment')" location="bottom">
        <template #activator="{ props }">
          <span v-bind="props">
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
        </template>
      </v-tooltip>

      <v-tooltip
        :text="$t('components.timelines.tooltips.mergeSelectedSegments')"
        location="bottom"
      >
        <template #activator="{ props }">
          <span v-bind="props">
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
        </template>
      </v-tooltip>
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
                  :title="timeline.name"
                  class="pr-2"
                  draggable="true"
                  @dragstart="dragStart($event, id)"
                  @dragend="dragEnd"
                  @dragover="dragOver"
                  @drop="dragDrop($event, id)"
                >
                  <template #append>
                    <v-list-item-action start>
                      <v-tooltip
                        v-if="timeline.categories"
                        :text="
                          timeline.visible
                            ? $t('components.timelines.tooltips.hideCategories')
                            : $t('components.timelines.tooltips.showCategories')
                        "
                        location="bottom"
                      >
                        <template #activator="{ props }">
                          <v-btn
                            icon
                            variant="text"
                            density="compact"
                            v-bind="props"
                            :aria-label="
                              timeline.visible
                                ? $t('components.timelines.tooltips.hideCategories')
                                : $t('components.timelines.tooltips.showCategories')
                            "
                            @click="timeline.visible = !timeline.visible"
                          >
                            <v-icon>mdi-expand-all</v-icon>
                          </v-btn>
                        </template>
                      </v-tooltip>

                      <v-menu>
                        <template #activator="{ props }">
                          <v-btn variant="text" density="compact" icon v-bind="props">
                            <v-icon>mdi-dots-vertical</v-icon>
                          </v-btn>
                        </template>

                        <v-list class="pb-0 pt-0">
                          <v-list-item
                            :title="$t('pages.video.timelines.duplicate')"
                            @click="duplicateTimeline(id)"
                          ></v-list-item>

                          <v-list-item
                            :title="$t('pages.video.timelines.delete')"
                            @click="deleteTimeline(id)"
                          ></v-list-item>

                          <v-list-item
                            :title="$t('pages.video.timelines.rename')"
                            @click="renameDialogOpen(id)"
                          ></v-list-item>

                          <v-list-item
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
                        :title="category.name"
                        @click="category.visible = !category.visible"
                      ></v-list-item>
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
      renameDialog: false,
      selectedTimeline: null,
      selectedVocab: null,
      timelineName: ''
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
        .map((shot) => this.undoableStore.getSegmentForId(shot[1], shot[0]).locked)
        .some((v) => v)
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
    }
  }
}
</script>

<style scoped>
#timeline-list {
  padding-top: 30px;
}
</style>
