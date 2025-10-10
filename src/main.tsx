import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './tailwind.css'
import App from './App.tsx'

const root = createRoot(document.getElementById('root')!)
const isDev = import.meta.env.DEV
root.render(isDev ? (
  <StrictMode>
    <App />
  </StrictMode>
) : (
  <App />
))

// Disable Service Worker to avoid stale caches in production diagnostics
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister())
    }).catch(() => {})
  })
}
