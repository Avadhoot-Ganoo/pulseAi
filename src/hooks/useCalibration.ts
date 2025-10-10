import { useCallback, useEffect, useState } from 'react'

type Calibration = {
  hrOffset: number
  spo2Offset: number
  bpOffsetSys: number
  bpOffsetDia: number
}

const DB_NAME = 'pulsear-calibration'
const STORE = 'calibration'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function getCalibration(): Promise<Calibration | null> {
  const db = await openDB()
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)
    const req = store.get('default')
    req.onsuccess = () => {
      resolve((req.result as Calibration) || null)
    }
    req.onerror = () => resolve(null)
  })
}

async function setCalibration(cal: Calibration): Promise<void> {
  const db = await openDB()
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    store.put(cal, 'default')
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
}

export default function useCalibration() {
  const [calibration, setCalibrationState] = useState<Calibration | null>(null)

  useEffect(() => {
    getCalibration().then(setCalibrationState)
  }, [])

  const save = useCallback((cal: Calibration) => {
    setCalibrationState(cal)
    setCalibration(cal)
  }, [])

  const applyOffsets = useCallback(
    (hr: number | null, spo2?: number, bp?: { systolic: number; diastolic: number }) => {
      if (!calibration) return { hr, spo2, bp }
      const adjHr = hr === null ? null : Math.round(hr + calibration.hrOffset)
      const adjSpo2 = spo2 === undefined ? undefined : Math.round(spo2 + calibration.spo2Offset)
      const adjBp = bp
        ? { systolic: Math.round(bp.systolic + calibration.bpOffsetSys), diastolic: Math.round(bp.diastolic + calibration.bpOffsetDia) }
        : undefined
      return { hr: adjHr, spo2: adjSpo2, bp: adjBp }
    },
    [calibration],
  )

  return { calibration, save, applyOffsets }
}