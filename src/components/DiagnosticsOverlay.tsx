import { useEffect, useState } from 'react'

type VideoDevice = {
  kind: string
  label: string
  deviceId: string
}

export default function DiagnosticsOverlay({ cameraError }: { cameraError?: string | null }) {
  const [secure, setSecure] = useState<boolean>(false)
  const [protocol, setProtocol] = useState<string>('')
  const [host, setHost] = useState<string>('')
  const [mediaDevicesAvailable, setMediaDevicesAvailable] = useState<boolean>(false)
  const [getUserMediaAvailable, setGetUserMediaAvailable] = useState<boolean>(false)
  const [enumerateAvailable, setEnumerateAvailable] = useState<boolean>(false)
  const [permission, setPermission] = useState<string>('unknown')
  const [devices, setDevices] = useState<VideoDevice[]>([])
  const [mpWasm, setMpWasm] = useState<string>('unchecked')
  const [mpModel, setMpModel] = useState<string>('unchecked')
  const [query, setQuery] = useState<Record<string, string>>({})

  useEffect(() => {
    setSecure(window.isSecureContext)
    setProtocol(location.protocol.replace(':', ''))
    setHost(location.host)
    const hasMD = !!navigator.mediaDevices
    setMediaDevicesAvailable(hasMD)
    setGetUserMediaAvailable(!!navigator.mediaDevices?.getUserMedia)
    setEnumerateAvailable(!!navigator.mediaDevices?.enumerateDevices)

    const qp = new URLSearchParams(location.search)
    const qObj: Record<string, string> = {}
    qp.forEach((v, k) => (qObj[k] = v))
    setQuery(qObj)
    const nomp = qp.get('nomp') === '1'

    // Check camera permission state if supported
    if ('permissions' in navigator && (navigator as any).permissions?.query) {
      ;(navigator as any).permissions
        .query({ name: 'camera' as PermissionName })
        .then((res: any) => setPermission(res?.state || 'unknown'))
        .catch(() => setPermission('unknown'))
    }

    // Enumerate devices (labels visible only if permission is granted or previously used)
    navigator.mediaDevices
      ?.enumerateDevices()
      .then((list) => setDevices(list.filter((d) => d.kind === 'videoinput') as VideoDevice[]))
      .catch(() => setDevices([]))

    // Try to HEAD check MediaPipe assets (best-effort) unless nomp=1
    const checkHead = async (url: string, setFn: (s: string) => void) => {
      try {
        const r = await fetch(url, { method: 'HEAD' })
        setFn(r.ok ? 'ok' : `http ${r.status}`)
      } catch (e: any) {
        setFn(`error: ${e?.name || 'network'}`)
      }
    }
    if (!nomp) {
      checkHead('/mediapipe/wasm/vision_wasm_internal.js', setMpWasm)
      checkHead('/mediapipe/models/face_landmarker.task', setMpModel)
    } else {
      setMpWasm('skipped (nomp=1)')
      setMpModel('skipped (nomp=1)')
    }
  }, [])

  const nomp = query['nomp'] === '1'
  const autocam = query['autocam'] === '1'

  return (
    <div className="absolute top-2 left-2 z-[99999] bg-black/75 text-white text-xs px-3 py-2 rounded max-w-[360px]">
      <div className="font-semibold mb-1">Diagnostics</div>
      {cameraError && (
        <div className="mb-1 text-red-300">Camera error: {cameraError}</div>
      )}
      <div>secure: {String(secure)} ({protocol})</div>
      <div>host: {host}</div>
      <div>mediaDevices: {String(mediaDevicesAvailable)}</div>
      <div>getUserMedia: {String(getUserMediaAvailable)}</div>
      <div>enumerateDevices: {String(enumerateAvailable)}</div>
      <div>permission(camera): {permission}</div>
      <div>query: diag={query['diag'] || '0'} nomp={query['nomp'] || '0'} autocam={query['autocam'] || '0'}</div>
      <div>mp wasm: {nomp ? 'skipped (nomp=1)' : mpWasm}</div>
      <div>mp model: {nomp ? 'skipped (nomp=1)' : mpModel}</div>
      {devices.length > 0 ? (
        <div className="mt-1">
          <div className="opacity-80">video inputs:</div>
          {devices.map((d, i) => (
            <div key={d.deviceId || i}>
              {d.label || '(no label)'} — id:{d.deviceId ? d.deviceId.slice(0, 6) + '…' : 'n/a'}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-1 opacity-80">no video inputs detected</div>
      )}
      {autocam && (
        <div className="mt-1 opacity-80">autocam=1: camera attempts auto-start</div>
      )}
    </div>
  )
}