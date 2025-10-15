// Simple rPPG processing worker: combine ROI RGB signals, detrend, bandpass,
// detect peaks to estimate HR and compute HRV metrics.

type FrameMsg = {
  type: 'frame'
  ts: number
  frameId?: number
  forehead: [number, number, number]
  leftCheek: [number, number, number]
  rightCheek: [number, number, number]
}

type ControlMsg = { type: 'start'; mix?: 'green' | 'chrom' | 'pos' } | { type: 'stop' }

import { SimpleKalman } from '../utils/kalman'
import { hampelFilter, snrPulse } from '../utils/filters'
import { computeHRVMetrics } from '../utils/hrv'
import { autocorrStrength, beatRegularity, sqiScore } from '../utils/sqi'
import { dominantFrequencyInBand } from '../utils/fft'

// Maintain per-ROI RGB channel series to enable CHROM/POS mixing
const fR: number[] = []
const fG: number[] = []
const fB: number[] = []
const lR: number[] = []
const lG: number[] = []
const lB: number[] = []
const rR: number[] = []
const rG: number[] = []
const rB: number[] = []
const timestamps: number[] = []
let running = false
let kalmanHR: SimpleKalman | null = null
let lastPeakCount = 0
let dtAvg = 1 / 30
let lastFrameId = -1
let mixMode: 'green' | 'chrom' | 'pos' = 'green'

// Signal readiness to main thread
try { postMessage({ type: 'worker-ready', worker: 'rppg' }) } catch {}

function detrend(signal: number[]): number[] {
  // remove mean
  const mean = signal.reduce((a, b) => a + b, 0) / Math.max(signal.length, 1)
  return signal.map((v) => v - mean)
}

// Biquad filter helpers (Butterworth)
function biquadLP(fs: number, fc: number, Q = Math.SQRT1_2) {
  const w0 = 2 * Math.PI * fc / fs
  const cosw0 = Math.cos(w0)
  const sinw0 = Math.sin(w0)
  const alpha = sinw0 / (2 * Q)
  const b0 = (1 - cosw0) / 2
  const b1 = 1 - cosw0
  const b2 = (1 - cosw0) / 2
  const a0 = 1 + alpha
  const a1 = -2 * cosw0
  const a2 = 1 - alpha
  return { b: [b0 / a0, b1 / a0, b2 / a0], a: [1, a1 / a0, a2 / a0] }
}
function biquadHP(fs: number, fc: number, Q = Math.SQRT1_2) {
  const w0 = 2 * Math.PI * fc / fs
  const cosw0 = Math.cos(w0)
  const sinw0 = Math.sin(w0)
  const alpha = sinw0 / (2 * Q)
  const b0 = (1 + cosw0) / 2
  const b1 = -(1 + cosw0)
  const b2 = (1 + cosw0) / 2
  const a0 = 1 + alpha
  const a1 = -2 * cosw0
  const a2 = 1 - alpha
  return { b: [b0 / a0, b1 / a0, b2 / a0], a: [1, a1 / a0, a2 / a0] }
}
function applyBiquad(x: number[], b: number[], a: number[]) {
  const y = new Array(x.length).fill(0)
  for (let i = 0; i < x.length; i++) {
    const x0 = x[i]
    const x1 = x[i - 1] ?? 0
    const x2 = x[i - 2] ?? 0
    const y1 = y[i - 1] ?? 0
    const y2 = y[i - 2] ?? 0
    y[i] = b[0] * x0 + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2
  }
  return y
}
function zeroPhaseBandpass(x: number[], dt: number, fLow = 0.7, fHigh = 3.0) {
  const fs = 1 / dt
  const hp = biquadHP(fs, fLow)
  const lp = biquadLP(fs, fHigh)
  let y = applyBiquad(x, hp.b, hp.a)
  y = applyBiquad(y, lp.b, lp.a)
  // zero-phase via forward-backward
  y = applyBiquad(y.slice().reverse(), lp.b, lp.a).reverse()
  y = applyBiquad(y, hp.b, hp.a)
  return y
}

function findPeaksAdaptive(signal: number[], dt: number) {
  const peaks: number[] = []
  const mu = signal.reduce((a, b) => a + b, 0) / Math.max(1, signal.length)
  const sd = Math.sqrt(signal.reduce((s, v) => s + (v - mu) ** 2, 0) / Math.max(1, signal.length))
  const thr = mu + 0.6 * sd
  const refractory = Math.max(1, Math.floor(0.3 / dt))
  let lastPeak = -refractory
  for (let i = 1; i < signal.length - 1; i++) {
    if (signal[i] > thr && signal[i] > signal[i - 1] && signal[i] > signal[i + 1]) {
      if (i - lastPeak >= refractory) {
        peaks.push(i)
        lastPeak = i
      }
    }
  }
  const ibis: number[] = []
  for (let i = 1; i < peaks.length; i++) ibis.push((peaks[i] - peaks[i - 1]) * dt)
  return { peaks, ibis }
}


