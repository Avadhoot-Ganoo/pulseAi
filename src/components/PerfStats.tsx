type Stats = Record<string, { count: number; total: number; avg: number }>

export default function PerfStats({ stats }: { stats: Stats | null }) {
  if (!stats) return null
  return (
    <div className="rounded-xl p-2 bg-black/40 text-xs text-white/80">
      {Object.entries(stats).map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3">
          <span>{k}</span>
          <span>{v.avg.toFixed(1)} ms</span>
        </div>
      ))}
    </div>
  )
}