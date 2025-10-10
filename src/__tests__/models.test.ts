import { describe, it, expect } from 'vitest'
import { inferSpo2, inferBP } from '../../src/utils/models'

describe('Model heuristics (no ONNX sessions)', () => {
  it('inferSpo2 maps ratio to plausible 94–100% range', async () => {
    const s1 = await inferSpo2([1])
    const s2 = await inferSpo2([1.2])
    const s3 = await inferSpo2([0.8])
    ;[s1, s2, s3].forEach((s) => {
      expect(s).toBeGreaterThanOrEqual(94)
      expect(s).toBeLessThanOrEqual(100)
    })
  })

  it('inferBP returns reasonable integer values with rmssd & spo2 features', async () => {
    const bp1 = await inferBP([30, 97])
    const bp2 = await inferBP([20, 99])
    const bp3 = await inferBP([40, 95])
    const vals = [bp1, bp2, bp3]
    vals.forEach((bp) => {
      expect(Number.isInteger(bp.systolic)).toBe(true)
      expect(Number.isInteger(bp.diastolic)).toBe(true)
      // sanity bounds (non-medical)
      expect(bp.systolic).toBeGreaterThanOrEqual(90)
      expect(bp.systolic).toBeLessThanOrEqual(150)
      expect(bp.diastolic).toBeGreaterThanOrEqual(55)
      expect(bp.diastolic).toBeLessThanOrEqual(100)
    })
  })
})