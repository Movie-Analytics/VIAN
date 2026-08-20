// Rebuilds a scalar timeline's `data` array from timestamped samples,
// preserving gaps (missing samples) as `null` rather than compacting them
// together. Samples need not be contiguous or sorted.
//
// If `knownInterval` (seconds between samples) is given, it's used
// directly. Otherwise the interval is inferred as the smallest gap between
// consecutive timestamps - using the smallest gap (rather than just the
// first two samples) keeps an early missing sample from being mistaken for
// the native sampling rate.
export const buildScalarDataFromSamples = (samples, knownInterval) => {
  if (samples.length === 0) {
    return { data: [], fps: 1 }
  }
  const sorted = [...samples].sort((a, b) => a.time - b.time)

  let delta = knownInterval
  if (!delta) {
    delta = Infinity
    for (let i = 1; i < sorted.length; i += 1) {
      const gap = sorted[i].time - sorted[i - 1].time
      if (gap > 0 && gap < delta) delta = gap
    }
    if (!Number.isFinite(delta)) delta = 1
  }

  const lastIndex = Math.round(sorted[sorted.length - 1].time / delta)
  const data = new Array(lastIndex + 1).fill(null)
  for (const s of sorted) {
    data[Math.round(s.time / delta)] = s.value
  }

  return { data, fps: 1 / delta }
}