function estimateHRFromSpectrum(signal: number[], dt: number) {
  try {
    const fPeak = dominantFrequencyInBand(signal, dt, 0.7, 3.0)
    const hr = Math.round(fPeak * 60)
    if (hr < 48 || hr > 180) return null
    return hr
  } catch {
    return null
  }
}

function softmax(nums: number[]) {
  const m = Math.max(...nums)
  const exps = nums.map((v) => Math.exp(v - m))
  const sum = exps.reduce((a, b) => a + b, 0)
  return exps.map((e) => e / Math.max(sum, 1e-8))
}
function weightedCombine(f: number[], l: number[], r: number[], dt: number) {
  // compute SNR per ROI on the current window
  const snrF = snrPulse(f, dt)
  const snrL = snrPulse(l, dt)
  const snrR = snrPulse(r, dt)
  const weights = softmax([snrF, snrL, snrR].map((v) => v * 0.35))
  const [wf, wl, wr] = weights
  const n = Math.min(f.length, l.length, r.length)
  const out = new Array(n)
  for (let i = 0; i < n; i++) {
    out[i] = wf * f[i] + wl * l[i] + wr * r[i]
  }
  return { combined: out, snrF, snrL, snrR, weights: { wf, wl, wr } }
}

function meanStd(x: number[]) {
  const n = x.length
  if (n === 0) return { mean: 0, std: 0 }
  const mean = x.reduce((a, b) => a + b, 0) / n
  const varr = x.reduce((a, b) => a + (b - mean) * (b - mean), 0) / Math.max(1, n - 1)
  return { mean, std: Math.sqrt(varr) }
}

function normalizeRGB(r: number[], g: number[], b: number[]) {
  // Normalize each channel by its mean and subtract 1
  const { mean: mr } = meanStd(r)
  const { mean: mg } = meanStd(g)
  const { mean: mb } = meanStd(b)
  const n = Math.min(r.length, g.length, b.length)
  const rn = new Array(n)
  const gn = new Array(n)
  const bn = new Array(n)
  for (let i = 0; i < n; i++) {
    rn[i] = (r[i] / Math.max(mr, 1e-6)) - 1
    gn[i] = (g[i] / Math.max(mg, 1e-6)) - 1
    bn[i] = (b[i] / Math.max(mb, 1e-6)) - 1
  }
  return { rn, gn, bn }
}

function mixCHROM(r: number[], g: number[], b: number[]) {
  const { rn, gn, bn } = normalizeRGB(r, g, b)
  const n = rn.length
  const x = new Array(n)
  const y = new Array(n)
  for (let i = 0; i < n; i++) {
    x[i] = 3 * rn[i] - 2 * gn[i]
    y[i] = 1.5 * rn[i] + gn[i] - 1.5 * bn[i]
  }
  const { std: sx } = meanStd(x)
  const { std: sy } = meanStd(y)
  const alpha = sy > 0 ? sx / Math.max(sy, 1e-6) : 1
  const s = new Array(n)
  for (let i = 0; i < n; i++) s[i] = x[i] - alpha * y[i]
  return s
}

function mixPOS(r: number[], g: number[], b: number[]) {
  const { rn, gn, bn } = normalizeRGB(r, g, b)
  const n = rn.length
  const s1 = new Array(n)
  const s2 = new Array(n)
  for (let i = 0; i < n; i++) {
    s1[i] = gn[i] - bn[i]
    s2[i] = gn[i] + bn[i] - 2 * rn[i]
  }
  const { std: s1std } = meanStd(s1)
  const { std: s2std } = meanStd(s2)
  const alpha = s2std > 0 ? s1std / Math.max(s2std, 1e-6) : 1
  const s = new Array(n)
  for (let i = 0; i < n; i++) s[i] = s1[i] + alpha * s2[i]
  return s
}

function selectSeries(r: number[], g: number[], b: number[]) {
  if (mixMode === 'chrom') return mixCHROM(r, g, b)
  if (mixMode === 'pos') return mixPOS(r, g, b)
  // green-only fallback
  const n = Math.min(r.length, g.length, b.length)
  return g.slice(0, n)
}

function updateConfidence(hr: number | null, snrDb: number) {
  if (!hr) return 0.3
  // Normalize SNR dB to 0..1 roughly: -10dB -> 0.2, 0dB -> 0.5, 6dB -> 0.8, 12dB -> 0.95
  const norm = Math.max(0.1, Math.min(0.95, 0.5 + snrDb / 24))
  return norm
}

