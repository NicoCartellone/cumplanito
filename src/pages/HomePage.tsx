import { useEffect, useRef, useState } from 'react'
import type { Friend } from '../types'
import { loadFriends } from '../lib/storage'
import {
  daysUntilNextBirthday,
  isBirthdayToday,
  getUpcomingBirthdays,
  formatBirthday,
} from '../lib/birthdays'
import { useNotifications } from '../lib/notifications'

const WHATSAPP_MSG = (name: string) =>
  encodeURIComponent(`¡Feliz cumpleaños, ${name}! 🎂🎉 Que tengas un excelente día 🥳`)

/**
 * URL de configuración de notificaciones del browser, si hay forma directa de abrirla.
 * Chrome/Edge bloquean la navegación web a chrome://settings → en esos browsers
 * se muestran instrucciones textuales en vez de un link muerto.
 */
function browserSettingsUrl(): string | undefined {
  const ua = navigator.userAgent
  if (/Firefox/i.test(ua)) {
    return 'about:preferences#privacy'
  }
  return undefined // Chrome/Edge/Safari: instrucciones textuales
}

export default function HomePage() {
  const [friends, setFriends] = useState<Friend[]>([])
  const [loading, setLoading] = useState(true)
  const [, tick] = useState(0)

  const { state: notifState, errorMessage: notifError, enable, disable } = useNotifications()

  // Snackbar temporal de feedback — desaparece solo, no es ruido permanente
  const [toast, setToast] = useState<string | null>(null)
  const prevNotifState = useRef(notifState)
  const didMountSync = useRef(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  function showToast(message: string) {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 4500)
  }

  // Toast SOLO en transiciones por acción del usuario (activar/desactivar).
  // La restauración silenciosa del hook en el mount (recarga con estado guardado)
  // NO muestra nada — evita ruido en cada visita.
  useEffect(() => {
    const prev = prevNotifState.current
    prevNotifState.current = notifState
    if (prev === notifState) return
    if (!didMountSync.current) {
      didMountSync.current = true
      return
    }
    if (notifState === 'enabled') {
      showToast('✅ Notificaciones activadas — te avisamos cuando alguien cumple')
    } else if (notifState === 'idle' && prev === 'enabled') {
      showToast('Notificaciones desactivadas')
    }
  }, [notifState])

  // Limpieza del timer al desmontar
  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [])

  useEffect(() => {
    loadFriends().then((f) => {
      setFriends(f)
      setLoading(false)
    })
  }, [])

  // Re-render cada minuto para mantener el contador al día
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const today = friends.filter(isBirthdayToday)
  const upcoming = getUpcomingBirthdays(friends)
  const next = upcoming[0]
  const settingsUrl = browserSettingsUrl()

  const whatsappUrl = (friend: Friend) =>
    friend.whatsapp
      ? `https://wa.me/${friend.whatsapp}?text=${WHATSAPP_MSG(friend.name)}`
      : null

  if (loading) {
    return (
      <div className="page page--center">
        <span style={{ fontSize: 48 }}>🎂</span>
        <p style={{ color: 'var(--muted)' }}>Cargando cumpleaños…</p>
      </div>
    )
  }

  return (
    <div className="page page--scrollable">
      {/* ── Cumpleaños de hoy ── */}
      {today.length > 0 && (
        <div className="alert alert-today">
          <span className="alert-emoji">🎂</span>
          <span>
            ¡Hoy cumple{today.length > 1 ? 'n' : ''} {today.map((f) => f.name).join(', ')}!
          </span>
        </div>
      )}

      {/* ── Hero: próximo cumpleaños ── */}
      {next && (
        <div className="bday-hero">
          <span className="bday-hero-label">🎈 Próximo cumpleaños</span>

          <div className="bday-hero-main">
            <span className="bday-hero-emoji">{next.emoji ?? '🎉'}</span>
            <span className="bday-hero-name">{next.name}</span>
            <span className="bday-hero-date">{formatBirthday(next.month, next.day)}</span>
          </div>

          <div className="countdown">
            <span className="countdown-num">{daysUntilNextBirthday(next)}</span>
            <span className="countdown-label">días</span>
          </div>

          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${Math.min(100, ((365 - daysUntilNextBirthday(next)) / 365) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* ── Activar notificaciones ── */}
      {notifState === 'idle' && (
        <button className="btn btn-ghost" onClick={enable} type="button">
          🔔 Activar recordatorios
        </button>
      )}

      {notifState === 'registering' && (
        <button className="btn btn-ghost" type="button" disabled>
          ⌛ Registrando…
        </button>
      )}

      {notifState === 'enabled' && (
        <div className="notif-chip">
          <span>🔔 Notificaciones activas</span>
          <button
            className="btn btn-ghost"
            onClick={disable}
            type="button"
            style={{ fontSize: 13, padding: '6px 12px' }}
          >
            Desactivar
          </button>
        </div>
      )}

      {notifState === 'denied' && (
        <div
          className="alert"
          style={{
            background: 'rgba(239, 68, 68, 0.10)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: '#ef4444',
          }}
        >
          <span className="alert-emoji">🔕</span>
          <span>
            Notificaciones bloqueadas — activalas desde la configuración del navegador
            {settingsUrl ? (
              <>
                {' '}
                ·{' '}
                <a
                  href={settingsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'inherit', textDecoration: 'underline' }}
                >
                  Abrir configuración
                </a>
              </>
            ) : (
              <>
                {' '}
                (en Chrome/Edge: menú ⋮ → Configuración → Privacidad y seguridad → Configuración de
                sitios → Notificaciones)
              </>
            )}
          </span>
        </div>
      )}

      {notifState === 'unsupported' && (
        <div
          className="alert"
          style={{
            background: 'rgba(245, 158, 11, 0.10)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            color: '#f59e0b',
          }}
        >
          <span className="alert-emoji">📵</span>
          <span>
            Tu navegador no soporta notificaciones push. Necesitás Safari 16.4+ (en iPhone, dentro
            de la app instalada) o un navegador moderno en Android/desktop.
          </span>
        </div>
      )}

      {notifState === 'error' && (
        <div
          className="alert"
          style={{
            background: 'rgba(239, 68, 68, 0.10)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: '#ef4444',
          }}
        >
          <span className="alert-emoji">⚠️</span>
          <span>{notifError ?? 'No se pudieron activar las notificaciones.'}</span>
          <button
            className="btn btn-ghost"
            onClick={enable}
            type="button"
            style={{ marginLeft: 'auto', flexShrink: 0 }}
          >
            Reintentar
          </button>
        </div>
      )}

      {/* ── Lista de próximos cumpleaños ── */}
      <div className="card">
        <h2 className="card-title">Próximos cumpleaños</h2>
        <div className="upcoming-list">
          {upcoming.length === 0 && (
            <span style={{ color: 'var(--muted)', fontSize: 14 }}>
              No hay amigos cargados — agregá algunos en la sección Amigos
            </span>
          )}

          {upcoming.map((f) => {
            const days = daysUntilNextBirthday(f)
            const wa = whatsappUrl(f)
            return (
              <div key={f.id} className="upcoming-row">
                <span className="upcoming-emoji">{f.emoji ?? '🎉'}</span>
                <span className="upcoming-name">{f.name}</span>
                <span className="upcoming-date">{formatBirthday(f.month, f.day)}</span>
                <span
                  className={`upcoming-days${days === 0 ? ' upcoming-days--today' : ''}`}
                >
                  {days === 0 ? '¡Hoy!' : `en ${days} día${days !== 1 ? 's' : ''}`}
                </span>
                {wa && (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="friend-action friend-action--whatsapp"
                    title="Saludar por WhatsApp"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  </a>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Snackbar temporal (feedback no invasivo) ── */}
      {toast && (
        <div className="snackbar" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  )
}