import { useRef } from 'react'
import { NavLink } from 'react-router-dom'

const links = [
  {
    to: '/',
    label: 'Inicio',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-ico">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    to: '/calendario',
    label: 'Calendario',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-ico">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    to: '/amigos',
    label: 'Amigos',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-ico">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
]

export default function BottomNav() {
  // La barra es fixed (fuera del scroll container): un gesto que arranca sobre
  // un botón jamás se propaga al contenido. Por eso los botones usan
  // touch-action: none y DESLIZAMOS el .page--scrollable manualmente.
  const startY = useRef<number | null>(null)
  const moved = useRef(false)

  const onTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0]?.clientY ?? null
    moved.current = false
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null) return
    const y = e.touches[0]?.clientY
    if (y === undefined) return
    const delta = startY.current - y // > 0 = swipe hacia arriba
    if (Math.abs(delta) > 3) moved.current = true
    const scrollEl = document.querySelector<HTMLElement>('.page--scrollable')
    if (scrollEl) scrollEl.scrollTop += delta
    startY.current = y
  }

  const endTouch = () => {
    startY.current = null
  }

  return (
    <nav
      className="bottom-nav"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={endTouch}
      onTouchCancel={endTouch}
    >
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.to === '/'}
          className={({ isActive }) => `nav-btn${isActive ? ' is-active' : ''}`}
          onClick={(e) => {
            // Si el dedo arrastró (scroll manual), el tap no debe navegar
            if (moved.current) e.preventDefault()
          }}
        >
          {link.icon}
          <span className="nav-label">{link.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}