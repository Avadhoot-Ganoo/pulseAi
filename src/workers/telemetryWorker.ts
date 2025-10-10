type PerfMsg = { type: 'perf'; name: string; dt: number }
type ResetMsg = { type: 'reset' }
type AnyMsg = PerfMsg | ResetMsg

const stats: Record<string, { count: number; total: number; avg: number }> = {}

onmessage = (ev: MessageEvent<AnyMsg>) => {
  const msg = ev.data
  if (msg.type === 'reset') {
    for (const k of Object.keys(stats)) delete stats[k]
    postMessage({ type: 'stats', stats })
    return
  }
  if (msg.type === 'perf') {
    const s = stats[msg.name] || { count: 0, total: 0, avg: 0 }
    s.count += 1
    s.total += msg.dt
    s.avg = s.total / s.count
    stats[msg.name] = s
    if (s.count % 30 === 0) {
      postMessage({ type: 'stats', stats })
    }
  }
}