export function peakFrequency(signal: number[], dt: number, minHz = 0.8, maxHz = 3.0): number | null {
  // Simple spectral estimate using autocorrelation peak as proxy for frequency
  const n = signal.length
  if (n < 64) return null
  const mean = signal.reduce((a, b) => a + b, 0) / n
  const x = signal.map((v) => v - mean)
  const maxLag = Math.min(n - 1, Math.floor(1 / minHz / dt))
  let bestLag = 0
  let bestVal = -Infinity
  for (let lag = Math.floor(1 / maxHz / dt); lag <= maxLag; lag++) {
    let s = 0
    for (let i = 0; i < n - lag; i++) s += x[i] * x[i + lag]
    if (s > bestVal) {
      bestVal = s
      bestLag = lag
    }
  }
  const freq = 1 / (bestLag * dt)
  if (freq < minHz || freq > maxHz) return null
  return freq
}