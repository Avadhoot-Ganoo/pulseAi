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
      const modelUrl = new URL('/models/spo2_model.onnx?v=1', import.meta.url).toString()
      console.log('loading model', modelUrl)
      spo2Session = await ort.InferenceSession.create(modelUrl, { executionProviders: ['webgpu', 'webgl', 'wasm'] })
    } catch (e) {
      // leave null; main thread may apply heuristics
      console.error('spo2 model failed to load', e)
      postMessage({ type: 'model_error', model: 'spo2', error: String(e) })
    }
  }
  if (!bpSession) {
    try {
      const modelUrl = new URL('/models/bp_model.onnx?v=1', import.meta.url).toString()
      console.log('loading model', modelUrl)
      bpSession = await ort.InferenceSession.create(modelUrl, { executionProviders: ['webgpu', 'webgl', 'wasm'] })
    } catch (e) {
      // leave null
      console.error('bp model failed to load', e)
      postMessage({ type: 'model_error', model: 'bp', error: String(e) })
    }
  }
  if (!denoiseSession) {
    try {
      const modelUrl = new URL('/models/denoiser.onnx?v=1', import.meta.url).toString()
      console.log('loading model', modelUrl)
      denoiseSession = await ort.InferenceSession.create(modelUrl, { executionProviders: ['webgpu', 'webgl', 'wasm'] })
    } catch (e) {
      // leave null
      console.error('denoiser model failed to load', e)
      postMessage({ type: 'model_error', model: 'denoiser', error: String(e) })
    }
  }
}

onmessage = async (ev: MessageEvent<AnyMsg>) => {
  const msg = ev.data
  if (msg.type === 'init') {
    await ensureModels()
    try { postMessage({ type: 'worker-ready', worker: 'model' }) } catch {}
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