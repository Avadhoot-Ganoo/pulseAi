import { dominantFrequencyInBand, powerSpectrum } from './fft'

export function computeHRVMetrics(ibis: number[], signal: number[], dt: number) {
  const nI = ibis.length
  if (nI < 2) return { rmssd: 0, sdnn: 0, pnn50: 0, lf: 0, hf: 0 }
  const diffs = []
  for (let i = 1; i < nI; i++) diffs.push(ibis[i] - ibis[i - 1])
  const rmssd = Math.sqrt(diffs.reduce((a, b) => a + b * b, 0) / diffs.length)
  const meanIbi = ibis.reduce((a, b) => a + b, 0) / nI
  const sdnn = Math.sqrt(ibis.reduce((a, b) => a + (b - meanIbi) ** 2, 0) / nI)
  const pnn50 = (diffs.filter((d) => Math.abs(d * 1000) > 50).length / diffs.length) * 100

  // Welch PSD for LF/HF
  // Split signal into overlapping segments, average power spectra
  const segLen = Math.min(signal.length, 256)
  const step = Math.floor(segLen / 2)
  let start = 0
  const psds: number[][] = []
  while (start + segLen <= signal.length) {
    const seg = signal.slice(start, start + segLen)
    psds.push(powerSpectrum(seg))
    start += step
  }
  const psAvg = psds.length ? psds[0].map((_, k) => psds.reduce((a, ps) => a + ps[k], 0) / psds.length) : []
  const df = psAvg.length ? 1 / (dt * (segLen)) : 0
  const bandPower = (f1: number, f2: number) => {
    if (!psAvg.length) return 0
    const k1 = Math.max(1, Math.floor(f1 / df))
    const k2 = Math.min(psAvg.length - 1, Math.ceil(f2 / df))
    let p = 0
    for (let k = k1; k <= k2; k++) p += psAvg[k]
    return p
  }
  const lf = bandPower(0.04, 0.15)
  const hf = bandPower(0.15, 0.4)
  return { rmssd, sdnn, pnn50, lf, hf }
}