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
        <v-btn :text="$t('common.export')" @click="exportScreenshot"></v-btn>

        <v-spacer></v-spacer>

        <v-btn :text="$t('common.close')" @click="closeDialog"></v-btn>
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
      posX: 0,
      posY: 0,
      screenshot: null,
      zoom: 1
    }
  },

  computed: {
    ...mapStores(useMainStore, useUndoableStore),

    imageStyle() {
      return {
        transform: `translate(${this.posX}px, ${this.posY}px) scale(${this.zoom})`,
        transformOrigin: '0 0'
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
        this.posX = mouseX - (mouseX - this.posX) * newZoom
        this.posY = mouseY - (mouseY - this.posY) * newZoom
        this.zoom = newZoom
      } else {
        this.posX = 0
        this.posY = 0
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
      this.posX = mouseX - (mouseX - this.posX) * (newZoom / this.zoom)
      this.posY = mouseY - (mouseY - this.posY) * (newZoom / this.zoom)

      this.zoom = newZoom
      if (newZoom === 1) {
        this.posX = 0
        this.posY = 0
      }
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
  max-width: 100%;
  max-height: 60vh;
  transition: transform 0.1s ease;
  cursor: zoom-in;
}
.image.zoomed {
  cursor: zoom-out;
}
.image-container {
  max-height: 60vh;
  max-width: 100%;
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
