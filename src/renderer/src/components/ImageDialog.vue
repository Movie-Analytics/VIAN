<template>
  <v-dialog v-model="isOpen" max-height="90vh" max-width="90vw">
    <v-card :title="title">
      <v-card-text class="container">
        <div class="image-container">
          <img
            :src="screenshot.image"
            class="image"
            draggable="false"
            :class="{ zoomed: zoom != 1, dragging: drag }"
            :style="imageStyle"
            @click="handleZoomClick"
            @pointerdown="handleDragStart"
            @pointermove="handleDragMove"
            @pointerup="handleDragEnd"
            @pointercancel="handleDragEnd"
            @wheel.prevent="handleZoomWheel"
          />

          <div class="zoom-buttons">
            <v-btn
              icon="mdi-magnify-plus-outline"
              size="small"
              :disabled="zoom >= 6"
              @click="changeZoom(0.5)"
            ></v-btn>

            <v-btn
              icon="mdi-magnify-minus-outline"
              size="small"
              :disabled="zoom <= 1"
              @click="changeZoom(-0.5)"
            ></v-btn>
          </div>
        </div>

        <v-list>
          <v-list-item v-for="item in associatedAnnotations" :key="item.timeline" class="item">
            <p class="timeline">{{ item.timeline }}</p>

            <div class="content">
              <v-label v-if="item.annotation" class="annotation ma-1">{{
                item.annotation
              }}</v-label>

              <div class="tags">
                <v-chip v-for="tag in item.vocabAnnotation" :key="tag" class="ma-1">
                  {{ tag }}
                </v-chip>
              </div>
            </div>
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
      drag: null,
      dragMoved: false,
      isOpen: false,
      originX: 50,
      originY: 50,
      panX: 0,
      panY: 0,
      screenshot: null,
      zoom: 1
    }
  },

  computed: {
    ...mapStores(useMainStore, useUndoableStore),

    imageStyle() {
      return {
        transform: `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`,
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
    changeZoom(delta) {
      this.zoom = Math.min(Math.max(1, this.zoom + delta), 6)
      if (this.zoom === 1) {
        this.resetView()
      }
    },

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
      for (const timeline of this.undoableStore.shotTimelines) {
        const screenshotAnnotations = timeline.data.filter((annotation) => {
          if (annotation.start <= this.screenshot.frame && this.screenshot.frame < annotation.end) {
            return true
          }
          return false
        })
        const annotation = screenshotAnnotations[0]?.annotation?.trim()
        const vocabAnnotation = (screenshotAnnotations[0]?.vocabAnnotation ?? [])
          .map((id) => this.undoableStore.vocabById.get(id)?.name)
          .filter(Boolean)
        if (annotation || vocabAnnotation.length) {
          annotations.push({ annotation, timeline: timeline.name, vocabAnnotation })
        }
      }
      this.associatedAnnotations = annotations
    },

    handleDragEnd() {
      this.drag = null
    },

    handleDragMove(e) {
      if (!this.drag) return
      const dx = e.clientX - this.drag.x
      const dy = e.clientY - this.drag.y
      if (!this.dragMoved && Math.hypot(dx, dy) < 3) return
      this.dragMoved = true
      this.panX = this.drag.panX + dx
      this.panY = this.drag.panY + dy
    },

    handleDragStart(e) {
      if (this.zoom === 1) return
      this.dragMoved = false
      this.drag = { panX: this.panX, panY: this.panY, x: e.clientX, y: e.clientY }
      e.target.setPointerCapture(e.pointerId)
    },

    handleZoomClick(e) {
      if (this.dragMoved) {
        this.dragMoved = false
        return
      }
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
        this.resetView()
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
      if (newZoom === 1) {
        this.panX = 0
        this.panY = 0
      }
    },

    resetView() {
      this.originX = 50
      this.originY = 50
      this.panX = 0
      this.panY = 0
      this.zoom = 1
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
.content {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}
.zoom-buttons {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 8px;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  margin-left: auto;
}
.container {
  max-height: calc(90vh - 148px);
  overflow-y: auto;
  padding: 0;
}
.item {
  margin-top: 8px;
  border-radius: 4px !important;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.image {
  object-fit: contain;
  width: 100%;
  max-height: calc(90vh - 148px);
  transition: transform 0.1s ease;
  cursor: zoom-in;
  touch-action: none;
  user-select: none;
}
.image.zoomed {
  cursor: grab;
}
.image.dragging {
  cursor: grabbing;
  transition: none;
}
.image-container {
  position: relative;
  max-width: 100%;
  margin: 0 auto;
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
