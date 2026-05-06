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
