export type SQIStatus = 'green' | 'yellow' | 'red'

export function sqiFromSnrDb(snrDb: number): SQIStatus {
  if (snrDb > 5) return 'green'
  if (snrDb >= 0) return 'yellow'
  return 'red'
}

export function sqiLabel(status: SQIStatus): string {
  return status === 'green' ? 'Good' : status === 'yellow' ? 'Fair' : 'Poor'
}