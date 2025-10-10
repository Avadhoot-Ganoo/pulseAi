import { sqiFromSnrDb, sqiLabel } from '../utils/sqi'

export default function QualityMeter({ snrDb }: { snrDb: number }) {
  const status = sqiFromSnrDb(snrDb)
  const color = status === 'green' ? 'bg-green-500' : status === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'
  const barWidth = Math.max(5, Math.min(100, Math.round((snrDb + 10) * 4)))
  return (
    <div className="rounded-xl p-3 bg-white/5 border border-white/10 w-56">
      <div className="text-xs opacity-70 mb-2">Signal Quality</div>
      <div className="h-2 w-full bg-white/10 rounded">
        <div className={`h-2 ${color} rounded`} style={{ width: `${barWidth}%` }} />
      </div>
      <div className="mt-2 text-xs opacity-80">{sqiLabel(status)} ({snrDb.toFixed(1)} dB)</div>
    </div>
  )
}