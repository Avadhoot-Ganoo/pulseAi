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
  const lerp = (a: number, b: number) => alpha * a + (1 - alpha) * b
  return {
    x: lerp(prev.x, next.x),
    y: lerp(prev.y, next.y),
    w: lerp(prev.w, next.w),
    h: lerp(prev.h, next.h),
  }
}