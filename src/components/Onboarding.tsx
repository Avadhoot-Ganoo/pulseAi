import { motion } from 'framer-motion'

export default function Onboarding({ onStart }: { onStart: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-4xl mx-auto mt-8 text-center"
    >
      <h2 className="text-2xl font-semibold mb-2">Real‑time Vitals via Camera</h2>
      <p className="opacity-75 mb-6">30‑second scan using rPPG and lightweight on‑device models.</p>
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div className="rounded-xl p-4 bg-white/5 border border-white/10">1. Align face inside frame</div>
        <div className="rounded-xl p-4 bg-white/5 border border-white/10">2. Stay still and look straight</div>
        <div className="rounded-xl p-4 bg-white/5 border border-white/10">3. Ensure bright lighting</div>
      </div>
      <button className="mt-6 px-6 py-3 rounded-full bg-purple-600 hover:bg-purple-500 shadow-glow" onClick={onStart}>
        Start Scan
      </button>
    </motion.div>
  )
}