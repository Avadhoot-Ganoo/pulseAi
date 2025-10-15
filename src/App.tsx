import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import CameraFeed from './components/CameraFeed'
import OverlayPulseRing from './components/OverlayPulseRing'
import QualityMeter from './components/QualityMeter'
import PrivacyModal from './components/PrivacyModal'
import ProgressCircle from './components/ProgressCircle'
import StabilityMeter from './components/StabilityMeter'
import ResultDashboard from './components/ResultDashboard'
import useTimer from './hooks/useTimer'
import Onboarding from './components/Onboarding'
import useFaceMesh from './hooks/useFaceMesh'
import useRPPG from './hooks/useRPPG'
import useCalibration from './hooks/useCalibration'
import ThreeOverlay from './components/ThreeOverlay'
import PerfStats from './components/PerfStats'
import OverlayPPG from './components/OverlayPPG'
import OverlayResults from './components/OverlayResults'
import QualityHUD from './components/QualityHUD'
import DiagnosticsOverlay from './components/DiagnosticsOverlay'

type Phase = 'idle' | 'measuring' | 'done'

export default function App() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [telemetryEnabled, setTelemetryEnabled] = useState(false)
  const [streak, setStreak] = useState(0)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const showDiag = new URLSearchParams(location.search).get('diag') === '1'
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const { start: startTimer, secondsLeft, reset: resetTimer } = useTimer(30)
  const { landmarks, faceBox, stability, rois, motionOK } = useFaceMesh({ videoRef })
  const {
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
  } = useRPPG({ videoRef, landmarks, rois, motionOK })
  const { applyOffsets } = useCalibration()

  const onStart = async () => {
    setPhase('measuring')
    startTimer()
    startMeasurement()
  }

  useEffect(() => {
    if (phase === 'measuring' && secondsLeft === 0) {
      stopMeasurement()
      setPhase('done')
    }
  }, [phase, secondsLeft, stopMeasurement])

  useEffect(() => {
    if (phase !== 'measuring') {
      setStreak(0)
      return
    }
    const good = motionOK && (sqi?.score ?? ((sqi?.snr || 0) > 6 ? 0.7 : 0.4)) >= 0.6
    setStreak((s) => (good ? Math.min(100, s + 1) : 0))
  }, [phase, sqi, motionOK])

  const onRetake = () => {
    resetTimer()
    setPhase('idle')
  }

  // Persistent debug box: shows HR and SQI to prove processing
  useEffect(() => {
    const dbgId = 'dbg'
    let dbg = document.getElementById(dbgId)
    if (!dbg) {
      dbg = document.createElement('div')
      dbg.id = dbgId
      dbg.style.cssText = 'position:fixed;left:8px;top:8px;z-index:99999;background:#0008;color:#fff;padding:8px;border-radius:8px;font:12px/1.4 system-ui'
      document.body.appendChild(dbg)
    }
    const iv = setInterval(() => {
      const hrVal = applyOffsets(hr).hr
      const sqiVal = sqi?.score ?? (sqi ? Math.max(0, Math.min(1, 0.5 + (sqi.snr || 0) / 24)) : 0)
      dbg!.textContent = `hr:${hrVal ? Math.round(hrVal) : '--'} sqi:${sqiVal.toFixed(2)}`
    }, 250)
    return () => {
      clearInterval(iv)
    }
  }, [hr, sqi])

  return (
    <div className="min-h-screen bg-gradient-futuristic">
      <main className="px-6 pb-24">
        <div className="max-w-4xl mx-auto glass rounded-2xl p-4">
          <div className="relative rounded-xl overflow-hidden">
            <CameraFeed ref={videoRef} active={phase !== 'idle'} onError={(m) => setCameraError(m)} />
            {modelError && (
              <div className="absolute top-2 left-2 z-[9999] bg-red-600/80 text-white text-xs px-3 py-2 rounded">
                Model failed to load — check console/network: {modelError}
              </div>
            )}
            {cameraError && (
              <div className="absolute top-2 right-2 z-[9999] bg-red-600/80 text-white text-xs px-3 py-2 rounded">
                Camera error — {cameraError}. Ensure HTTPS and allow camera permission.
              </div>
            )}
            {(showDiag || cameraError) && <DiagnosticsOverlay cameraError={cameraError} />}

            {/* Always render AR overlay area; it will fall back to center if no landmarks */}
            <OverlayPPG
              landmarks={landmarks}
              liveHR={applyOffsets(hr).hr}
              liveAmp={Math.min(1, Math.abs(signal[signal.length - 1] || 0))}
              sqi={sqi || 0.5}
              progress={phase === 'measuring' ? (30 - secondsLeft) / 30 : 0}
              waveform={waveform}
              hrv={hrv}
              metrics={metrics}
            />

            {/* Single control button: Start/Stop + Privacy link */}
            <div className="absolute bottom-4 left-0 right-0 flex justify-center z-[99999]">
              <button
                className="px-6 py-3 rounded-full bg-purple-600 hover:bg-purple-500 shadow-glow flex items-center gap-3"
                onClick={() => {
                  if (phase !== 'measuring') {
                    onStart()
                  } else {
                    stopMeasurement()
                    setPhase('done')
                  }
                }}
              >
                <span>{phase !== 'measuring' ? 'Start Scan' : 'Stop Scan'}</span>
                <span className="text-xs opacity-80">(Tap = consent; local-only)</span>
                <span
                  className="text-xs underline opacity-80"
                  onClick={(e) => {
                    e.stopPropagation()
                    setPrivacyOpen(true)
                  }}
                >
                  Privacy
                </span>
              </button>
            </div>
          </div>
        </div>
      </main>
      <PrivacyModal
        open={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
        telemetryEnabled={telemetryEnabled}
        onToggleTelemetry={setTelemetryEnabled}
      />
    </div>
  )
}
