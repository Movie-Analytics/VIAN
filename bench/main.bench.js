import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createVuetify } from 'vuetify'
import { i18n } from '@renderer/i18n'
import BenchApp from './App.bench.vue'
import { useMainStore } from '@renderer/stores/main'
import { useTempStore } from '@renderer/stores/temp'
import { useUndoableStore } from '@renderer/stores/undoable'

// 3-hour video at 24fps, shots averaging ~5 seconds with ±50% random variation
const FPS = 24
const TOTAL_FRAMES = 3 * 3600 * FPS // 259,200
const NUM_TIMELINES = 20
const AVG_SHOT_FRAMES = 5 * FPS // 120 frames

function generateTimelines() {
  return Array.from({ length: NUM_TIMELINES }, (_, i) => {
    const data = []
    let frame = 0
    while (frame < TOTAL_FRAMES) {
      const duration = Math.max(FPS, Math.round(AVG_SHOT_FRAMES * (0.5 + Math.random())))
      const end = Math.min(frame + duration - 1, TOTAL_FRAMES - 1)
      data.push({
        annotation: '',
        end,
        id: `tl${i}-s${data.length}`,
        start: frame,
        vocabAnnotation: []
      })
      frame = end + 1
    }
    return {
      data,
      id: `timeline-${i}`,
      locked: false,
      name: `Timeline ${i + 1}`,
      type: 'shots',
      vocabulary: null
    }
  })
}

const pinia = createPinia()
const vuetify = createVuetify()
const app = createApp(BenchApp)

app.use(pinia)
app.use(vuetify)
app.use(i18n)

// Populate stores before mount so drawSetup() has data when the component mounts
const mainStore = useMainStore()
const tempStore = useTempStore()
const undoableStore = useUndoableStore()

mainStore.fps = FPS
mainStore.videoDuration = TOTAL_FRAMES
tempStore.selectedSegments = new Map()
undoableStore.timelines = generateTimelines()

app.mount('#app')
