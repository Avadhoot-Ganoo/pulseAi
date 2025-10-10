// Outlier handling utilities
// Re-export Hampel filter and provide Median Absolute Deviation helpers
import { hampelFilter as hampel } from './filters'

export function hampelFilter(signal: number[], k = 7, t0 = 3) {
  return hampel(signal, k, t0)
}

export function median(arr: number[]) {
  const s = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export function mad(arr: number[]) {
  const m = median(arr)
  const devs = arr.map((v) => Math.abs(v - m))
  return median(devs)
}

export function rejectByMad(arr: number[], thresh = 3.5) {
  const m = median(arr)
  const mads = mad(arr) + 1e-6
  return arr.map((v) => {
    const score = Math.abs(v - m) / mads
    return score > thresh ? m : v
  })
}