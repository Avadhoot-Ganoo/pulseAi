export function autocorrStrength(signal: number[], dt: number, minBpm = 48, maxBpm = 180): number {
  if (signal.length < 64) return 0
  // Normalize
  const mean = signal.reduce((a, b) => a + b, 0) / signal.length
  const s = signal.map((v) => v - mean)
  const denom = s.reduce((a, b) => a + b * b, 0)
  if (denom === 0) return 0
  // Cardiac period window
  const minT = 60 / maxBpm
  const maxT = 60 / minBpm
  const minLag = Math.max(1, Math.floor(minT / dt))
  const maxLag = Math.min(s.length - 2, Math.floor(maxT / dt))
  let best = 0
  for (let lag = minLag; lag <= maxLag; lag++) {
    let acc = 0
    for (let i = 0; i < s.length - lag; i++) acc += s[i] * s[i + lag]
    const corr = acc / denom
    if (corr > best) best = corr
  }
  // Clamp to 0..1
  return Math.max(0, Math.min(1, best))
}

export function beatRegularity(ibis: number[]): number {
  if (!ibis || ibis.length < 3) return 0
  const mean = ibis.reduce((a, b) => a + b, 0) / ibis.length
  const sd = Math.sqrt(ibis.reduce((a, b) => a + (b - mean) * (b - mean), 0) / ibis.length)
  const cv = mean > 0 ? sd / mean : 1
  // Higher regularity -> lower CV
  const reg = 1 - Math.max(0, Math.min(1, cv))
  return reg
}

export function sqiScore({ snrDb, ac, reg }: { snrDb: number; ac: number; reg: number }): number {
  // Map SNR dB to 0..1
  const snrNorm = Math.max(0, Math.min(1, 0.5 + snrDb / 24))
  // Weighted blend; tuneable
  const score = 0.5 * snrNorm + 0.25 * ac + 0.25 * reg
  return Math.max(0, Math.min(1, score))
}

export function sqiFromSnrDb(snrDb: number): 'red' | 'yellow' | 'green' {
  // Simple categorization: < -2 dB => red, < 6 dB => yellow, else green
  if (snrDb < -2) return 'red'
  if (snrDb < 6) return 'yellow'
  return 'green'
}

export function sqiLabel(status: 'red' | 'yellow' | 'green') {
  return status === 'green' ? 'Excellent' : status === 'yellow' ? 'Fair' : 'Poor'
}