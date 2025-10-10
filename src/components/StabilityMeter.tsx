export default function StabilityMeter({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className="w-48 glass rounded-full px-3 py-2">
      <div className="text-xs mb-1 opacity-80">Stability</div>
      <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${v}%`, background: 'linear-gradient(90deg,#6ac6ff,#9b6bff)' }}
        />
      </div>
    </div>
  )
}