// Plane-Orthogonal-to-Skin (POS) algorithm (Wang et al., 2017)
// Steps:
// 1) Normalize each RGB channel by its mean, remove DC
// 2) Project onto orthogonal planes using matrix M
// 3) Adaptive combination by standard deviation ratio
export function posCombineSignals(r: number[], g: number[], b: number[]) {
  const n = Math.min(r.length, g.length, b.length)
  const R = r.slice(0, n)
  const G = g.slice(0, n)
  const B = b.slice(0, n)
  const mean = (arr: number[]) => arr.reduce((a, c) => a + c, 0) / Math.max(arr.length, 1)
  const mR = mean(R), mG = mean(G), mB = mean(B)
  for (let i = 0; i < n; i++) {
    R[i] = R[i] / (mR + 1e-6) - 1
    G[i] = G[i] / (mG + 1e-6) - 1
    B[i] = B[i] / (mB + 1e-6) - 1
  }
  // M = [[0, 1, -1], [1, -1, 0]]
  const S1: number[] = new Array(n)
  const S2: number[] = new Array(n)
  for (let i = 0; i < n; i++) {
    S1[i] = 0 * R[i] + 1 * G[i] + (-1) * B[i]
    S2[i] = 1 * R[i] + (-1) * G[i] + 0 * B[i]
  }
  const std = (arr: number[]) => {
    const m = mean(arr)
    const v = arr.reduce((a, c) => a + (c - m) * (c - m), 0) / Math.max(arr.length, 1)
    return Math.sqrt(Math.max(v, 1e-12))
  }
  const alpha = std(S1) / std(S2)
  const y = new Array(n)
  for (let i = 0; i < n; i++) y[i] = S1[i] + alpha * S2[i]
  return y
}