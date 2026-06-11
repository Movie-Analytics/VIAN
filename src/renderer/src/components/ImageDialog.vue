<template>
  <v-dialog v-model="isOpen" max-height="90vh" max-width="90vw">
    <v-card :title="title">
      <v-card-text class="container">
        <div class="image-container">
          <img
            :src="screenshot.image"
            class="image"
            :class="{ zoomed: zoom != 1 }"
            :style="imageStyle"
            @click="handleZoomClick"
            @wheel.prevent="handleZoomWheel"
          />
        </div>

        <v-list>
          <v-list-item v-for="item in associatedAnnotations" :key="item.timeline" class="item">
            <p class="timeline">{{ item.timeline }}</p>

            <v-label v-if="item.annotation" class="annotation ma-1">{{ item.annotation }}</v-label>

            <v-list v-if="item.vocabAnnotation.length">
              <v-chip v-for="tag in item.vocabAnnotation" :key="tag" class="ma-1">
                {{ tag }}
              </v-chip>
            </v-list>
          </v-list-item>
        </v-list>
      </v-card-text>

      <v-card-actions>
        <v-btn color="primary" :text="$t('common.export')" @click="exportScreenshot"></v-btn>

        <v-btn color="warning" :text="$t('common.close')" @click="closeDialog"></v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import api from '@renderer/api'
import { mapStores } from 'pinia'
import { useMainStore } from '@renderer/stores/main'
import { useUndoableStore } from '@renderer/stores/undoable'

export default {
  name: 'ImageDialog',

  data() {
    return {
      associatedAnnotations: [],
      isOpen: false,
      originX: 50,
      originY: 50,
      screenshot: null,
      zoom: 1
    }
  },

  computed: {
    ...mapStores(useMainStore, useUndoableStore),

    imageStyle() {
      return {
        transform: `scale(${this.zoom})`,
        transformOrigin: `${this.originX}% ${this.originY}%`
      }
    },

    title() {
      return (
        this.$t('components.imageDialog.screenshotAt') +
        ' ' +
        this.mainStore.timeReadableFrame(this.screenshot.frame, true)
      )
    }
  },

  methods: {
    closeDialog() {
      this.isOpen = false
    },

    exportScreenshot() {
      const screenshot = JSON.parse(JSON.stringify(this.screenshot))
      const associatedAnnotations = JSON.parse(JSON.stringify(this.associatedAnnotations))
      api.exportScreenshot(this.mainStore.id, screenshot, associatedAnnotations)
    },

    getAssociatedAnnotations() {
      const annotations = []
      for (const timeline of this.undoableStore.timelines) {
        const screenshotAnnotations = timeline.data.filter((annotation) => {
          if (annotation.start <= this.screenshot.frame && this.screenshot.frame < annotation.end) {
            return true
          }
          return false
        })
        if (
          screenshotAnnotations.length &&
          (screenshotAnnotations[0].annotation || screenshotAnnotations[0].vocabAnnotation.length)
        ) {
          annotations.push({
            annotation: screenshotAnnotations[0].annotation,
            timeline: timeline.name,
            vocabAnnotation: screenshotAnnotations[0].vocabAnnotation.map(
              (id) => this.undoableStore.vocabById.get(id)?.name
            )
          })
        }
      }
      this.associatedAnnotations = annotations
    },

    handleZoomClick(e) {
      if (this.zoom === 1) {
        const rect = e.target.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top

        const newZoom = 3
        // Adjust position to zoom toward the mouse cursor
        this.originX = (mouseX / rect.width) * 100
        this.originY = (mouseY / rect.height) * 100
        this.zoom = newZoom
      } else {
        this.originX = 50
        this.originY = 50
        this.zoom = 1
      }
    },

    handleZoomWheel(e) {
      const delta = e.deltaY > 0 ? -0.2 : 0.2
      // Limit zoom between 1x and 6x
      const newZoom = Math.min(Math.max(1, this.zoom + delta), 6)

      const imgContainer = document.querySelector('.image-container')
      const rect = imgContainer.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      // Adjust position to zoom toward the mouse cursor
      this.originX = (mouseX / rect.width) * 100
      this.originY = (mouseY / rect.height) * 100

      this.zoom = newZoom
    },

    show(screenshot) {
      this.screenshot = screenshot
      this.getAssociatedAnnotations()
      this.isOpen = true
    }
  }
}
</script>

<style scoped>
.annotation {
  text-wrap: wrap;
}
.container {
  max-height: calc(90vh - 148px);
  overflow-y: auto;
  padding: 4px;
}
.item {
  margin-top: 8px;
  border-radius: 4px !important;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.image {
  object-fit: contain;
  max-height: 100%;
  max-width: 100%;
  transition: transform 0.1s ease;
  cursor: zoom-in;
}
.image.zoomed {
  cursor: zoom-out;
}
.image-container {
  height: 60vh;
  max-height: 60vh;
  max-width: 90%;
  margin: auto;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
}
.timeline {
  width: 100%;
  text-align: center;
}
</style>
