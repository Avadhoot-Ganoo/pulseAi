import React from 'react'

export default function OverlayResults({
  landmarks,
  hr,
  spo2,
  bp,
  confidence,
}: {
  landmarks: Array<{ x: number; y: number; z: number }> | null
  hr: number | null
  spo2?: number
  bp?: { systolic: number; diastolic: number }
  confidence: number
}) {
  if (!landmarks) return null
  const forehead = landmarks[10]
  if (!forehead) return null
  const cx = forehead.x * 100
  const cy = forehead.y * 100
  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${cx}%`,
    top: `${cy}%`,
    transform: 'translate(-50%, -80%)',
  }
  return (
    <div style={style} className="pointer-events-none">
      <div className="rounded-2xl px-4 py-3 bg-black/50 backdrop-blur-md text-white shadow-xl">
        <div className="text-sm opacity-80">Final Vitals</div>
        <div className="flex gap-4 mt-1">
          <div>
            <div className="text-xs opacity-70">HR</div>
            <div className="text-lg font-semibold">{hr ?? '--'} bpm</div>
          </div>
          <div>
            <div className="text-xs opacity-70">SpO₂</div>
            <div className="text-lg font-semibold">{spo2 ? Math.round(spo2) : '--'}%</div>
          </div>
          <div>
            <div className="text-xs opacity-70">BP</div>
            <div className="text-lg font-semibold">
              {bp ? `${Math.round(bp.systolic)}/${Math.round(bp.diastolic)}` : '--'}
            </div>
          </div>
        </div>
        <div className="mt-2 text-xs opacity-70">Confidence: {Math.round(confidence * 100)}%</div>
      </div>
    </div>
  )
}