import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage'
import CalendarPage from './pages/CalendarPage'
import FriendsPage from './pages/FriendsPage'
import BottomNav from './shared/ui/BottomNav'

type PwaNeedRefreshEvent = CustomEvent<{
  updateSW: (reloadPage?: boolean) => Promise<void>
}>

export default function App() {
  const [hasUpdate, setHasUpdate] = useState(false)
  const [updateFn, setUpdateFn] = useState<null | ((reloadPage?: boolean) => Promise<void>)>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    const onNeedRefresh = (e: Event) => {
      const ev = e as PwaNeedRefreshEvent
      setUpdateFn(() => ev.detail.updateSW)
      setHasUpdate(true)
    }
    window.addEventListener('pwa:need-refresh', onNeedRefresh)
    return () => window.removeEventListener('pwa:need-refresh', onNeedRefresh)
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
          <button
            className="btn btn-primary"
            type="button"
            onClick={async () => {
              setIsUpdating(true)

              const waitForControllerChange = (timeoutMs = 1500) =>
                new Promise<void>((resolve) => {
                  if (!('serviceWorker' in navigator)) return resolve()
                  const sw = navigator.serviceWorker
                  const onChange = () => resolve()
                  sw.addEventListener('controllerchange', onChange, { once: true })
                  window.setTimeout(resolve, timeoutMs)
                })

              try {
                if (updateFn) {
                  await updateFn(false)
                  await waitForControllerChange()
                }
              } finally {
                window.location.reload()
              }
            }}
            disabled={isUpdating}
          >
            {isUpdating ? 'Actualizando…' : '📦 Nueva versión — Aplicar'}
          </button>
        </div>
      ) : null}

      <BottomNav />
    </main>
  )
}
