// Time-series utilities for outlier rejection and signal quality
export function hampelFilter(signal: number[], window = 5, k = 3): number[] {
  const n = signal.length
  if (n === 0) return []
  const out = signal.slice()
  const half = Math.max(1, Math.floor(window / 2))
  for (let i = 0; i < n; i++) {
    const s = Math.max(0, i - half)
    const e = Math.min(n, i + half + 1)
    const slice = signal.slice(s, e)
    const median = slice.slice().sort((a, b) => a - b)[Math.floor(slice.length / 2)]
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length
    const std = Math.sqrt(slice.reduce((a, b) => a + (b - mean) * (b - mean), 0) / slice.length)
    if (std > 0 && Math.abs(signal[i] - median) > k * std) {
      out[i] = median
    }
  }
  return out
}

// Estimate SNR around the cardiac band using a crude spectral proxy
export function snrPulse(signal: number[], dt: number, minHz = 0.7, maxHz = 4.0): number {
  const n = signal.length
  if (n < 64) return 0
  const mean = signal.reduce((a, b) => a + b, 0) / n
  const x = signal.map((v) => v - mean)
  const minLag = Math.max(1, Math.floor(1 / maxHz / dt))
  const maxLag = Math.min(n - 2, Math.floor(1 / minHz / dt))
  let bandPower = 0
  let totalPower = 0
  for (let lag = 1; lag < n; lag++) {
    let s = 0
    for (let i = 0; i < n - lag; i++) s += x[i] * x[i + lag]
    totalPower += Math.abs(s)
    if (lag >= minLag && lag <= maxLag) bandPower += Math.abs(s)
  }
  if (totalPower === 0) return 0
  const ratio = bandPower / totalPower
  // convert to dB-like scale
  return 10 * Math.log10(Math.max(1e-8, ratio / Math.max(1e-8, 1 - ratio)))
}