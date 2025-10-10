// Face worker: smooth landmarks (EMA), compute centroid drift for motion, and output stabilized ROIs
export type Landmarks = Array<{ x: number; y: number; z: number }>
export type ROI = { x: number; y: number; w: number; h: number }

let prevLandmarks: Landmarks | null = null
let emaLandmarks: Landmarks | null = null
let alpha = 0.6
let motionThresholdPx = 12

function emaUpdate(cur: Landmarks): Landmarks {
  if (!emaLandmarks) return (emaLandmarks = cur)
  return (emaLandmarks = cur.map((p, i) => ({
    x: alpha * emaLandmarks![i].x + (1 - alpha) * p.x,
    y: alpha * emaLandmarks![i].y + (1 - alpha) * p.y,
    z: alpha * emaLandmarks![i].z + (1 - alpha) * p.z,
  })))
}

function centroid(lms: Landmarks) {
  let sx = 0, sy = 0
  for (const p of lms) { sx += p.x; sy += p.y }
  return { x: sx / lms.length, y: sy / lms.length }
}

function roisFromLandmarks(
  landmarks: Landmarks,
  vw: number,
  vh: number
): { forehead: ROI; leftCheek: ROI; rightCheek: ROI; nose: ROI } | null {
  const foreheadIdx = 10
  const leftCheekIdx = 234
  const rightCheekIdx = 454
  const noseIdx = 1
  const f = landmarks[foreheadIdx]
  const l = landmarks[leftCheekIdx]
  const r = landmarks[rightCheekIdx]
  const n = landmarks[noseIdx]
  if (!f || !l || !r || !n) return null
  const boxW = vw * 0.35, boxH = vh * 0.2
  const forehead: ROI = { x: f.x * vw - boxW * 0.5, y: f.y * vh - boxH * 0.5, w: boxW, h: boxH }
  const leftCheek: ROI = { x: l.x * vw - boxW * 0.35, y: l.y * vh - boxH * 0.45, w: boxW * 0.7, h: boxH * 0.9 }
  const rightCheek: ROI = { x: r.x * vw - boxW * 0.35, y: r.y * vh - boxH * 0.45, w: boxW * 0.7, h: boxH * 0.9 }
  const nose: ROI = { x: n.x * vw - boxW * 0.25, y: n.y * vh - boxH * 0.35, w: boxW * 0.5, h: boxH * 0.7 }
  const clamp = (roi: ROI): ROI => ({
    x: Math.max(0, Math.min(vw - roi.w, roi.x)),
    y: Math.max(0, Math.min(vh - roi.h, roi.y)),
    w: Math.max(8, Math.min(vw, roi.w)),
    h: Math.max(8, Math.min(vh, roi.h)),
  })
  return { forehead: clamp(forehead), leftCheek: clamp(leftCheek), rightCheek: clamp(rightCheek), nose: clamp(nose) }
}

function stabilize(prev: ROI | null, next: ROI, sAlpha = 0.7): ROI {
  if (!prev) return next
  const lerp = (a: number, b: number) => sAlpha * a + (1 - sAlpha) * b
  return { x: lerp(prev.x, next.x), y: lerp(prev.y, next.y), w: lerp(prev.w, next.w), h: lerp(prev.h, next.h) }
}

let prevROIs: { forehead: ROI; leftCheek: ROI; rightCheek: ROI; nose: ROI } | null = null

onmessage = (ev) => {
  const { type, landmarks, vw, vh, cfg } = ev.data || {}
  if (cfg) {
    alpha = cfg.alpha ?? alpha
    motionThresholdPx = cfg.motionThresholdPx ?? motionThresholdPx
  }
  if (type === 'landmarks' && Array.isArray(landmarks)) {
    const smoothed = emaUpdate(landmarks)
    const cPrev = prevLandmarks ? centroid(prevLandmarks) : centroid(smoothed)
    const cCur = centroid(smoothed)
    prevLandmarks = smoothed
    const driftPx = Math.sqrt((cCur.x - cPrev.x) ** 2 + (cCur.y - cPrev.y) ** 2) * Math.max(vw, vh)
    const rois = roisFromLandmarks(smoothed, vw, vh)
    if (!rois) return
    const stab = {
      forehead: stabilize(prevROIs?.forehead || null, rois.forehead),
      leftCheek: stabilize(prevROIs?.leftCheek || null, rois.leftCheek),
      rightCheek: stabilize(prevROIs?.rightCheek || null, rois.rightCheek),
      nose: stabilize(prevROIs?.nose || null, rois.nose),
    }
    prevROIs = stab
    const motionOK = driftPx < motionThresholdPx
    postMessage({ type: 'rois', rois: stab, motionOK, driftPx })
  }
}