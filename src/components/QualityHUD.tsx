import React from 'react'

export default function QualityHUD({
  stability,
  sqi,
  streak,
  motionOK,
}: {
  stability: number
  sqi: { snr: number; ac?: number; regularity?: number; score?: number } | null
  streak: number
  motionOK: boolean
}) {
  const snr = sqi?.snr ?? 0
  const score = sqi?.score ?? Math.max(0, Math.min(1, 0.5 + snr / 24))
  const reg = sqi?.regularity ?? 0
  const ac = sqi?.ac ?? 0

  const tip = !motionOK
    ? 'Hold steady — too much motion'
    : score < 0.5
    ? 'Improve lighting, center face, reduce movement'
    : score < 0.7
    ? 'Nice! Keep still for best quality'
    : 'Excellent signal — keep going'

  return (
    <div className="absolute left-1/2 -translate-x-1/2 top-4 z-40 flex flex-col items-center gap-2">
      <div className="px-4 py-2 rounded-full bg-white/10 backdrop-blur text-xs text-white shadow">
        <div className="flex items-center gap-3">
          <span>Stability: {Math.round(stability * 100)}%</span>
          <span>Quality: {Math.round((score || 0) * 100)}%</span>
          <span>Streak: {streak}</span>
        </div>
      </div>
      <div className="w-64 h-2 rounded-full overflow-hidden bg-white/10">
        <div
          className="h-full bg-emerald-400 transition-all"
          style={{ width: `${Math.max(0, Math.min(100, streak * 3))}%` }}
        />
      </div>
      <div className="text-[11px] text-white/90">{tip}</div>
      <div className="flex gap-2 text-[10px] text-white/80">
        <span>SNR: {snr.toFixed(1)}dB</span>
        <span>AC: {Math.round(ac * 100)}%</span>
        <span>Reg: {Math.round(reg * 100)}%</span>
      </div>
    </div>
  )
}