import { createServer } from 'vite'
import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const outputIdx = process.argv.indexOf('--output')
const outputPath = outputIdx !== -1 ? process.argv[outputIdx + 1] : null

// Zoom so ~100 shots are visible across the 1920px canvas:
// 100 shots × 120 frames = 12,000 frames → zoom ≈ 259200/12000 ≈ 22
const ZOOM = 22
const DRAW_N = 100

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

// Set a meaningful zoom and let it settle
await page.evaluate((k) => window.__bench.setZoom(k), ZOOM)
await page.waitForTimeout(200)

// Warmup
await page.evaluate((n) => window.__bench.runDraw(n), 10)

// Measure
const drawTimes = await page.evaluate((n) => window.__bench.runDraw(n), DRAW_N)

function stats(times) {
  const sorted = [...times].sort((a, b) => a - b)
  const mean = times.reduce((a, b) => a + b, 0) / times.length
  return {
    mean,
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
    samples: times.length
  }
}

const results = { draw: stats(drawTimes) }

function fmt(ms) {
  return ms.toFixed(3) + 'ms'
}

console.log('\n=== VIAN Timeline Benchmark ===')
console.log('Dataset: 3h · 20 timelines · ~5s shots · ~43k segments · zoom=' + ZOOM)
console.log()
console.log('draw() × ' + DRAW_N)
console.log(
  `  mean ${fmt(results.draw.mean)}  p50 ${fmt(results.draw.p50)}  p95 ${fmt(results.draw.p95)}  p99 ${fmt(results.draw.p99)}`
)
console.log()

if (outputPath) {
  writeFileSync(outputPath, JSON.stringify(results, null, 2))
}

await browser.close()
await server.close()
