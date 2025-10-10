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

// Register Service Worker for offline use
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {})
  })
}
