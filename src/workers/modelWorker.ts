// Worker to lazily load ONNX models and run inference off the UI thread
import * as ort from 'onnxruntime-web'

let spo2Session: ort.InferenceSession | null = null
let bpSession: ort.InferenceSession | null = null
let denoiseSession: ort.InferenceSession | null = null

type InitMsg = { type: 'init' }
type InferSpo2Msg = { type: 'infer_spo2'; features: number[] }
type InferBpMsg = { type: 'infer_bp'; features: number[] }
type DenoiseMsg = { type: 'denoise'; data: Float32Array }
type AnyMsg = InitMsg | InferSpo2Msg | InferBpMsg | DenoiseMsg

async function ensureModels() {
  if (!spo2Session) {
    try {
      spo2Session = await ort.InferenceSession.create('/models/spo2_model.onnx', { executionProviders: ['webgpu', 'webgl', 'wasm'] })
    } catch {
      // leave null; main thread may apply heuristics
    }
  }
  if (!bpSession) {
    try {
      bpSession = await ort.InferenceSession.create('/models/bp_model.onnx', { executionProviders: ['webgpu', 'webgl', 'wasm'] })
    } catch {
      // leave null
    }
  }
  if (!denoiseSession) {
    try {
      denoiseSession = await ort.InferenceSession.create('/models/denoiser.onnx', { executionProviders: ['webgpu', 'webgl', 'wasm'] })
    } catch {
      // leave null
    }
  }
}

onmessage = async (ev: MessageEvent<AnyMsg>) => {
  const msg = ev.data
  if (msg.type === 'init') {
    await ensureModels()
    postMessage({ type: 'ready', spo2: !!spo2Session, bp: !!bpSession, denoiser: !!denoiseSession })
    return
  }
  if (msg.type === 'infer_spo2') {
    await ensureModels()
    if (spo2Session) {
      const input = new ort.Tensor('float32', Float32Array.from(msg.features), [1, msg.features.length])
      const out = await spo2Session.run({ input })
      const val = (out['output'] as ort.Tensor).data as Float32Array
      postMessage({ type: 'spo2', value: Math.round(val[0]) })
    } else {
      postMessage({ type: 'spo2', value: null })
    }
    return
  }
  if (msg.type === 'infer_bp') {
    await ensureModels()
    if (bpSession) {
      const input = new ort.Tensor('float32', Float32Array.from(msg.features), [1, msg.features.length])
      const out = await bpSession.run({ input })
      const val = (out['output'] as ort.Tensor).data as Float32Array
      postMessage({ type: 'bp', value: { systolic: Math.round(val[0]), diastolic: Math.round(val[1]) } })
    } else {
      postMessage({ type: 'bp', value: null })
    }
    return
  }
  if (msg.type === 'denoise') {
    await ensureModels()
    if (denoiseSession) {
      const input = new ort.Tensor('float32', msg.data, [1, msg.data.length])
      const out = await denoiseSession.run({ input })
      const val = (out['output'] as ort.Tensor).data as Float32Array
      // Copy to transfer ownership safely
      const buf = new Float32Array(val)
      postMessage({ type: 'denoised', data: buf }, [buf.buffer])
    } else {
      // Fallback: echo
      const buf = new Float32Array(msg.data)
      postMessage({ type: 'denoised', data: buf }, [buf.buffer])
    }
    return
  }
}