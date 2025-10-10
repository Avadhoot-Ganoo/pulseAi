import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export default function ThreeOverlay({ hr }: { hr: number | null }) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const ringRef = useRef<THREE.Mesh | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.1, 100)
    camera.position.z = 2
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    mount.appendChild(renderer.domElement)
    const geometry = new THREE.RingGeometry(0.4, 0.6, 64)
    const material = new THREE.MeshBasicMaterial({ color: 0x9b6bff, transparent: true, opacity: 0.6 })
    const ring = new THREE.Mesh(geometry, material)
    scene.add(ring)
    sceneRef.current = scene
    ringRef.current = ring

    const animate = () => {
      const bpm = hr ?? 70
      const period = 60 / Math.max(40, Math.min(180, bpm))
      const t = performance.now() / 1000
      const pulse = 0.5 + 0.1 * Math.sin((2 * Math.PI * t) / period)
      ring.scale.setScalar(1 + pulse)
      ring.material.opacity = 0.4 + 0.4 * Math.abs(Math.sin((2 * Math.PI * t) / period))
      renderer.render(scene, camera)
      rafRef.current = requestAnimationFrame(animate)
    }
    animate()

    const handleResize = () => {
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      mount.removeChild(renderer.domElement)
      renderer.dispose()
    }
  }, [hr])

  return <div ref={mountRef} className="absolute inset-0 pointer-events-none" />
}