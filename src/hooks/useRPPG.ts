import { useCallback, useEffect, useRef, useState } from 'react'
import { loadModels, inferSpo2, inferBP } from '../utils/models'
import { featureColorRatio, spo2FeatureVector, bpFeatureVector } from '../utils/features'
import { roisFromLandmarks, stabilizeROI } from '../utils/roi'

type Landmarks = Array<{ x: number; y: number; z: number }>

type Metrics = {
  spo2?: number
  bp?: { systolic: number; diastolic: number }
}

export default function useRPPG({
  videoRef,
  landmarks,
}: {
  videoRef: React.MutableRefObject<HTMLVideoElement | null>
  landmarks: Landmarks | null
}) {
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

    // Lazy model worker
    const mWorker = new Worker(new URL('../workers/modelWorker.ts', import.meta.url), { type: 'module' })
    modelWorkerRef.current = mWorker
    mWorker.postMessage({ type: 'init' })

    mWorker.onmessage = (ev) => {
      const data = ev.data
      if (data.type === 'spo2' && data.value !== null) {
        setMetrics((prev) => ({ ...prev, spo2: data.value }))
      }
      if (data.type === 'bp' && data.value !== null) {
        setMetrics((prev) => ({ ...prev, bp: data.value }))
      }
    }

    worker.onmessage = (ev) => {
      const data = ev.data
      if (data.type === 'update') {
        setHr(data.hr ?? null)
        setHrv(data.hrv ?? null)
        setConfidence(data.confidence ?? 0)
        if (Array.isArray(data.signal)) setSignal(data.signal)
        if (data.metrics) setMetrics(data.metrics)
        if (data.sqi) setSqi(data.sqi)
      }
      if (data.type === 'waveform' && data.data instanceof Float32Array) {
        setWaveform(data.data)
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
      mWorker.terminate()
      telemetryWorkerRef.current?.terminate()
    }
  }, [])

  const computeROIs = useCallback(() => {
    const video = videoRef.current
    const demo = new URLSearchParams(window.location.search).get('demo') === '1'
    if (!video) return null

    // Demo mode: fixed ROIs when landmarks are unavailable
    if (!landmarks && demo) {
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
  }, [videoRef, landmarks])

  const sampleROI = useCallback(
    (rect: { x: number; y: number; w: number; h: number }) => {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas) return [0, 0, 0]
      const ctx = canvas.getContext('2d')
      if (!ctx) return [0, 0, 0]
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const img = ctx.getImageData(rect.x, rect.y, rect.w, rect.h)
      const data = img.data
      let r = 0,
        g = 0,
        b = 0
      const pixels = rect.w * rect.h
      for (let i = 0; i < data.length; i += 4) {
        r += data[i]
        g += data[i + 1]
        b += data[i + 2]
      }
      return [r / pixels, g / pixels, b / pixels]
    },
    [videoRef]
  )

  const loop = useCallback(() => {
    if (!running) return
    const now = performance.now()
    if (lastFrameTs.current !== null) {
      const dt = now - lastFrameTs.current
      telemetryWorkerRef.current?.postMessage({ type: 'perf', name: 'frame', dt })
    }
    lastFrameTs.current = now
    const rois = computeROIs()
    if (rois) {
      const f = sampleROI(rois.forehead)
      const l = sampleROI(rois.leftCheek)
      const r = sampleROI(rois.rightCheek)
      lastRGB.current = { forehead: f, leftCheek: l, rightCheek: r }
      workerRef.current?.postMessage({
        type: 'frame',
        ts: performance.now(),
        forehead: f,
        leftCheek: l,
        rightCheek: r,
      })
    }
    requestAnimationFrame(loop)
  }, [computeROIs, sampleROI, running])

  const startMeasurement = useCallback(() => {
    if (running) return
    setRunning(true)
    loadModels().catch(() => {})
    workerRef.current?.postMessage({ type: 'start' })
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
        // heuristics applied in models.ts; already handled
      })
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
  }
}