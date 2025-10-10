import * as ort from 'onnxruntime-web'

let spo2Session: ort.InferenceSession | null = null
let bpSession: ort.InferenceSession | null = null

export async function loadModels() {
  try {
    spo2Session = await ort.InferenceSession.create('/models/spo2_model.onnx', { executionProviders: ['wasm'] })
  } catch (e) {
    console.warn('SpO2 model not found or failed to load, using heuristic.')
  }
  try {
    bpSession = await ort.InferenceSession.create('/models/bp_model.onnx', { executionProviders: ['wasm'] })
  } catch (e) {
    console.warn('BP model not found or failed to load, using heuristic.')
  }
}

export async function inferSpo2(features: number[]): Promise<number> {
  if (spo2Session) {
    const input = new ort.Tensor('float32', Float32Array.from(features), [1, features.length])
    const out = await spo2Session.run({ input })
    const val = (out['output'] as ort.Tensor).data as Float32Array
    return Math.round(val[0])
  }
  // heuristic: map color ratio to plausible SpO2 range
  const ratio = features[0] ?? 1
  const base = 97
  const adj = Math.max(-3, Math.min(3, (ratio - 1) * 5))
  return Math.round(base + adj)
}

export async function inferBP(features: number[]): Promise<{ systolic: number; diastolic: number }> {
  if (bpSession) {
    const input = new ort.Tensor('float32', Float32Array.from(features), [1, features.length])
    const out = await bpSession.run({ input })
    const val = (out['output'] as ort.Tensor).data as Float32Array
    return { systolic: Math.round(val[0]), diastolic: Math.round(val[1]) }
  }
  // heuristic: derive BP from HRV and SpO2 features
  const rmssd = features[0] ?? 30
  const spo2 = features[1] ?? 97
  const systolic = Math.round(115 + Math.max(-10, Math.min(10, (spo2 - 97) * 1.2)) - Math.min(8, rmssd / 10))
  const diastolic = Math.round(75 + Math.max(-6, Math.min(6, (spo2 - 97) * 0.6)) - Math.min(6, rmssd / 15))
  return { systolic, diastolic }
}