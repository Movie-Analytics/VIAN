import { readFileSync } from 'fs'

const [, , beforeFile, afterFile, beforeRef, afterRef] = process.argv

const before = JSON.parse(readFileSync(beforeFile, 'utf8'))
const after = JSON.parse(readFileSync(afterFile, 'utf8'))

function pct(a, b) {
  const diff = ((b - a) / a) * 100
  return (diff > 0 ? '+' : '') + diff.toFixed(1) + '%'
}

function row(metric, bScenario, aScenario) {
  const b = bScenario[metric]
  const a = aScenario[metric]
  const change = pct(b, a)
  const flag = b - a > b * 0.05 ? ' ✓' : b - a < -b * 0.05 ? ' ✗' : ''
  console.log(`  ${metric.padEnd(4)}  ${b.toFixed(3).padStart(8)}ms → ${a.toFixed(3).padStart(8)}ms  (${change})${flag}`)
}

// Labels for known scenario keys; falls back to the key itself.
const LABELS = {
  zoom22:      'zoom=22  (baseline)',
  zoom1:       'zoom=1   (all segments visible)',
  zoom100:     'zoom=100 (heavy culling)',
  selection50: 'zoom=22, 50 selected',
  tmpshot:     'zoom=22, dragging segment',
  locked20:    'zoom=22, all locked',
  draw:        'draw (legacy)',
}

const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])]

console.log()
console.log(`=== before: ${beforeRef}  →  after: ${afterRef} ===`)
console.log()

for (const key of keys) {
  const b = before[key]
  const a = after[key]
  if (!b || !a) {
    console.log(`${LABELS[key] ?? key}: missing in one result, skipping`)
    console.log()
    continue
  }
  console.log(`${LABELS[key] ?? key}:`)
  for (const m of ['mean', 'p50', 'p95', 'p99']) row(m, b, a)
  console.log()
}

console.log('✓ = >5% faster   ✗ = >5% slower')
console.log()
