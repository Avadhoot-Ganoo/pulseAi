import { useCallback, useEffect, useRef, useState } from 'react'

export default function useTimer(totalSeconds: number) {
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds)
  const intervalRef = useRef<number | null>(null)

  const start = useCallback(() => {
    if (intervalRef.current) return
    const startAt = performance.now()
    intervalRef.current = window.setInterval(() => {
      const now = performance.now()
      const elapsed = Math.floor((now - startAt) / 1000)
      const next = Math.max(totalSeconds - elapsed, 0)
      setSecondsLeft(next)
      if (next === 0) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      }
    }, 250)
  }, [totalSeconds])

  const reset = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setSecondsLeft(totalSeconds)
  }, [totalSeconds])

  useEffect(() => () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  return { secondsLeft, start, reset }
}