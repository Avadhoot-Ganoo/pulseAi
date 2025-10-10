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

type Phase = 'idle' | 'measuring' | 'done'

export default function App() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [telemetryEnabled, setTelemetryEnabled] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const { start: startTimer, secondsLeft, reset: resetTimer } = useTimer(30)
  const { landmarks, faceBox, stability } = useFaceMesh({ videoRef })
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
  } = useRPPG({ videoRef, landmarks })
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

  const onRetake = () => {
    resetTimer()
    setPhase('idle')
  }

  return (
    <div className="min-h-screen bg-gradient-futuristic">
      <header className="px-6 py-4 flex items-center justify-between">
        <div className="text-xl font-semibold neon-text">PulseAR</div>
        <div className="flex items-center gap-3">
          <button className="text-xs opacity-70 underline" onClick={() => setPrivacyOpen(true)}>Privacy</button>
          <div className="text-xs opacity-70">Not a medical device — wellness only</div>
        </div>
      </header>

      <main className="px-6 pb-16">
        <div className="max-w-4xl mx-auto glass rounded-2xl p-4">
          <div className="relative rounded-xl overflow-hidden">
            <CameraFeed ref={videoRef} active={phase !== 'idle'} />

            {phase === 'measuring' && (
              <>
                <OverlayPulseRing faceBox={faceBox} hr={applyOffsets(hr).hr} />
                <ThreeOverlay hr={applyOffsets(hr).hr} />
                <OverlayPPG
                  landmarks={landmarks}
                  liveHR={applyOffsets(hr).hr}
                  liveAmp={Math.min(1, Math.abs(signal[signal.length - 1] || 0))}
                  sqi={sqi ? Math.max(0, Math.min(1, (sqi.snr || 0) / 20)) : 0.5}
                  progress={(30 - secondsLeft) / 30}
                  waveform={waveform}
                />
                <div className="absolute top-4 left-4">
                  <StabilityMeter value={Math.round(stability * 100)} />
                </div>
                <div className="absolute top-4 right-4">
                  <ProgressCircle total={30} value={30 - secondsLeft} />
                </div>
                <div className="absolute bottom-4 left-4">
                  {sqi && <QualityMeter snrDb={sqi.snr} />}
                </div>
                <div className="absolute bottom-4 right-4">
                  <PerfStats stats={perfStats} />
                </div>
              </>
            )}
          </div>
        </div>

        <AnimatePresence initial={false}>
          {phase === 'idle' && <Onboarding onStart={onStart} />}

          {phase === 'done' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl mx-auto mt-8"
            >
              {/* Show results on the overlay near the face */}
              <div className="relative rounded-xl overflow-hidden">
                <CameraFeed ref={videoRef} active={true} />
                <OverlayResults
                  landmarks={landmarks}
                  hr={applyOffsets(hr, metrics.spo2, metrics.bp).hr}
                  spo2={applyOffsets(hr, metrics.spo2, metrics.bp).spo2}
                  bp={applyOffsets(hr, metrics.spo2, metrics.bp).bp}
                  confidence={confidence}
                />
              </div>
              <ResultDashboard
                hr={applyOffsets(hr, metrics.spo2, metrics.bp).hr}
                hrv={hrv}
                metrics={{
                  spo2: applyOffsets(hr, metrics.spo2, metrics.bp).spo2,
                  bp: applyOffsets(hr, metrics.spo2, metrics.bp).bp,
                }}
                confidence={confidence}
                signal={signal}
                onRetake={onRetake}
              />
            </motion.div>
          )}
        </AnimatePresence>
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
