import { defineStore } from 'pinia'

import api from '@renderer/api'
import { useUndoableStore } from './undoable'

export const useTempStore = defineStore('temp', {
  getters: {
    selectedTimelineId: (state) =>
      state.selectedSegments.size > 0
        ? state.selectedSegments.values().next().value
        : state.activeTimelineId
  },
  state: () => ({
    activeTimelineId: null,
    adjacentShot: null,
    imageCache: new Map(),
    jobs: [],
    muted: false,
    playJumpPosition: null,
    playPosition: 0,
    // Maps shot id -> timeline id
    selectedSegments: new Map(),
    timelinesFold: {},
    tmpShot: null,
    trackScale: 1
  }),
  /* eslint-disable-next-line vue/sort-keys */
  actions: {
    exportSelectedScreenshots(projectId) {
      const undoableStore = useUndoableStore()
      const timelineId = this.selectedTimelineId
      const frames = Array.from(this.selectedSegments.keys()).map(
        (id) => undoableStore.getSegmentForId(timelineId, id).frame
      )
      api.exportScreenshots(projectId, frames, [timelineId])
    },
    initialize() {
      api.onJobsUpdate((data) => {
        this.jobs = data
      })
    },
    async login(email, password) {
      return await api.login(email, password)
    },
    selectSegmentAtFrame(frame) {
      // Leave multi-selections alone
      if (this.selectedSegments.size > 1) return
      const timeline = useUndoableStore().getTimelineById(this.selectedTimelineId)
      // Adjacent shots can share a boundary frame, prefer the later one
      const segment = timeline?.data.findLast((s) => s.start <= frame && frame <= s.end)
      if (!segment || this.selectedSegments.has(segment.id)) return
      this.selectedSegments = new Map([[segment.id, timeline.id]])
    },
    async signup(email, password) {
      const response = await api.signup(email, password)
      if (response) {
        return await this.login(email, password)
      }
      return false
    },
    terminateJob(id) {
      api.terminateJob(id)
    },
    validateSelectedSegments() {
      const { timelines } = useUndoableStore()

      const timelineMap = new Map(timelines.map((t) => [t.id, t]))

      this.selectedSegments = new Map(
        Array.from(this.selectedSegments).filter(([sId, tId]) => {
          const timeline = timelineMap.get(tId)
          return timeline && timeline.data.some((d) => d.id === sId)
        })
      )
    }
  }
})
