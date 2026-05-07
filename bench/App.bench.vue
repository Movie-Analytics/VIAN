<template>
  <TimelineCanvas ref="tc" />
</template>

<script>
import * as d3 from 'd3'
import TimelineCanvas from '@renderer/components/TimelineCanvas.vue'

export default {
  components: { TimelineCanvas },

  mounted() {
    // drawSetup() and resize() run synchronously in mounted().
    // One rAF tick lets the canvas lay out and the initial draw complete.
    requestAnimationFrame(() => {
      const tc = this.$refs.tc

      window.__bench = {
        setZoom(k) {
          tc.transform = d3.zoomIdentity.scale(k)
        },

        setPan(x) {
          tc.transform = d3.zoomIdentity.translate(x, 0).scale(tc.transform.k)
        },

        selectSegments(n) {
          const entries = tc.data.slice(0, n).map(d => [d.id, d.timeline])
          tc.tempStore.selectedSegments = new Map(entries)
        },

        clearSelection() {
          tc.tempStore.selectedSegments = new Map()
        },

        // Simulate a segment being dragged: sets tmpShot with moving=true so
        // the original segment is filtered from visibleData each draw call.
        setTmpShot(active) {
          if (!active) {
            tc.tempStore.tmpShot = null
            tc.tempStore.adjacentShot = null
            return
          }
          const seg = tc.data.find(d => d.type === 'shots')
          if (!seg) return
          tc.tempStore.tmpShot = {
            start: seg.x,
            end: seg.x + seg.width - 1,
            y: seg.y,
            height: 49,
            moving: true,
            invalid: false,
            originalShot: { id: seg.id },
          }
          tc.tempStore.adjacentShot = null
        },

        // Lock the first n timelines and rebuild the data structure synchronously.
        lockTimelines(n) {
          for (let i = 0; i < tc.undoableStore.timelines.length; i++) {
            tc.undoableStore.timelines[i].locked = i < n
          }
          tc.drawSetup()
        },

        runDraw(n) {
          const times = []
          for (let i = 0; i < n; i++) {
            const t0 = performance.now()
            tc.draw()
            times.push(performance.now() - t0)
          }
          return times
        },
      }

      window.__benchReady = true
    })
  }
}
</script>
