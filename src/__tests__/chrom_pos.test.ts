import { describe, it, expect } from 'vitest'
import { chromCombineSignals } from '../../src/utils/chrom'
import { posCombineSignals } from '../../src/utils/pos'

describe('CHROM/POS signal combination', () => {
  it('chromCombineSignals computes g - 0.5*r - 0.5*b', () => {
    const r = [2, 4, 6]
    const g = [10, 12, 14]
    const b = [6, 8, 10]
    const out = chromCombineSignals(r, g, b)
    const expected = g.map((gv, i) => gv - 0.5 * r[i] - 0.5 * b[i])
    expect(out).toEqual(expected)
  })

  it('posCombineSignals computes g - (r + b)/2', () => {
    const r = [1, 3, 5]
    const g = [9, 11, 13]
    const b = [5, 7, 9]
    const out = posCombineSignals(r, g, b)
    const expected = g.map((gv, i) => gv - (r[i] + b[i]) / 2)
    expect(out).toEqual(expected)
  })
})