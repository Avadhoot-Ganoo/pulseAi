import { describe, it, expect } from 'vitest'
import { roisFromLandmarks, stabilizeROI } from '../utils/roi'

describe('ROI selection from landmarks', () => {
  it('returns clamped ROIs within video bounds', () => {
    const vw = 640, vh = 480
    // mock minimal landmarks set
    const landmarks = new Array(500).fill(null).map((_, i) => ({ x: 0.5, y: 0.5, z: 0 }))
    // cheeks and forehead positions
    landmarks[10] = { x: 0.5, y: 0.2, z: 0 }
    landmarks[234] = { x: 0.35, y: 0.6, z: 0 }
    landmarks[454] = { x: 0.65, y: 0.6, z: 0 }
    const rois = roisFromLandmarks(landmarks, vw, vh)
    expect(rois).toBeTruthy()
    if (!rois) return
    const { forehead, leftCheek, rightCheek } = rois
    const inBounds = (r: any) => r.x >= 0 && r.y >= 0 && r.x + r.w <= vw && r.y + r.h <= vh
    expect(inBounds(forehead)).toBe(true)
    expect(inBounds(leftCheek)).toBe(true)
    expect(inBounds(rightCheek)).toBe(true)
  })
})

describe('ROI stabilization reduces jitter', () => {
  it('exponential smoothing lowers variance', () => {
    const base = { x: 100, y: 100, w: 120, h: 80 }
    // simulate jittery next positions
    const jitter = [
      { x: 102, y: 98, w: 121, h: 79 },
      { x: 96, y: 103, w: 119, h: 82 },
      { x: 105, y: 97, w: 122, h: 80 },
      { x: 94, y: 104, w: 118, h: 81 },
    ]
    const rawXs = jitter.map((j) => j.x)
    const stabXs = jitter.reduce((acc, j, idx) => {
      const prev = idx === 0 ? base : acc[acc.length - 1]
      const s = stabilizeROI(prev, j, 0.7)
      acc.push(s)
      return acc
    }, [] as any[]).map((s) => s.x)
    const variance = (arr: number[]) => {
      const m = arr.reduce((a, b) => a + b, 0) / arr.length
      return arr.reduce((a, b) => a + (b - m) * (b - m), 0) / arr.length
    }
    expect(variance(stabXs)).toBeLessThan(variance(rawXs))
  })
})