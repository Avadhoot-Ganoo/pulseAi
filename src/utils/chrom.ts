// CHROM algorithm implementation for rPPG extraction
// de Haan & Jeanne (2013): robust pulse rate from chrominance-based rPPG

export function chrom(signalRGB: number[][]): number[] {
  // signalRGB: [ [r,g,b] per frame ]
  const N = signalRGB.length
  if (N === 0) return []
  const r = new Array<number>(N)
  const g = new Array<number>(N)
  const b = new Array<number>(N)
  for (let i = 0; i < N; i++) {
    r[i] = signalRGB[i][0]
    g[i] = signalRGB[i][1]
    b[i] = signalRGB[i][2]
  }
  // Normalize per channel
  const norm = (x: number[]) => {
    const m = x.reduce((a, c) => a + c, 0) / x.length
    const s = Math.sqrt(x.reduce((a, c) => a + (c - m) * (c - m), 0) / x.length) || 1
    return x.map((v) => (v - m) / s)
  }
  const rn = norm(r)
  const gn = norm(g)
  const bn = norm(b)
  // Chrominance projection
  const X = rn.map((v, i) => 3 * v - 2 * gn[i])
  const Y = rn.map((v, i) => 1.5 * v + bn[i] - 1.5 * gn[i])
  // Alpha scaling to balance X and Y
  const std = (x: number[]) => {
    const m = x.reduce((a, c) => a + c, 0) / x.length
    return Math.sqrt(x.reduce((a, c) => a + (c - m) * (c - m), 0) / x.length) || 1
  }
  const alpha = std(X) / std(Y)
  const S = X.map((v, i) => v - alpha * Y[i])
  return S
}