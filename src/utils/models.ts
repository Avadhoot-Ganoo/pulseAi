import * as ort from 'onnxruntime-web'

let spo2Session: ort.InferenceSession | null = null
let bpSession: ort.InferenceSession | null = null
let modelLoaded = false

function firstKey(obj: Record<string, any>): string {
  const keys = Object.keys(obj)
  return keys.length ? keys[0] : 'output'
}

export async function loadModels() {
  const query = new URLSearchParams(typeof location !== 'undefined' ? location.search : '')
  if (query.get('nomodel') === '1') {
    modelLoaded = false
    spo2Session = null
    bpSession = null
    throw new Error('model inference skipped (nomodel=1)')
  }
  // Point ORT to local wasm assets if available
  try {
    ;(ort as any).env.wasm.wasmPaths = '/ort-wasm'
  } catch {}
  const spo2Path = query.get('spo2_model') || '/models/spo2.onnx'
  const bpPath = query.get('bp_model') || '/models/bp.onnx'
  try {
    spo2Session = await ort.InferenceSession.create(spo2Path, { executionProviders: ['wasm'] })
    bpSession = await ort.InferenceSession.create(bpPath, { executionProviders: ['wasm'] })
    modelLoaded = true
  } catch (e) {
    modelLoaded = false
    spo2Session = null
    bpSession = null
    throw e
  }
}

export async function inferSpo2(features: number[]): Promise<number> {
  if (!modelLoaded || !spo2Session) throw new Error('SpO2 model not loaded')
  const inputNames = ['input', 'features', 'x']
  const tensor = new ort.Tensor('float32', Float32Array.from(features), [1, features.length])
  for (const name of inputNames) {
    try {
      const out = await spo2Session.run({ [name]: tensor })
      const key = firstKey(out)
      const val = out[key]?.data?.[0]
      if (Number.isFinite(val)) return Math.round(Math.max(0, Math.min(100, val)))
    } catch {}
  }
  throw new Error('SpO2 inference failed — check input/output names')
}

export async function inferBP(features: number[]): Promise<{ systolic: number; diastolic: number }> {
  if (!modelLoaded || !bpSession) throw new Error('BP model not loaded')
  const inputNames = ['input', 'features', 'x']
  const tensor = new ort.Tensor('float32', Float32Array.from(features), [1, features.length])
  for (const name of inputNames) {
    try {
      const out = await bpSession.run({ [name]: tensor })
      const key = firstKey(out)
      const arr = out[key]?.data
      if (Array.isArray(arr) && arr.length >= 2) {
        const sys = Math.round(arr[0])
        const dia = Math.round(arr[1])
        return { systolic: sys, diastolic: dia }
      }
    } catch {}
  }
  throw new Error('BP inference failed — check input/output names')
}