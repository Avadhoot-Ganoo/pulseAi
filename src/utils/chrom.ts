// CHROM algorithm implementation based on de Haan & Jeanne (2013)
// This simplified version uses two projections and adaptive scaling
export function chromCombineSignals(r: number[], g: number[], b: number[]) {
  const n = Math.min(r.length, g.length, b.length)
  const x1: number[] = new Array(n)
  const x2: number[] = new Array(n)
  for (let i = 0; i < n; i++) {
    x1[i] = 3 * r[i] - 2 * g[i]
    x2[i] = 1.5 * r[i] + g[i] - 1.5 * b[i]
  }
  const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / Math.max(arr.length, 1)
  const std = (arr: number[]) => {
    const m = mean(arr)
    const v = arr.reduce((a, b) => a + (b - m) * (b - m), 0) / Math.max(arr.length, 1)
    return Math.sqrt(v)
  }
  const s1 = std(x1)
  const s2 = std(x2)
  const alpha = s1 / Math.max(s2, 1e-6)
  const y = new Array(n)
  for (let i = 0; i < n; i++) y[i] = x1[i] - alpha * x2[i]
  return y
}