function process() {
  const minLen = Math.min(
    fR.length, fG.length, fB.length,
    lR.length, lG.length, lB.length,
    rR.length, rG.length, rB.length
  )
  if (minLen < 90) return null
  const dtInstant = timestamps.length > 1 ? (timestamps[timestamps.length - 1] - timestamps[timestamps.length - 2]) / 1000 : dtAvg
  // EMA smoothing of dt
  dtAvg = 0.9 * dtAvg + 0.1 * Math.max(1 / 120, Math.min(1 / 20, dtInstant))
  const dt = dtAvg
  // Weighted fusion across ROIs by SNR
  const fSig = selectSeries(fR.slice(-minLen), fG.slice(-minLen), fB.slice(-minLen))
  const lSig = selectSeries(lR.slice(-minLen), lG.slice(-minLen), lB.slice(-minLen))
  const rSig = selectSeries(rR.slice(-minLen), rG.slice(-minLen), rB.slice(-minLen))
  const { combined, snrF, snrL, snrR, weights } = weightedCombine(
    fSig,
    lSig,
    rSig,
    dt
  )
  // Detrend and crude bandpass
  const d = detrend(combined)
  const bp = zeroPhaseBandpass(d, dt, 0.7, 3.0)
  // Outlier rejection
  const clean = hampelFilter(bp)
  // Peak detection for HRV
  const { peaks, ibis } = findPeaksAdaptive(clean, dt)
  // Spectral HR estimate
  let hr = estimateHRFromSpectrum(clean, dt)
  // Smooth HR via Kalman
  if (hr !== null && kalmanHR) {
    hr = Math.round(kalmanHR.filter(hr))
  }
  if (hr !== null) {
    // Clamp to physiological range
    hr = Math.max(40, Math.min(180, hr))
  }
  const hrv = computeHRVMetrics(ibis, clean, dt)
  const snrCombined = snrPulse(clean, dt)
  const confidence = updateConfidence(hr, snrCombined)
  // SQI extras
  const ac = autocorrStrength(clean, dt)
  const reg = beatRegularity(ibis)
  const score = sqiScore({ snrDb: snrCombined, ac, reg })
  // Beat event if a new peak detected at the tail
  const peakCount = peaks.length
  const beat = peakCount > lastPeakCount
  lastPeakCount = peakCount
  return {
    hr,
    hrv,
    confidence,
    signal: clean,
    sqi: {
      snr: snrCombined,
      ac,
      regularity: reg,
      score,
      rois: { forehead: snrF, leftCheek: snrL, rightCheek: snrR },
      weights,
    },
    beat,
  }
}

// Removed unused combineRGB; CHROM/POS are handled in utilities and can be integrated later

onmessage = (ev: MessageEvent<FrameMsg | ControlMsg | { type: 'ping'; ts: number }>) => {
  const msg = ev.data
  if ((msg as any).type === 'ping') {
    postMessage({ type: 'sample', worker: 'rppg', ts: (msg as any).ts })
    return
  }
  if (msg.type === 'start') {
    running = true
    fR.length = 0
    fG.length = 0
    fB.length = 0
    lR.length = 0
    lG.length = 0
    lB.length = 0
    rR.length = 0
    rG.length = 0
    rB.length = 0
    timestamps.length = 0
    kalmanHR = new SimpleKalman(0.01, 0.1, 0)
    dtAvg = 1 / 30
    lastFrameId = -1
    mixMode = msg.mix || 'green'
    postMessage({ type: 'update', hr: null, hrv: null, confidence: 0, signal: [] })
    return
  }
  if (msg.type === 'stop') {
    running = false
    const res = process()
    postMessage({ type: 'update', ...(res || {}), metrics: {} })
    return
  }
  if (!running) return
  // frame
  if (typeof msg.frameId === 'number') {
    if (msg.frameId <= lastFrameId) {
      // Drop out-of-order frames
      return
    }
    lastFrameId = msg.frameId
  }
  // push per-ROI RGB channel values
  fR.push(msg.forehead[0])
  fG.push(msg.forehead[1])
  fB.push(msg.forehead[2])
  lR.push(msg.leftCheek[0])
  lG.push(msg.leftCheek[1])
  lB.push(msg.leftCheek[2])
  rR.push(msg.rightCheek[0])
  rG.push(msg.rightCheek[1])
  rB.push(msg.rightCheek[2])
  timestamps.push(msg.ts)
  // trim buffers to a reasonable length (keep last ~512 samples)
  const maxLen = 512
  const trim = (arr: number[]) => { if (arr.length > maxLen) arr.splice(0, arr.length - maxLen) }
  ;[fR, fG, fB, lR, lG, lB, rR, rG, rB, timestamps].forEach(trim)
  const res = process()
  if (res) {
    // Send update
    postMessage({ type: 'update', hr: res.hr, hrv: res.hrv, confidence: res.confidence, signal: res.signal, sqi: res.sqi })
    // Beat haptic trigger
    if ((res as any).beat) {
      postMessage({ type: 'beat' })
    }
    // Send a short denoised waveform window for AR overlay
    const wfLen = Math.min(128, res.signal.length)
    if (wfLen > 0) {
      const slice = res.signal.slice(-wfLen)
      const wf = new Float32Array(slice)
      // Transfer buffer to avoid copy overhead
      postMessage({ type: 'waveform', data: wf }, [wf.buffer])
    }
  }
}