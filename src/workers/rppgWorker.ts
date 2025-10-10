// Simple rPPG processing worker: combine ROI RGB signals, detrend, bandpass,
// detect peaks to estimate HR and compute HRV metrics.

type FrameMsg = {
  type: 'frame'
  ts: number
  forehead: [number, number, number]
  leftCheek: [number, number, number]
  rightCheek: [number, number, number]
}

type ControlMsg = { type: 'start' } | { type: 'stop' }

import { SimpleKalman } from '../utils/kalman'
import { hampelFilter, snrPulse } from '../utils/filters'
import { computeHRVMetrics } from '../utils/hrv'
import { autocorrStrength, beatRegularity, sqiScore } from '../utils/sqi'
import { dominantFrequencyInBand } from '../utils/fft'

// Maintain per-ROI green channel series to enable weighted fusion by SNR
const fSeries: number[] = []
const lSeries: number[] = []
const rSeries: number[] = []
const timestamps: number[] = []
let running = false
let kalmanHR: SimpleKalman | null = null
let lastPeakCount = 0

function detrend(signal: number[]): number[] {
  // remove mean
  const mean = signal.reduce((a, b) => a + b, 0) / Math.max(signal.length, 1)
  return signal.map((v) => v - mean)
}

function movingBandpass(signal: number[], dt: number): number[] {
  // crude bandpass via moving average subtraction
  const lowWin = Math.max(1, Math.floor((1.0 / 0.7) / dt))
  const highWin = Math.max(1, Math.floor((1.0 / 4.0) / dt))
  const ma = (arr: number[], w: number) => arr.map((_, i) => {
    const s = Math.max(0, i - w)
    const e = Math.min(arr.length, i + w)
    let sum = 0
    let count = 0
    for (let k = s; k < e; k++) { sum += arr[k]; count++ }
    return count ? sum / count : 0
  })
  const low = ma(signal, lowWin)
  const high = ma(signal, highWin)
  return signal.map((v, i) => v - low[i] - (v - high[i]))
}

function findPeaks(signal: number[], dt: number) {
  const peaks: number[] = []
  const threshold = Math.max(...signal.map((v) => Math.abs(v))) * 0.3
  for (let i = 1; i < signal.length - 1; i++) {
    if (signal[i] > threshold && signal[i] > signal[i - 1] && signal[i] > signal[i + 1]) {
      peaks.push(i)
    }
  }
  const ibis = []
  for (let i = 1; i < peaks.length; i++) {
    ibis.push((peaks[i] - peaks[i - 1]) * dt)
  }
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

function weightedCombine(f: number[], l: number[], r: number[], dt: number) {
  // compute SNR per ROI on the current window
  const snrF = snrPulse(f, dt)
  const snrL = snrPulse(l, dt)
  const snrR = snrPulse(r, dt)
  const weights = [snrF, snrL, snrR].map((v) => Math.max(0.0001, v + 5)) // shift to keep positive
  const wSum = weights[0] + weights[1] + weights[2]
  const wf = weights[0] / wSum
  const wl = weights[1] / wSum
  const wr = weights[2] / wSum
  const n = Math.min(f.length, l.length, r.length)
  const out = new Array(n)
  for (let i = 0; i < n; i++) {
    out[i] = wf * f[i] + wl * l[i] + wr * r[i]
  }
  return { combined: out, snrF, snrL, snrR, weights: { wf, wl, wr } }
}

function updateConfidence(hr: number | null, snrDb: number) {
  if (!hr) return 0.3
  // Normalize SNR dB to 0..1 roughly: -10dB -> 0.2, 0dB -> 0.5, 6dB -> 0.8, 12dB -> 0.95
  const norm = Math.max(0.1, Math.min(0.95, 0.5 + snrDb / 24))
  return norm
}

function process() {
  const minLen = Math.min(fSeries.length, lSeries.length, rSeries.length)
  if (minLen < 90) return null
  const dt = timestamps.length > 1 ? (timestamps[timestamps.length - 1] - timestamps[0]) / (timestamps.length - 1) / 1000 : 1 / 30
  // Weighted fusion across ROIs by SNR
  const { combined, snrF, snrL, snrR } = weightedCombine(fSeries.slice(-minLen), lSeries.slice(-minLen), rSeries.slice(-minLen), dt)
  // Detrend and crude bandpass
  const d = detrend(combined)
  const bp = movingBandpass(d, dt)
  // Outlier rejection
  const clean = hampelFilter(bp)
  // Peak detection for HRV
  const { peaks, ibis } = findPeaks(clean, dt)
  // Spectral HR estimate
  let hr = estimateHRFromSpectrum(clean, dt)
  // Smooth HR via Kalman
  if (hr !== null && kalmanHR) {
    hr = Math.round(kalmanHR.filter(hr))
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
  return { hr, hrv, confidence, signal: clean, sqi: { snr: snrCombined, ac, regularity: reg, score, rois: { forehead: snrF, leftCheek: snrL, rightCheek: snrR } }, beat }
}

// Removed unused combineRGB; CHROM/POS are handled in utilities and can be integrated later

onmessage = (ev: MessageEvent<FrameMsg | ControlMsg>) => {
  const msg = ev.data
  if (msg.type === 'start') {
    running = true
    fSeries.length = 0
    lSeries.length = 0
    rSeries.length = 0
    timestamps.length = 0
    kalmanHR = new SimpleKalman(0.01, 0.1, 0)
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
  // push per-ROI green channel values
  fSeries.push(msg.forehead[1])
  lSeries.push(msg.leftCheek[1])
  rSeries.push(msg.rightCheek[1])
  timestamps.push(msg.ts)
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