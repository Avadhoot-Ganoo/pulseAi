// FastICA implementation for separating independent components from multichannel rPPG

export function fastICA(X: number[][], iterations = 50, tol = 1e-4): number[][] {
  // X: channels x samples (C x N)
  const C = X.length
  const N = X[0]?.length || 0
  if (C === 0 || N === 0) return []
  // Center and whiten
  const center = (x: number[]) => {
    const m = x.reduce((a, c) => a + c, 0) / x.length
    return x.map((v) => v - m)
  }
  const Xc = X.map(center)
  // Compute covariance
  const cov: number[][] = Array.from({ length: C }, () => Array(C).fill(0))
  for (let i = 0; i < C; i++) {
    for (let j = 0; j < C; j++) {
      let s = 0
      for (let n = 0; n < N; n++) s += Xc[i][n] * Xc[j][n]
      cov[i][j] = s / N
    }
  }
  // Eigen-decomposition (power method for simplicity)
  function matVec(A: number[][], v: number[]) {
    const out = new Array(A.length).fill(0)
    for (let i = 0; i < A.length; i++) {
      let s = 0
      for (let j = 0; j < A[i].length; j++) s += A[i][j] * v[j]
      out[i] = s
    }
    return out
  }
  function normalize(v: number[]) {
    const n = Math.sqrt(v.reduce((a, c) => a + c * c, 0)) || 1
    return v.map((x) => x / n)
  }
  const W: number[][] = []
  for (let k = 0; k < C; k++) {
    let w = normalize(Array.from({ length: C }, () => Math.random() - 0.5))
    // decorrelate from existing
    for (let iter = 0; iter < iterations; iter++) {
      // w_new = E[X * g(w^T X)] - E[g'(w^T X)] * w
      const proj = new Array(N)
      for (let n = 0; n < N; n++) {
        let s = 0
        for (let c = 0; c < C; c++) s += w[c] * Xc[c][n]
        proj[n] = s
      }
      const g = (x: number) => Math.tanh(x)
      const gp = (x: number) => 1 - Math.tanh(x) ** 2
      const term1 = new Array(C).fill(0)
      for (let c = 0; c < C; c++) {
        let s = 0
        for (let n = 0; n < N; n++) s += Xc[c][n] * g(proj[n])
        term1[c] = s / N
      }
      const term2 = (proj.reduce((a, c) => a + gp(c), 0) / N)
      let wNew = term1.map((x) => x - term2 * w[term1.indexOf(x)])
      // decorrelate
      for (let j = 0; j < W.length; j++) {
        const dot = wNew.reduce((a, c, idx) => a + c * W[j][idx], 0)
        wNew = wNew.map((x, idx) => x - dot * W[j][idx])
      }
      wNew = normalize(wNew)
      const diff = Math.sqrt(wNew.reduce((a, c, idx) => a + (c - w[idx]) ** 2, 0))
      w = wNew
      if (diff < tol) break
    }
    W.push(w)
  }
  // Unmix: S = W * Xc
  const S: number[][] = Array.from({ length: C }, () => Array(N).fill(0))
  for (let i = 0; i < C; i++) {
    for (let n = 0; n < N; n++) {
      let s = 0
      for (let c = 0; c < C; c++) s += W[i][c] * Xc[c][n]
      S[i][n] = s
    }
  }
  return S
}