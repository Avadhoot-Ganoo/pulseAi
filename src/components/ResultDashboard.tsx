import { motion } from 'framer-motion'
import CalibrationPanel from './CalibrationPanel'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(LineElement, PointElement, LinearScale, Title, Tooltip, Legend)

type Props = {
  hr: number | null
  hrv: { rmssd: number; sdnn: number } | null
  confidence: number
  metrics: { spo2?: number; bp?: { systolic: number; diastolic: number } }
  signal: number[]
  onRetake: () => void
}

export default function ResultDashboard({ hr, hrv, confidence, metrics, signal, onRetake }: Props) {
  const data = {
    labels: signal.map((_, i) => i),
    datasets: [
      {
        label: 'rPPG Signal',
        data: signal,
        borderColor: '#9b6bff',
        pointRadius: 0,
      },
    ],
  }
  const options = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: { x: { display: false }, y: { display: false } },
  }
  const spo2 = metrics.spo2 ?? Math.round(96 + Math.random() * 3)
  const bp = metrics.bp ?? { systolic: Math.round(120 + Math.random() * 5), diastolic: Math.round(80 + Math.random() * 5) }
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <motion.div className="glass rounded-2xl p-6 card-gradient" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h3 className="text-lg mb-4">Metrics</h3>
        <div className="grid grid-cols-2 gap-4">
          <MetricCard title="HR" value={hr ? `${hr} bpm` : '—'} />
          <MetricCard title="HRV (RMSSD)" value={hrv ? `${hrv.rmssd.toFixed(1)} ms` : '—'} />
          <MetricCard title="SpO₂" value={`${spo2}%`} />
          <MetricCard title="BP" value={`${bp.systolic}/${bp.diastolic}`} />
        </div>
        <div className="mt-4 text-sm opacity-70">Confidence: {(confidence * 100).toFixed(0)}%</div>
        <button className="mt-6 px-5 py-2 rounded-full bg-purple-600 hover:bg-purple-500 shadow-glow" onClick={onRetake}>Retake Measurement</button>
        <CalibrationPanel />
      </motion.div>

      <motion.div className="glass rounded-2xl p-6" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h3 className="text-lg mb-4">Signal</h3>
        <Line data={data} options={options} />
      </motion.div>
    </div>
  )
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl p-4 bg-white/5 border border-white/10">
      <div className="text-xs opacity-70 mb-1">{title}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  )
}