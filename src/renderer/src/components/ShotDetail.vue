<template>
  <div>
    <p v-if="tempStore.selectedSegments.size == 0">
      {{ $t('components.shotDetail.noSelection') }}
    </p>

    <v-sheet v-else-if="selectedTimelineSegment !== null">
      <div v-if="selectedTimelineSegment.image">
        <v-img :src="selectedTimelineSegment.image" @dblclick="imageClicked" />
      </div>

      <div v-else>
        <p class="font-weight-bold">{{ $t('components.shotDetail.shotLabel') }}</p>
        {{ mainStore.timeReadableFrame(selectedTimelineSegment.start) }} -
        {{ mainStore.timeReadableFrame(selectedTimelineSegment.end) }}

        <v-textarea
          v-model="annotationBuffer"
          :disabled="segmentLocked"
          :label="$t('components.shotDetail.annotationsLabel')"
          rows="1"
          max-rows="3"
          auto-grow
        ></v-textarea>

        <div v-if="segmentVocabulary">
          <p>{{ $t('components.shotDetail.linkedVocabulary') }}: {{ segmentVocabulary.name }}</p>

          <v-autocomplete
            v-model="selectedTimelineSegment.vocabAnnotation"
            :items="vocabularyItems"
            :label="$t('components.shotDetail.vocabularyAnnotationsLabel')"
            chips
            clearable
            multiple
          ></v-autocomplete>
        </div>

        <v-checkbox
          v-model="selectedTimelineSegment.locked"
          :disabled="
            undoableStore.getTimelineById(tempStore.selectedSegments.values().next().value).locked
          "
        >
          <template #label>
            <div>
              {{ $t('components.shotDetail.lockSegment') }}
              <v-btn
                v-tooltip="{
                  text: $t('components.shotDetail.lockHelp'),
                  location: 'bottom'
                }"
                density="compact"
                variant="text"
                icon
                :aria-label="$t('components.shotDetail.lockHelp')"
              >
                <v-icon>mdi-information-outline</v-icon>
              </v-btn>
            </div>
          </template>
        </v-checkbox>
      </div>
    </v-sheet>

    <p v-else>{{ $t('components.shotDetail.multipleSelected') }}</p>

    <ImageDialog ref="imageDialog"></ImageDialog>
  </div>
</template>

<script>
import ImageDialog from '@renderer/components/ImageDialog.vue'
import { mapStores } from 'pinia'
import { useMainStore } from '@renderer/stores/main'
import { useTempStore } from '@renderer/stores/temp'
import { useUndoableStore } from '@renderer/stores/undoable'

export default {
  name: 'ShotDetail',
  components: { ImageDialog },

  data: () => ({
    annotationBuffer: '',
    timeout: null
  }),

  computed: {
    ...mapStores(useMainStore, useUndoableStore, useTempStore),

    currentAnnotation() {
      return this.selectedTimelineSegment?.annotation
    },

    segmentLocked() {
      if (this.tempStore.selectedSegments.size !== 1) return false
      const [shotid, timelineid] = this.tempStore.selectedSegments.entries().next().value
      const timeline = this.undoableStore.getTimelineById(timelineid)
      return Boolean(
        timeline.locked || this.undoableStore.getSegmentForId(timelineid, shotid).locked
      )
    },

    segmentVocabulary() {
      if (this.tempStore.selectedSegments.size !== 1) return null
      const timelineid = this.tempStore.selectedSegments.values().next().value
      const timeline = this.undoableStore.getTimelineById(timelineid)
      if (typeof timeline.vocabulary !== 'string') return null
      return this.undoableStore.vocabularies.find((v) => v.id === timeline.vocabulary)
    },

    selectedTimelineSegment() {
      if (this.tempStore.selectedSegments.size !== 1) return null
      const [shotid, timelineid] = this.tempStore.selectedSegments.entries().next().value
      return this.undoableStore.getSegmentForId(timelineid, shotid)
    },

    vocabularyItems() {
      if (this.segmentVocabulary === null) return []
      return this.segmentVocabulary.categories
        .map((c) => [
          { title: c.name, type: 'subheader' },
          c.tags.map((t) => ({ title: t.name, value: t.id }))
        ])
        .flat(2)
    }
  },

  watch: {
    annotationBuffer(newValue) {
      if (newValue === this.selectedTimelineSegment?.annotation) return

      clearTimeout(this.timeout)

      this.timeout = setTimeout(() => {
        if (this.selectedTimelineSegment) {
          this.selectedTimelineSegment.annotation = newValue
        }
        this.timeout = null
      }, 1000)
    },

    currentAnnotation(newValue) {
      if (newValue !== null) {
        this.annotationBuffer = newValue
      }
    },

    selectedTimelineSegment: {
      deep: true,

      handler(newValue) {
        if (newValue) {
          this.annotationBuffer = newValue.annotation
        }
      }
    }
  },

  methods: {
    imageClicked() {
      this.$refs.imageDialog.show(this.selectedTimelineSegment)
    }
  }
}
</script>
