import { useCallback, useEffect, useRef, useState } from 'react'
import { loadModels, inferSpo2, inferBP } from '../utils/models'
import { featureColorRatio, spo2FeatureVector, bpFeatureVector } from '../utils/features'
import { roisFromLandmarks, stabilizeROI } from '../utils/roi'

type Landmarks = Array<{ x: number; y: number; z: number }>

type Metrics = {
  spo2?: number
  bp?: { systolic: number; diastolic: number }
}

type ROI = { x: number; y: number; w: number; h: number }
type ROISet = { forehead: ROI; leftCheek: ROI; rightCheek: ROI }

export default function useRPPG({
  videoRef,
  landmarks,
  rois: roisArg,
  motionOK,
}: {
  videoRef: React.MutableRefObject<HTMLVideoElement | null>
  landmarks: Landmarks | null
  rois?: ROISet | null
  motionOK?: boolean
}) {
  const query = new URLSearchParams(typeof location !== 'undefined' ? location.search : '')
  const skipModel = query.get('nomodel') === '1'
  const mixParam = (query.get('mix') || '').toLowerCase()
  const mixMode: 'green' | 'chrom' | 'pos' = mixParam === 'chrom' ? 'chrom' : mixParam === 'pos' ? 'pos' : 'green'
  const workerRef = useRef<Worker | null>(null)
  const modelWorkerRef = useRef<Worker | null>(null)
  const telemetryWorkerRef = useRef<Worker | null>(null)
  const [perfStats, setPerfStats] = useState<Record<string, { count: number; total: number; avg: number }> | null>(null)
  const lastFrameTs = useRef<number | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [hr, setHr] = useState<number | null>(null)
  const [hrv, setHrv] = useState<{ rmssd: number; sdnn: number } | null>(null)
  const [confidence, setConfidence] = useState<number>(0)
  const [signal, setSignal] = useState<number[]>([])
  const [metrics, setMetrics] = useState<Metrics>({})
  const [sqi, setSqi] = useState<{ snr: number; rois?: { forehead: number; leftCheek: number; rightCheek: number } } | null>(null)
  const [running, setRunning] = useState(false)
  const lastRGB = useRef<{ forehead: number[]; leftCheek: number[]; rightCheek: number[] } | null>(null)
  const [waveform, setWaveform] = useState<Float32Array | null>(null)
  const prevROIs = useRef<{ forehead: { x: number; y: number; w: number; h: number }; leftCheek: { x: number; y: number; w: number; h: number }; rightCheek: { x: number; y: number; w: number; h: number } } | null>(null)
  const [modelError, setModelError] = useState<string | null>(null)
  const frameCounterRef = useRef<number>(0)

  useEffect(() => {
    // create an offscreen canvas
    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 480
    canvasRef.current = canvas
    const worker = new Worker(new URL('../workers/rppgWorker.ts', import.meta.url), {
      type: 'module',
    })
    workerRef.current = worker
    ;(window as any).__rppgWorker = worker
    console.log('spawned rppg worker')

    // Lazy model worker (skip when nomodel=1)
    let mWorker: Worker | null = null
    if (!skipModel) {
      mWorker = new Worker(new URL('../workers/modelWorker.ts', import.meta.url), { type: 'module' })
      modelWorkerRef.current = mWorker
      mWorker.postMessage({ type: 'init' })
    } else {
      setModelError('model inference skipped (nomodel=1)')
    }

    if (mWorker) {
      mWorker.onmessage = (ev) => {
        const data = ev.data
        console.log('worker->main modelWorker', data)
        if (data.type === 'model_error') {
          console.error('Model failed to load — check console/network', data)
          setModelError(`${data.model}: ${data.error}`)
        }
        if (data.type === 'spo2' && data.value !== null) {
          setMetrics((prev) => ({ ...prev, spo2: data.value }))
        }
        if (data.type === 'bp' && data.value !== null) {
          setMetrics((prev) => ({ ...prev, bp: data.value }))
        }
        if (data.type === 'denoised' && data.data instanceof Float32Array) {
          setWaveform(data.data)
        }
      }
    }

    worker.onmessage = (ev) => {
      const data = ev.data
      console.log('worker->main rppgWorker', data)
      if (data.type === 'update') {
        setHr(data.hr ?? null)
        setHrv(data.hrv ?? null)
        setConfidence(data.confidence ?? 0)
        if (Array.isArray(data.signal)) setSignal(data.signal)
        if (data.metrics) setMetrics(data.metrics)
        if (data.sqi) setSqi(data.sqi)
      }
      if (data.type === 'waveform' && data.data instanceof Float32Array) {
        // send to denoiser if available; falls back to echo in worker
        if (!skipModel) {
          try {
            modelWorkerRef.current?.postMessage({ type: 'denoise', data: data.data }, [data.data.buffer])
          } catch {
            setWaveform(data.data)
          }
        } else {
          setWaveform(data.data)
        }
      }
      if (data.type === 'beat') {
        try {
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) (navigator as any).vibrate(10)
        } catch {}
      }
    }

    // Telemetry worker
    const tWorker = new Worker(new URL('../workers/telemetryWorker.ts', import.meta.url), { type: 'module' })
    telemetryWorkerRef.current = tWorker
    tWorker.onmessage = (ev) => {
      const data = ev.data
      if (data.type === 'stats') setPerfStats(data.stats)
    }

    return () => {
      worker.terminate()
      mWorker?.terminate()
      telemetryWorkerRef.current?.terminate()
    }
  }, [])

  const computeROIs = useCallback(() => {
    const video = videoRef.current
    if (!video) return null

    // If stabilized ROIs are provided from face worker, prefer them
    if (roisArg && roisArg.forehead && roisArg.leftCheek && roisArg.rightCheek) {
      prevROIs.current = roisArg
      return roisArg
    }

    // Fallback ROIs when landmarks are unavailable (offline-first)
    if (!landmarks) {
      const vw = video.videoWidth
      const vh = video.videoHeight
      const forehead = {
        x: vw * 0.25,
        y: vh * 0.2,
        w: vw * 0.5,
        h: vh * 0.15,
      }
      const leftCheek = {
        x: vw * 0.2,
        y: vh * 0.5,
        w: vw * 0.25,
        h: vh * 0.18,
      }
      const rightCheek = {
        x: vw * 0.55,
        y: vh * 0.5,
        w: vw * 0.25,
        h: vh * 0.18,
      }
      return { forehead, leftCheek, rightCheek }
    }

    // derive ROIs from landmarks
    if (!landmarks) return null
    const rois = roisFromLandmarks(landmarks, video.videoWidth, video.videoHeight)
    if (!rois) return null
    const stab = {
      forehead: stabilizeROI(prevROIs.current?.forehead || null, rois.forehead, 0.7),
      leftCheek: stabilizeROI(prevROIs.current?.leftCheek || null, rois.leftCheek, 0.7),
      rightCheek: stabilizeROI(prevROIs.current?.rightCheek || null, rois.rightCheek, 0.7),
    }
    prevROIs.current = stab
    return stab
  }, [videoRef, landmarks, roisArg])

  const sampleROI = useCallback(
    (rect: { x: number; y: number; w: number; h: number }) => {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas) return [0, 0, 0]
      const ctx = canvas.getContext('2d')
      if (!ctx) return [0, 0, 0]
      // Draw only ROI sub-rect to a small canvas to reduce memory bandwidth
      if (canvas.width !== rect.w || canvas.height !== rect.h) {
        canvas.width = Math.max(8, rect.w)
        canvas.height = Math.max(8, rect.h)
      }
      ctx.drawImage(
        video,
        rect.x,
        rect.y,
        rect.w,
        rect.h,
        0,
        0,
        rect.w,
        rect.h,
      )
      const img = ctx.getImageData(0, 0, rect.w, rect.h)
      const data = img.data
      let rSum = 0,
        gSum = 0,
        bSum = 0,
        count = 0
      // Robust gating: exclude saturated/too-dark pixels AND non-skin chroma using YCbCr bounds.
      // Y approximates luminance; Cb/Cr thresholds capture a broad skin cluster.
      const low = 10, high = 245
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        const Y = 0.299 * r + 0.587 * g + 0.114 * b
        if (Y <= low || Y >= high) continue
        const Cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
        const Cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
        // Broad skin cluster (tuned to be permissive for varied tones)
        if (Cb < 77 || Cb > 127) continue
        if (Cr < 133 || Cr > 173) continue
        rSum += r
        gSum += g
        bSum += b
        count += 1
      }
      const denom = Math.max(1, count)
      return [rSum / denom, gSum / denom, bSum / denom]
    },
    [videoRef]
  )

  const loop = useCallback(() => {
    const video = videoRef.current
    if (!running || !video) return
    const hasRVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype
    const tickRAF = () => {
      const now = performance.now()
      if (lastFrameTs.current !== null) {
        const dt = now - lastFrameTs.current
        telemetryWorkerRef.current?.postMessage({ type: 'perf', name: 'frame', dt })
      }
      lastFrameTs.current = now
      if (motionOK === false) {
        telemetryWorkerRef.current?.postMessage({ type: 'perf', name: 'frame_drop', dt: 0 })
        requestAnimationFrame(tickRAF)
        return
      }
      const rois = computeROIs()
      if (rois) {
        const f = sampleROI(rois.forehead)
        const l = sampleROI(rois.leftCheek)
        const r = sampleROI(rois.rightCheek)
        lastRGB.current = { forehead: f, leftCheek: l, rightCheek: r }
        frameCounterRef.current += 1
        workerRef.current?.postMessage({
          type: 'frame',
          ts: performance.now(),
          frameId: frameCounterRef.current,
          forehead: f,
          leftCheek: l,
          rightCheek: r,
        })
      }
      requestAnimationFrame(tickRAF)
    }
    if (hasRVFC) {
      ;(video as any).requestVideoFrameCallback(function cb(_now: number, _metadata: any) {
        const now = performance.now()
        if (lastFrameTs.current !== null) {
          const dt = now - lastFrameTs.current
          telemetryWorkerRef.current?.postMessage({ type: 'perf', name: 'frame', dt })
        }
        lastFrameTs.current = now
        if (motionOK !== false) {
          const rois = computeROIs()
          if (rois) {
            const f = sampleROI(rois.forehead)
            const l = sampleROI(rois.leftCheek)
            const r = sampleROI(rois.rightCheek)
            lastRGB.current = { forehead: f, leftCheek: l, rightCheek: r }
            frameCounterRef.current += 1
            workerRef.current?.postMessage({
              type: 'frame',
              ts: performance.now(),
              frameId: frameCounterRef.current,
              forehead: f,
              leftCheek: l,
              rightCheek: r,
            })
          }
        } else {
          telemetryWorkerRef.current?.postMessage({ type: 'perf', name: 'frame_drop', dt: 0 })
        }
        ;(video as any).requestVideoFrameCallback(cb)
      })
    } else {
      requestAnimationFrame(tickRAF)
    }
  }, [computeROIs, sampleROI, running, motionOK])

  const startMeasurement = useCallback(() => {
    if (running) return
    setRunning(true)
    loadModels().catch((e) => {
      const msg = e instanceof Error ? e.message : String(e)
      setModelError(msg)
    })
    workerRef.current?.postMessage({ type: 'start', mix: mixMode })
    console.log('worker-ready', !!workerRef.current)
    requestAnimationFrame(loop)
  }, [loop, running])

  const stopMeasurement = useCallback(() => {
    setRunning(false)
    workerRef.current?.postMessage({ type: 'stop' })
    telemetryWorkerRef.current?.postMessage({ type: 'reset' })
    // derive SpO2 and BP using ONNX or heuristic
    const h = hrv?.rmssd ?? 30
    const rgb = lastRGB.current?.forehead ?? [1, 1, 1]
    const ratio = featureColorRatio([rgb[0], rgb[1], rgb[2]])
    const snr = sqi?.snr ?? 0
    const spo2FV = spo2FeatureVector({ ratio, hrvRmssd: h, snr })
    modelWorkerRef.current?.postMessage({ type: 'infer_spo2', features: spo2FV })
    // fallback heuristic or main-thread model
    inferSpo2([ratio])
      .then((s) => {
        setMetrics((prev) => ({ ...prev, spo2: s }))
        const bpFV = bpFeatureVector({ hr: Math.round(hr || 70), spo2: s, hrvSdnn: hrv?.sdnn ?? 60 })
        modelWorkerRef.current?.postMessage({ type: 'infer_bp', features: bpFV })
        return inferBP([h, s]).then((bp) => setMetrics((prev) => ({ ...prev, bp })))
      })
      .catch(() => {
        // If real model inference fails, surface error for diagnostics overlay
        setModelError('model inference failed — check model files and names')
      })
    console.log('final_result', { hr, hrv, metrics })
  }, [])

  return {
    startMeasurement,
    stopMeasurement,
    hr,
    hrv,
    signal,
    confidence,
    metrics,
    sqi,
    perfStats,
    waveform,
    modelError,
  }
}