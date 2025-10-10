// Feature helpers to build input vectors for ONNX models
export function featureColorRatio(rgbMean: [number, number, number]) {
  const [r, g, b] = rgbMean
  return (r + 1e-6) / (g + 1e-6)
}

export function spo2FeatureVector({ ratio, hrvRmssd, snr }: { ratio: number; hrvRmssd: number; snr: number }) {
  // Normalize values to reasonable ranges
  const r = Math.min(2, Math.max(0.3, ratio))
  const hrv = Math.min(150, Math.max(5, hrvRmssd))
  const s = Math.min(20, Math.max(-20, snr))
  return [r, hrv, s]
}

export function bpFeatureVector({ hr, spo2, hrvSdnn }: { hr: number; spo2: number; hrvSdnn: number }) {
  const h = Math.min(180, Math.max(40, hr))
  const s = Math.min(100, Math.max(85, spo2))
  const sd = Math.min(200, Math.max(10, hrvSdnn))
  return [h, s, sd]
}