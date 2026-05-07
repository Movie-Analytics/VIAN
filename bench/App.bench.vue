<template>
  <TimelineCanvas ref="tc" />
</template>

<script>
import * as d3 from 'd3'
import TimelineCanvas from '@renderer/components/TimelineCanvas.vue'

export default {
  name: 'BenchApp',
  components: { TimelineCanvas },

  mounted() {
    // DrawSetup() and resize() run synchronously in mounted().
    // One rAF tick lets the canvas lay out and the initial draw complete.
    requestAnimationFrame(() => {
      const tc = this.$refs.tc

      window.bench = {
        clearSelection() {
          tc.tempStore.selectedSegments = new Map()
        },

        lockTimelines(n) {
          for (let i = 0; i < tc.undoableStore.timelines.length; i += 1) {
            tc.undoableStore.timelines[i].locked = i < n
          }
          tc.drawSetup()
        },

        runDraw(n) {
          const times = []
          for (let i = 0; i < n; i += 1) {
            const t0 = performance.now()
            tc.draw()
            times.push(performance.now() - t0)
          }
          return times
        },

        selectSegments(n) {
          const entries = tc.data.slice(0, n).map((d) => [d.id, d.timeline])
          tc.tempStore.selectedSegments = new Map(entries)
        },

        setPan(x) {
          tc.transform = d3.zoomIdentity.translate(x, 0).scale(tc.transform.k)
        },

        // Simulate a segment being dragged: sets tmpShot with moving=true so
        // the original segment is filtered from visibleData each draw call.
        setTmpShot(active) {
          if (!active) {
            tc.tempStore.tmpShot = null
            tc.tempStore.adjacentShot = null
            return
          }
          const seg = tc.data.find((d) => d.type === 'shots')
          if (!seg) return
          tc.tempStore.tmpShot = {
            end: seg.x + seg.width - 1,
            height: 49,
            invalid: false,
            moving: true,
            originalShot: { id: seg.id },
            start: seg.x,
            y: seg.y
          }
          tc.tempStore.adjacentShot = null
        },

        setZoom(k) {
          tc.transform = d3.zoomIdentity.scale(k)
        }
      }

      window.benchReady = true
    })
  }
}
</script>
