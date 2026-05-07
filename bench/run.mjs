import { createServer } from 'vite'
import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const outputIdx = process.argv.indexOf('--output')
const outputPath = outputIdx !== -1 ? process.argv[outputIdx + 1] : null

const DRAW_N = 100

// Each scenario describes a distinct draw-path to benchmark.
// setup() is called before warmup+measure; state persists into the draw loop.
const SCENARIOS = [
  {
    key: 'zoom22',
    label: 'zoom=22  (~100 shots visible, baseline)',
    setup: () => {
      window.__bench.lockTimelines(0)
      window.__bench.clearSelection()
      window.__bench.setTmpShot(false)
      window.__bench.setZoom(22)
    },
  },
  {
    key: 'zoom1',
    label: 'zoom=1   (fully zoomed out, all ~43k segments in view)',
    setup: () => {
      window.__bench.lockTimelines(0)
      window.__bench.clearSelection()
      window.__bench.setTmpShot(false)
      window.__bench.setZoom(1)
    },
  },
  {
    key: 'zoom100',
    label: 'zoom=100 (~10 shots visible, heavy culling)',
    setup: () => {
      window.__bench.lockTimelines(0)
      window.__bench.clearSelection()
      window.__bench.setTmpShot(false)
      window.__bench.setZoom(100)
    },
  },
  {
    key: 'selection50',
    label: 'zoom=22, 50 segments selected',
    setup: () => {
      window.__bench.lockTimelines(0)
      window.__bench.setTmpShot(false)
      window.__bench.setZoom(22)
      window.__bench.selectSegments(50)
    },
  },
  {
    key: 'tmpshot',
    label: 'zoom=22, one segment being dragged',
    setup: () => {
      window.__bench.lockTimelines(0)
      window.__bench.clearSelection()
      window.__bench.setZoom(22)
      window.__bench.setTmpShot(true)
    },
  },
  {
    key: 'locked20',
    label: 'zoom=22, all 20 timelines locked (stripe rendering)',
    setup: () => {
      window.__bench.clearSelection()
      window.__bench.setTmpShot(false)
      window.__bench.setZoom(22)
      window.__bench.lockTimelines(20)
    },
  },
]

const server = await createServer({
  configFile: resolve(__dirname, 'vite.config.bench.mjs')
})
await server.listen()
const { port } = server.config.server

const browser = await chromium.launch()
const page = await browser.newPage()
await page.setViewportSize({ width: 1920, height: 1080 })
await page.goto(`http://localhost:${port}`)

// Vite triggers a dep-optimization reload on the first run, which destroys the JS
// context mid-flight. Poll manually so we survive the reload.
const deadline = Date.now() + 90_000
let ready = false
while (!ready) {
  if (Date.now() > deadline) throw new Error('Bench app failed to initialize within 90s')
  try {
    ready = await page.evaluate(() => !!window.__benchReady)
  } catch {
    // context destroyed during Vite HMR reload — keep polling
  }
  if (!ready) await page.waitForTimeout(500)
}

function stats(times) {
  const sorted = [...times].sort((a, b) => a - b)
  const mean = times.reduce((a, b) => a + b, 0) / times.length
  return {
    mean,
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
    samples: times.length,
  }
}

function fmt(ms) {
  return ms.toFixed(3) + 'ms'
}

const results = {}

console.log('\n=== VIAN Timeline Benchmark ===')
console.log('Dataset: 3h · 20 timelines · ~5s shots · ~43k segments')
console.log()

for (const scenario of SCENARIOS) {
  await page.evaluate(scenario.setup)
  await page.waitForTimeout(200)

  // Warmup
  await page.evaluate((n) => window.__bench.runDraw(n), 10)

  // Measure
  const times = await page.evaluate((n) => window.__bench.runDraw(n), DRAW_N)
  results[scenario.key] = stats(times)

  const s = results[scenario.key]
  console.log(scenario.label)
  console.log(
    `  mean ${fmt(s.mean)}  p50 ${fmt(s.p50)}  p95 ${fmt(s.p95)}  p99 ${fmt(s.p99)}`
  )
  console.log()
}

if (outputPath) {
  writeFileSync(outputPath, JSON.stringify(results, null, 2))
}

await browser.close()
await server.close()
