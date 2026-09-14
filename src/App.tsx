import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage'
import CalendarPage from './pages/CalendarPage'
import FriendsPage from './pages/FriendsPage'
import BottomNav from './shared/ui/BottomNav'

export default function App() {
  const [hasUpdate, setHasUpdate] = useState(false)

  // SW con auto-update (skipWaiting + clientsClaim): cuando un SW nuevo toma
  // control se dispara 'controllerchange'. Esto es un AVISO (no un permiso):
  // la actualización ya ocurrió sola; le recordamos al usuario recargar.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onChange = () => setHasUpdate(true)
    navigator.serviceWorker.addEventListener('controllerchange', onChange)
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onChange)
  }, [])

  return (
    <main className="shell">
      <div className="content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/calendario" element={<CalendarPage />} />
          <Route path="/amigos" element={<FriendsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      {hasUpdate ? (
        <div className="update-bar" role="status" aria-live="polite">
          <button className="btn btn-primary" type="button" onClick={() => window.location.reload()}>
            🔄 Nueva versión — Recargar
          </button>
        </div>
      ) : null}

      <BottomNav />
    </main>
  )
}