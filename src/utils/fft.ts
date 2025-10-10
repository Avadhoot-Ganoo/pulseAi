// Radix-2 Cooley-Tukey FFT and helpers for real signals
export function fft(inputRe: number[], inputIm?: number[]) {
  const n = inputRe.length
  const im = inputIm ? inputIm.slice() : new Array(n).fill(0)
  const re = inputRe.slice()
  const levels = Math.floor(Math.log2(n))
  if (1 << levels !== n) throw new Error('fft length must be power of 2')

  // bit-reversed permutation
  for (let i = 0; i < n; i++) {
    const j = reverseBits(i, levels)
    if (j > i) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }

  for (let size = 2; size <= n; size <<= 1) {
    const half = size >>> 1
    const tableStep = Math.PI * 2 / size
    for (let i = 0; i < n; i += size) {
      for (let j = 0; j < half; j++) {
        const k = i + j
        const l = k + half
        const ang = tableStep * j
        const cos = Math.cos(ang)
        const sin = Math.sin(ang)
        const tRe = re[l] * cos - im[l] * sin
        const tIm = re[l] * sin + im[l] * cos
        re[l] = re[k] - tRe
        im[l] = im[k] - tIm
        re[k] += tRe
        im[k] += tIm
      }
    }
  }
  return { re, im }
}

function reverseBits(x: number, bits: number) {
  let y = 0
  for (let i = 0; i < bits; i++) { y = (y << 1) | (x & 1); x >>>= 1 }
  return y
}

export function hammingWindow(n: number) {
  const w = new Array(n)
  for (let i = 0; i < n; i++) w[i] = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (n - 1))
  return w
}

export function powerSpectrum(signal: number[]) {
  const n = signal.length
  const w = hammingWindow(n)
  const re = new Array(n)
  for (let i = 0; i < n; i++) re[i] = signal[i] * w[i]
  const { re: R, im: I } = fft(re)
  const ps = new Array(n >>> 1)
  for (let k = 0; k < ps.length; k++) ps[k] = R[k] * R[k] + I[k] * I[k]
  return ps
}

export function dominantFrequencyInBand(signal: number[], dt: number, fMin: number, fMax: number) {
  // Ensure power-of-two length
  const n0 = signal.length
  const n = 1 << Math.floor(Math.log2(n0))
  const s = signal.slice(n0 - n)
  const ps = powerSpectrum(s)
  const df = 1 / (dt * n)
  const kMin = Math.max(1, Math.floor(fMin / df))
  const kMax = Math.min(ps.length - 1, Math.ceil(fMax / df))
  let kPeak = kMin
  let maxVal = -Infinity
  for (let k = kMin; k <= kMax; k++) {
    if (ps[k] > maxVal) { maxVal = ps[k]; kPeak = k }
  }
  const fPeak = kPeak * df
  return fPeak
}