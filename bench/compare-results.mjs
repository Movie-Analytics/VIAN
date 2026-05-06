import { readFileSync } from 'fs'

const [, , beforeFile, afterFile, beforeRef, afterRef] = process.argv

const before = JSON.parse(readFileSync(beforeFile, 'utf8'))
const after = JSON.parse(readFileSync(afterFile, 'utf8'))

function pct(a, b) {
  const diff = ((b - a) / a) * 100
  return (diff > 0 ? '+' : '') + diff.toFixed(1) + '%'
}

function row(metric, key) {
  const b = before[key][metric]
  const a = after[key][metric]
  const change = pct(b, a)
  const flag = b - a > b * 0.05 ? ' ✓' : b - a < -b * 0.05 ? ' ✗' : ''
  console.log(`  ${metric.padEnd(4)}  ${b.toFixed(3).padStart(8)}ms → ${a.toFixed(3).padStart(8)}ms  (${change})${flag}`)
}

console.log()
console.log(`=== before: ${beforeRef}  →  after: ${afterRef} ===`)
console.log()
console.log('draw():')
for (const m of ['mean', 'p50', 'p95', 'p99']) row(m, 'draw')
console.log()
console.log('✓ = >5% faster   ✗ = >5% slower')
console.log()
