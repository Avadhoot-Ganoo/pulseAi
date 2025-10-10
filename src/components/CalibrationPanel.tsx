import useCalibration from '../hooks/useCalibration'

export default function CalibrationPanel() {
  const { calibration, save } = useCalibration()
  const cal = calibration || { hrOffset: 0, spo2Offset: 0, bpOffsetSys: 0, bpOffsetDia: 0 }
  return (
    <div className="glass rounded-xl p-4 mt-4">
      <div className="text-sm opacity-70 mb-2">Personal calibration (saved locally)</div>
      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center gap-3">
          <span className="w-24">HR offset</span>
          <input type="number" className="input" value={cal.hrOffset}
            onChange={(e) => save({ ...cal, hrOffset: parseInt(e.target.value || '0', 10) })} />
        </label>
        <label className="flex items-center gap-3">
          <span className="w-24">SpO₂ offset</span>
          <input type="number" className="input" value={cal.spo2Offset}
            onChange={(e) => save({ ...cal, spo2Offset: parseInt(e.target.value || '0', 10) })} />
        </label>
        <label className="flex items-center gap-3">
          <span className="w-24">BP sys offset</span>
          <input type="number" className="input" value={cal.bpOffsetSys}
            onChange={(e) => save({ ...cal, bpOffsetSys: parseInt(e.target.value || '0', 10) })} />
        </label>
        <label className="flex items-center gap-3">
          <span className="w-24">BP dia offset</span>
          <input type="number" className="input" value={cal.bpOffsetDia}
            onChange={(e) => save({ ...cal, bpOffsetDia: parseInt(e.target.value || '0', 10) })} />
        </label>
      </div>
    </div>
  )
}