import { useEffect } from 'react'

type Props = {
  open: boolean
  onClose: () => void
  telemetryEnabled: boolean
  onToggleTelemetry: (v: boolean) => void
}

export default function PrivacyModal({ open, onClose, telemetryEnabled, onToggleTelemetry }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="glass rounded-2xl p-6 max-w-lg w-full">
        <h3 className="text-lg mb-3">Privacy</h3>
        <p className="text-sm opacity-80 mb-4">
          PulseAR processes all data locally on your device. No video or biometric data leaves your browser.
        </p>
        <div className="mt-2 flex items-center gap-3">
          <input
            id="telemetry"
            type="checkbox"
            checked={telemetryEnabled}
            onChange={(e) => onToggleTelemetry(e.target.checked)}
          />
          <label htmlFor="telemetry" className="text-sm">
            Optional anonymous telemetry (fps, SNR, success rate). No identifiable data.
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="px-4 py-2 rounded-full bg-white/10" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}