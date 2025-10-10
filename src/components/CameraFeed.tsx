import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

type Props = {
  active?: boolean
}

const CameraFeed = forwardRef<HTMLVideoElement, Props>(({ active = false }, ref) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useImperativeHandle(ref, () => videoRef.current as HTMLVideoElement)

  useEffect(() => {
    let stream: MediaStream | null = null
    let mounted = true
    const demo = new URLSearchParams(window.location.search).get('demo') === '1'

    const init = async () => {
      try {
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
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: 'user' },
            audio: false,
          })
        }
        if (!mounted) return
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
      } catch (e) {
        console.error('Camera permission or init error', e)
      }
    }

    if (active) init()

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