import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

type Props = {
  active?: boolean
  onError?: (msg: string) => void
}

const CameraFeed = forwardRef<HTMLVideoElement, Props>(({ active = false, onError }, ref) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useImperativeHandle(ref, () => videoRef.current as HTMLVideoElement)

  useEffect(() => {
    let stream: MediaStream | null = null
    let mounted = true
    const demo = new URLSearchParams(window.location.search).get('demo') === '1'
    const forceAutoCam = new URLSearchParams(window.location.search).get('autocam') === '1'

    const init = async () => {
      try {
        if (!window.isSecureContext) {
          console.warn('Insecure context: camera requires HTTPS or localhost')
          onError?.('Insecure context — use HTTPS or localhost')
        }
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          onError?.('Camera API not available in this browser')
        }
        if (demo) {
          const canvas = document.createElement('canvas')
          canvas.width = 640
          canvas.height = 480
          const ctx = canvas.getContext('2d')
          if (!ctx) throw new Error('Canvas context not available')
          const start = performance.now()
          const draw = () => {
            const t = (performance.now() - start) / 1000
            // Simulate gentle pulse by modulating green channel
            const g = Math.round(110 + 40 * Math.sin(2 * Math.PI * 1.2 * t))
            ctx.fillStyle = `rgb(100, ${g}, 100)`
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            if (mounted) requestAnimationFrame(draw)
          }
          draw()
          stream = canvas.captureStream(30)
        } else {
          // Minimal constraints: try user-facing then any camera. Support deviceId via ?deviceId=
          const qp = new URLSearchParams(window.location.search)
          const devId = qp.get('deviceId')
          const candidates: MediaStreamConstraints[] = []
          if (devId) candidates.push({ video: { deviceId: { exact: devId } }, audio: false })
          candidates.push(
            { video: { facingMode: { ideal: 'user' } }, audio: false },
            { video: true, audio: false },
          )
          let lastErr: any = null
          for (const c of candidates) {
            try {
              stream = await navigator.mediaDevices.getUserMedia(c)
              break
            } catch (err) {
              lastErr = err
            }
          }
          if (!stream) throw lastErr || new Error('No camera stream available')
        }
        if (!mounted) return
        if (videoRef.current) {
          console.log('camera stream', stream)
          videoRef.current.srcObject = stream
          videoRef.current.playsInline = true
          videoRef.current.muted = true
          await videoRef.current.play().then(() => {
            console.log('video.play succeeded')
          }).catch((e) => {
            console.error('video.play failed', e)
          })
          console.log('camera ready', (videoRef.current as any).srcObject)
          // Diagnostic frame loop ping to worker
          const v = videoRef.current
          const hasRVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype
          if (hasRVFC) {
            ;(v as any).requestVideoFrameCallback(function cb() {
              try { workerPing() } catch {}
              (v as any).requestVideoFrameCallback(cb)
            })
          } else {
            setInterval(() => { try { workerPing() } catch {} }, 500)
          }
        }
      } catch (e: any) {
        console.error('Camera permission or init error', e)
        let msg = 'Camera init error'
        if (e?.name === 'NotFoundError') msg = 'No camera found or unavailable'
        else if (e?.name === 'NotAllowedError') msg = 'Camera permission denied'
        else if (e?.name === 'OverconstrainedError') msg = 'Requested camera constraints not satisfied'
        else msg = e?.message ? String(e.message) : String(e)
        onError?.(msg)
      }
    }

    if (active || forceAutoCam) init()

    return () => {
      mounted = false
      if (stream) {
        stream.getTracks().forEach((t) => t.stop())
      }
    }
  }, [active])

  return (
    <video
      ref={videoRef}
      className="w-full aspect-video object-cover"
      playsInline
      autoPlay
      muted
    />
  )
})

export default CameraFeed

// Diagnostic: ping rPPG worker if available
function workerPing() {
  try {
    ;(window as any).__rppgWorker?.postMessage({ type: 'ping', ts: performance.now() })
  } catch {}
}