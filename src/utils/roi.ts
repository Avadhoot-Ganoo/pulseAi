export type ROI = { x: number; y: number; w: number; h: number }

export function roisFromLandmarks(
  landmarks: Array<{ x: number; y: number; z: number }> | null,
  videoWidth: number,
  videoHeight: number
): { forehead: ROI; leftCheek: ROI; rightCheek: ROI } | null {
  if (!landmarks || landmarks.length === 0) return null
  // Compute face bounding box
  const xs = landmarks.map((p) => p.x)
  const ys = landmarks.map((p) => p.y)
  const xMin = Math.min(...xs)
  const xMax = Math.max(...xs)
  const yMin = Math.min(...ys)
  const yMax = Math.max(...ys)
  const box = {
    x: xMin * videoWidth,
    y: yMin * videoHeight,
    w: (xMax - xMin) * videoWidth,
    h: (yMax - yMin) * videoHeight,
  }

  // Landmark indices from MediaPipe FaceMesh (approximate cheeks/forehead center)
  const foreheadIdx = 10
  const leftCheekIdx = 234
  const rightCheekIdx = 454
  const foreheadPt = landmarks[foreheadIdx]
  const leftCheekPt = landmarks[leftCheekIdx]
  const rightCheekPt = landmarks[rightCheekIdx]
  if (!foreheadPt || !leftCheekPt || !rightCheekPt) return null

  const forehead: ROI = {
    x: foreheadPt.x * videoWidth - box.w * 0.25,
    y: foreheadPt.y * videoHeight - box.h * 0.08,
    w: box.w * 0.5,
    h: box.h * 0.15,
  }
  const leftCheek: ROI = {
    x: leftCheekPt.x * videoWidth - box.w * 0.12,
    y: leftCheekPt.y * videoHeight - box.h * 0.09,
    w: box.w * 0.25,
    h: box.h * 0.18,
  }
  const rightCheek: ROI = {
    x: rightCheekPt.x * videoWidth - box.w * 0.12,
    y: rightCheekPt.y * videoHeight - box.h * 0.09,
    w: box.w * 0.25,
    h: box.h * 0.18,
  }

  return clampROIs({ forehead, leftCheek, rightCheek }, videoWidth, videoHeight)
}

export function clampROIs(rois: { forehead: ROI; leftCheek: ROI; rightCheek: ROI }, vw: number, vh: number) {
  const clamp = (r: ROI): ROI => ({
    x: Math.max(0, Math.min(vw - r.w, r.x)),
    y: Math.max(0, Math.min(vh - r.h, r.y)),
    w: Math.max(4, Math.min(vw, r.w)),
    h: Math.max(4, Math.min(vh, r.h)),
  })
  return {
    forehead: clamp(rois.forehead),
    leftCheek: clamp(rois.leftCheek),
    rightCheek: clamp(rois.rightCheek),
  }
}

export function stabilizeROI(prev: ROI | null, next: ROI, alpha = 0.6): ROI {
  if (!prev) return next
  // Adapt smoothing based on motion magnitude: stronger smoothing when jitter is small,
  // lighter smoothing when displacement is large so ROI can follow face quickly.
  const cxPrev = prev.x + prev.w * 0.5
  const cyPrev = prev.y + prev.h * 0.5
  const cxNext = next.x + next.w * 0.5
  const cyNext = next.y + next.h * 0.5
  const disp = Math.hypot(cxNext - cxPrev, cyNext - cyPrev)
  const scale = Math.max(next.w, next.h)
  const norm = Math.max(0, Math.min(1, scale > 0 ? disp / (scale * 0.25) : 0))
  const aEff = Math.max(0.5, Math.min(0.9, alpha - 0.2 * (1 - norm)))
  const lerp = (a: number, b: number) => aEff * a + (1 - aEff) * b
  return {
    x: lerp(prev.x, next.x),
    y: lerp(prev.y, next.y),
    w: lerp(prev.w, next.w),
    h: lerp(prev.h, next.h),
  }
}

// Optional helper for callers that want explicit adaptive stabilization without providing alpha
export function stabilizeROIAdaptive(prev: ROI | null, next: ROI): ROI {
  return stabilizeROI(prev, next, 0.7)
}