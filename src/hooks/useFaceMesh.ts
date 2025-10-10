import { useEffect, useRef, useState } from 'react'
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

type Box = { x: number; y: number; width: number; height: number }
type Landmark = { x: number; y: number; z: number }

export default function useFaceMesh({
  videoRef,
}: {
  videoRef: React.MutableRefObject<HTMLVideoElement | null>
}) {
  const [landmarks, setLandmarks] = useState<Landmark[] | null>(null)
  const [faceBox, setFaceBox] = useState<Box | null>(null)
  const [stability, setStability] = useState(1)

  const prevLandmarks = useRef<Landmark[] | null>(null)

  useEffect(() => {
    let rafId: number | null = null
    let landmarker: FaceLandmarker | null = null
    const video = videoRef.current
    if (!video) return
    const demo = new URLSearchParams(window.location.search).get('demo') === '1'

    ;(async () => {
      if (demo) {
        // Skip face landmarking in demo mode; rPPG uses ROI fallback
        return
      }
      try {
        const fileset = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        )
        landmarker = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
        })
      } catch (e) {
        console.warn('Failed to initialize FaceLandmarker', e)
        return
      }

      const loop = () => {
        if (!video || !landmarker) return
        const result = landmarker.detectForVideo(video, performance.now())
        const lms: Landmark[] | undefined = (result?.faceLandmarks?.[0] as any) ?? undefined
        if (lms && lms.length) {
          setLandmarks(lms)
          // Compute bounding box from normalized landmarks
          const xs = lms.map((p) => p.x)
          const ys = lms.map((p) => p.y)
          const xMin = Math.min(...xs)
          const xMax = Math.max(...xs)
          const yMin = Math.min(...ys)
          const yMax = Math.max(...ys)
          setFaceBox({ x: xMin, y: yMin, width: xMax - xMin, height: yMax - yMin })

          // Stability as inverse of mean landmark displacement
          const prev = prevLandmarks.current
          if (prev) {
            let sum = 0
            let count = Math.min(prev.length, lms.length)
            for (let i = 0; i < count; i++) {
              const dx = lms[i].x - prev[i].x
              const dy = lms[i].y - prev[i].y
              sum += Math.sqrt(dx * dx + dy * dy)
            }
            const motion = sum / count
            const score = Math.max(0, Math.min(1, 1 / (1 + motion * 200)))
            setStability(score)
          }
          prevLandmarks.current = lms
        }
        rafId = requestAnimationFrame(loop)
      }
      rafId = requestAnimationFrame(loop)
    })()

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      try {
        landmarker?.close()
      } catch {}
    }
  }, [videoRef])

  return { landmarks, faceBox, stability }
}