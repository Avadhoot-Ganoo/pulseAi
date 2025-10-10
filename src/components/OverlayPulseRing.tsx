import { motion } from 'framer-motion'

type Box = { x: number; y: number; width: number; height: number } | null

export default function OverlayPulseRing({ faceBox, hr }: { faceBox: Box; hr: number | null }) {
  if (!faceBox) return null
  const period = hr ? 60 / hr : 1.2
  return (
    <div className="absolute inset-0 pointer-events-none">
      <motion.div
        className="absolute rounded-full border-2"
        style={{
          left: `${faceBox.x * 100}%`,
          top: `${faceBox.y * 100}%`,
          width: `${faceBox.width * 100}%`,
          height: `${faceBox.height * 100}%`,
          borderColor: 'rgba(155,107,255,0.8)',
          boxShadow: '0 0 30px rgba(155,107,255,0.6), inset 0 0 20px rgba(106,198,255,0.4)',
        }}
        animate={{ scale: [1, 1.03, 1] }}
        transition={{ duration: period, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}