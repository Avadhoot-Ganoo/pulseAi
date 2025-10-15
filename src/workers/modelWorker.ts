// Offline-first model worker: provide stable synthetic vitals and denoising echo.
let spo2State = 97.5
let bpSysState = 120
let bpDiaState = 80

type InitMsg = { type: 'init' }
type InferSpo2Msg = { type: 'infer_spo2'; features: number[] }
type InferBpMsg = { type: 'infer_bp'; features: number[] }
type DenoiseMsg = { type: 'denoise'; data: Float32Array }
type AnyMsg = InitMsg | InferSpo2Msg | InferBpMsg | DenoiseMsg

function clamp(val: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, val)) }

onmessage = async (ev: MessageEvent<AnyMsg>) => {
  const msg = ev.data
  if (msg.type === 'init') {
    try { postMessage({ type: 'worker-ready', worker: 'model' }) } catch {}
    postMessage({ type: 'ready', spo2: true, bp: true, denoiser: false })
    return
  }
  if (msg.type === 'infer_spo2') {
    // Offline synthetic SpO₂: gentle smoothing around 98%
    const f = msg.features || []
    const ratio = Number.isFinite(f[0]) ? f[0] : 1
    const target = 97.8 + Math.max(-2.5, Math.min(2.5, (ratio - 1) * 4))
    spo2State = 0.9 * spo2State + 0.1 * target
    postMessage({ type: 'spo2', value: Math.round(clamp(spo2State, 92, 100)) })
    return
  }
  if (msg.type === 'infer_bp') {
    const f = msg.features || []
    const hr = Number.isFinite(f[0]) ? f[0] : 70
    const spo2 = Number.isFinite(f[1]) ? f[1] : 98
    const baseSys = 118 + 0.18 * (hr - 70) - 0.5 * Math.max(0, spo2 - 98)
    const baseDia = 78 + 0.12 * (hr - 70) - 0.3 * Math.max(0, spo2 - 98)
    bpSysState = 0.9 * bpSysState + 0.1 * baseSys
    bpDiaState = 0.9 * bpDiaState + 0.1 * baseDia
    postMessage({ type: 'bp', value: { systolic: Math.round(clamp(bpSysState, 95, 140)), diastolic: Math.round(clamp(bpDiaState, 60, 95)) } })
    return
  }
  if (msg.type === 'denoise') {
    // Echo denoiser for now to keep pipeline consistent
    const buf = new Float32Array(msg.data)
    postMessage({ type: 'denoised', data: buf }, [buf.buffer])
    return
  }
}