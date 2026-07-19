import { useEffect, useState } from 'react'
import type { Friend } from '../types'
import { loadFriends } from '../lib/storage'
import { getFriendsInMonth, getMonthName } from '../lib/birthdays'

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

export default function CalendarPage() {
  const [friends, setFriends] = useState<Friend[]>([])
  const [loading, setLoading] = useState(true)
  const currentMonth = new Date().getMonth() + 1

  useEffect(() => {
    loadFriends().then((f) => {
      setFriends(f)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="page page--center">
        <span style={{ fontSize: 48 }}>📅</span>
        <p style={{ color: 'var(--muted)' }}>Cargando calendario…</p>
      </div>
    )
  }

  return (
    <div className="page page--scrollable">
      <h1
        style={{
          margin: '0 0 4px',
          fontSize: 'clamp(22px, 4vw, 30px)',
          fontWeight: 700,
          color: 'var(--title)',
          letterSpacing: '-0.02em',
        }}
      >
        📅 Calendario
      </h1>
      <p style={{ margin: '0 0 4px', color: 'var(--muted)', fontSize: 14 }}>
        Todos los cumpleaños del año
      </p>

      <div className="cal-grid">
        {MONTHS.map((month) => {
          const bdays = getFriendsInMonth(friends, month)
          const isEmpty = bdays.length === 0
          const isCurrent = month === currentMonth

          return (
            <div
              key={month}
              className={`cal-month${isEmpty ? ' cal-month--empty' : ''}`}
              style={
                isCurrent
                  ? {
                      borderColor: 'rgba(244, 114, 182, 0.35)',
                      background: 'rgba(244, 114, 182, 0.06)',
                    }
                  : undefined
              }
            >
              <h3 className="cal-month-title">
                {getMonthName(month)}
                {isCurrent && (
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--accent)',
                      marginLeft: 6,
                      fontWeight: 400,
                    }}
                  >
                    · ahora
                  </span>
                )}
              </h3>

              {isEmpty ? (
                <span className="cal-empty-msg">—</span>
              ) : (
                <div className="cal-birthdays">
                  {bdays.map((f) => (
                    <div key={f.id} className="cal-bday">
                      <span className="cal-bday-emoji">{f.emoji ?? '🎉'}</span>
                      <span className="cal-bday-name">{f.name}</span>
                      <span className="cal-bday-day">{f.day}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
