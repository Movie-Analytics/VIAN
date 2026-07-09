import { defineStore } from 'pinia'

import api from '@renderer/api'
import { useUndoableStore } from './undoable'

export const useMainStore = defineStore('main', {
  state: () => ({
    fps: null,
    height: null,
    id: null,
    numFrames: null,
    video: null,
    videoDuration: null,
    width: null
  }),
  /* eslint-disable-next-line vue/sort-keys */
  actions: {
    initialize() {
      this.$subscribe((mutation, state) => {
        if (this.id === null) return
        const copyState = JSON.parse(JSON.stringify(state))
        api.saveStore('main', copyState)
      })
      // Set up listener
      api.onVideoInfo((data) => {
        this.fps = data.fps
        this.height = data.height
        this.numFrames = data.numFrames
        this.width = data.width
      })
    },
    async loadStore(projectId) {
      const state = await api.loadStore('main', projectId)
      if (state !== null) {
        this.$patch(state)
      }
    },
    openVideo(id, video) {
      // TODO could become race condition, meta or backend should create file
      // and then just loadProject
      const undoableStore = useUndoableStore()
      this.id = id
      undoableStore.id = id
      this.video = video

      if (this.video !== null) {
        api.getVideoInfo(this.video, this.id)
      }
    },
    timeReadableFrame(frame, framenum = false) {
      const totalSeconds = frame / this.fps
      return this.timeReadableSec(totalSeconds, framenum)
    },
    timeReadableSec(t, framenum = false) {
      const hours = Math.floor(t / 3600)
      const minutes = Math.floor((t % 3600) / 60)
      const seconds = Math.floor(t % 60)
      const frame =
        ':' +
        Math.floor((t % 1) * this.fps)
          .toString()
          .padStart(2, '0')
      const frameString = framenum ? frame : ''

      const formattedHours = String(hours).padStart(2, '0')
      const formattedMinutes = String(minutes).padStart(2, '0')
      const formattedSeconds = String(seconds).padStart(2, '0')

      return `${formattedHours}:${formattedMinutes}:${formattedSeconds}${frameString}`
    }
  }
})
