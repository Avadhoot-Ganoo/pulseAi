import React, { useEffect, useRef } from 'react'

export default function OverlayPPG({
  landmarks,
  liveHR,
  liveAmp,
  sqi,
  progress,
  waveform,
  hrv,
  metrics,
}: any) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 })
  const landmarksRef = useRef<any>(null)
  const hrRef = useRef<number | null>(null)
  const ampRef = useRef<number>(0)
  const sqiRef = useRef<any>(null)
  const hrvRef = useRef<any>(null)
  const metricsRef = useRef<any>(null)
  const waveformRef = useRef<Float32Array | number[] | null>(null)

  // Keep refs in sync with latest props without re-creating RAF loop
  useEffect(() => { landmarksRef.current = landmarks }, [landmarks])
  useEffect(() => { hrRef.current = liveHR ?? null }, [liveHR])
  useEffect(() => { ampRef.current = liveAmp ?? 0 }, [liveAmp])
  useEffect(() => { sqiRef.current = sqi ?? null }, [sqi])
  useEffect(() => { hrvRef.current = hrv ?? null }, [hrv])
  useEffect(() => { metricsRef.current = metrics ?? null }, [metrics])
  useEffect(() => { waveformRef.current = waveform ?? null }, [waveform])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    console.log('overlay_drawLoop_started')

    const draw = () => {
      // Throttle expensive canvas resize to only when size actually changes
      const cw = canvas.clientWidth
      const ch = canvas.clientHeight
      const last = lastSizeRef.current
      if (cw !== last.w || ch !== last.h) {
        canvas.width = cw
        canvas.height = ch
        lastSizeRef.current = { w: cw, h: ch }
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const lms = landmarksRef.current
      // map forehead center (indices may vary per mesh implementation)
      const forehead = lms && lms[10]
      const cx = forehead ? forehead.x * canvas.width : canvas.width * 0.5
      const cy = forehead ? forehead.y * canvas.height : canvas.height * 0.4

      // pulsing halo
      const pulseScale = 1 + 0.12 * (ampRef.current || 0)
      const haloR = Math.min(canvas.width, canvas.height) * 0.18
      ctx.save()
      const sqiVal = sqiRef.current
      const sqiAlpha = 0.35 * (0.5 + 0.5 * (typeof sqiVal === 'number' ? sqiVal : (sqiVal?.score ?? 0.5)))
      ctx.globalAlpha = sqiAlpha
      const g = ctx.createRadialGradient(cx, cy, haloR * 0.2, cx, cy, haloR * pulseScale)
      g.addColorStop(0, 'rgba(40,180,255,0.9)')
      g.addColorStop(1, 'rgba(140,80,255,0.0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(cx, cy, haloR * pulseScale, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      // cheek glow (left & right)
      const leftCheek = lms && lms[234]
      const rightCheek = lms && lms[454]
      const drawCheek = (pt: any) => {
        if (!pt) return
        const x = pt.x * canvas.width,
          y = pt.y * canvas.height
        ctx.save()
        ctx.globalAlpha = 0.18 + 0.5 * (ampRef.current || 0) * (typeof sqiVal === 'number' ? sqiVal : (sqiVal?.score ?? 0.5))
        ctx.fillStyle = 'rgba(255,90,120,0.8)'
        ctx.beginPath()
        ctx.ellipse(x, y, 36 + 40 * (ampRef.current || 0), 18 + 20 * (ampRef.current || 0), 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
      drawCheek(leftCheek)
      drawCheek(rightCheek)

      // micro-ppg strip (bottom-left)
      const stripW = 220,
        stripH = 48
      const sx = 20,
        sy = canvas.height - stripH - 20
      ctx.save()
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      roundRect(ctx, sx - 8, sy - 8, stripW + 16, stripH + 16, 8)
      ctx.fill()
      // waveform from worker-provided shared buffer (fallback to mock)
      ctx.strokeStyle = 'rgba(0,220,255,0.95)'
      ctx.lineWidth = 2
      ctx.beginPath()
      const wf = waveformRef.current
      const samples = Array.isArray(wf) || wf instanceof Float32Array
        ? Array.from(wf as any)
        : generateMockWaveform(ampRef.current || 0)
      for (let i = 0; i < samples.length; i++) {
        const px = sx + (i / samples.length) * stripW
        const py = sy + stripH / 2 - samples[i] * (stripH * 0.42)
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()
      ctx.restore()

      // SQI small meter
      ctx.save()
      const sqiNum = typeof sqiVal === 'number' ? sqiVal : (sqiVal?.score ?? 0.5)
      ctx.fillStyle = sqiNum > 0.7 ? 'lime' : sqiNum > 0.4 ? 'yellow' : 'crimson'
      ctx.fillRect(canvas.width - 28, 20, 16, Math.max(8, Math.floor((sqiNum ?? 0.5) * 120)))
      ctx.restore()

      // Feature HUD (top-left): HR, HRV, SQI/SNR, ROI weights, SpO2, BP
      ctx.save()
      const pad = 12
      const boxW = 240
      const boxH = 150
      ctx.globalAlpha = 0.85
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      roundRect(ctx, pad, pad, boxW, boxH, 10)
      ctx.fill()
      ctx.fillStyle = '#cfe9ff'
      ctx.font = '12px system-ui'
      const hrText = `HR: ${hrRef.current ? Math.round(hrRef.current) + ' bpm' : '—'}`
      const hrvObj = hrvRef.current
      const rmssd = hrvObj?.rmssd != null ? hrvObj.rmssd.toFixed(1) : '—'
      const sdnn = hrvObj?.sdnn != null ? hrvObj.sdnn.toFixed(1) : '—'
      const snrDb = (sqiVal?.snr != null) ? sqiVal.snr.toFixed(1) : '—'
      const sqiScore = (sqiVal?.score != null) ? sqiVal.score.toFixed(2) : (typeof sqiVal === 'number' ? sqiVal.toFixed(2) : '—')
      const wfW = sqiVal?.weights?.wf != null ? Math.round(sqiVal.weights.wf * 100) : null
      const wlW = sqiVal?.weights?.wl != null ? Math.round(sqiVal.weights.wl * 100) : null
      const wrW = sqiVal?.weights?.wr != null ? Math.round(sqiVal.weights.wr * 100) : null
      const metricsObj = metricsRef.current
      const spo2Text = metricsObj?.spo2 != null ? `${Math.round(metricsObj.spo2)}%` : '—'
      const bpText = metricsObj?.bp ? `${metricsObj.bp.systolic}/${metricsObj.bp.diastolic}` : '—'
      const lines = [
        hrText,
        `HRV: RMSSD ${rmssd} ms | SDNN ${sdnn} ms`,
        `SQI: ${sqiScore}  SNR: ${snrDb} dB`,
        `ROI weights: F ${wfW ?? '—'}%  L ${wlW ?? '—'}%  R ${wrW ?? '—'}%`,
        `SpO₂: ${spo2Text}  BP: ${bpText}`,
      ]
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], pad + 12, pad + 22 + i * 22)
      }
      ctx.restore()

      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-[9999]" />
}

// small helpers
function roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
function generateMockWaveform(amp: number) {
  // placeholder — replace by reading shared waveform buffer from worker (Transferable)
  const L = 128
  const out = new Array(L)
  for (let i = 0; i < L; i++) {
    out[i] = 0.3 * amp * Math.sin((i / 128) * Math.PI * 2 * 3) * Math.exp(-0.002 * i)
  }
  return out as number[]
}