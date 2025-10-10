import React, { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

export default function OverlayPPG({
  landmarks,
  liveHR,
  liveAmp,
  sqi,
  progress,
  waveform,
}: any) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    function draw() {
      if (!canvas || !landmarks) {
        requestAnimationFrame(draw)
        return
      }
      canvas.width = canvas.clientWidth
      canvas.height = canvas.clientHeight
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // map forehead center (indices may vary per mesh implementation)
      const forehead = landmarks[10]
      if (!forehead) {
        requestAnimationFrame(draw)
        return
      }
      const cx = forehead.x * canvas.width
      const cy = forehead.y * canvas.height

      // pulsing halo
      const pulseScale = 1 + 0.12 * (liveAmp || 0)
      const haloR = Math.min(canvas.width, canvas.height) * 0.18
      ctx.save()
      const sqiAlpha = 0.35 * (0.5 + 0.5 * (sqi ?? 0.5))
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
      const leftCheek = landmarks[234]
      const rightCheek = landmarks[454]
      const drawCheek = (pt: any) => {
        if (!pt) return
        const x = pt.x * canvas.width,
          y = pt.y * canvas.height
        ctx.save()
        ctx.globalAlpha = 0.18 + 0.5 * (liveAmp || 0) * (sqi ?? 0.5)
        ctx.fillStyle = 'rgba(255,90,120,0.8)'
        ctx.beginPath()
        ctx.ellipse(x, y, 36 + 40 * (liveAmp || 0), 18 + 20 * (liveAmp || 0), 0, 0, Math.PI * 2)
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
      const samples = Array.isArray(waveform) || waveform instanceof Float32Array
        ? Array.from(waveform as Float32Array)
        : generateMockWaveform(liveAmp || 0)
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
      ctx.fillStyle = sqi > 0.7 ? 'lime' : sqi > 0.4 ? 'yellow' : 'crimson'
      ctx.fillRect(canvas.width - 28, 20, 16, Math.max(8, Math.floor((sqi ?? 0.5) * 120)))
      ctx.restore()

      requestAnimationFrame(draw)
    }
    draw()
  }, [landmarks, liveHR, liveAmp, sqi, progress])

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
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