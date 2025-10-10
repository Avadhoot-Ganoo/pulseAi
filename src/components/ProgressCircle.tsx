type Props = { total: number; value: number }

export default function ProgressCircle({ total, value }: Props) {
  const size = 72
  const stroke = 6
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const progress = Math.min(Math.max(value / total, 0), 1)
  const offset = circ * (1 - progress)
  return (
    <svg width={size} height={size} className="drop-shadow">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.2)" strokeWidth={stroke} fill="transparent" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="url(#grad)"
        strokeWidth={stroke}
        fill="transparent"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#9b6bff" />
          <stop offset="100%" stopColor="#6ac6ff" />
        </linearGradient>
      </defs>
    </svg>
  )
}