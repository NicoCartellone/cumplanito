import { useEffect, useState } from 'react'
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { db } from './firebase'

// ── Contrato de sincronización con functions/index.js ──────────
// hashEndpoint() produce el doc id de pushSubscriptions:
// base64url(sha-256(endpoint)). El backend usa node:crypto
// createHash('sha256').digest('base64url') — deben dar EL MISMO id.
// NO cambiar un lado sin el otro.

export type NotifState =
  | 'unsupported' // browser sin Push API (p.ej. Safari iOS <16.4)
  | 'denied'      // permiso bloqueado por el usuario
  | 'idle'        // listo para activar
  | 'registering' // enable() en curso
  | 'enabled'     // suscripción activa
  | 'error'       // fallo recuperable (ver errorMessage)

const LS_NOTIFICATIONS = 'cumplanito:notifications'
const LS_VAPID = 'cumplanito:vapid'

// ── Helpers ────────────────────────────────────────────────────

/** Convierte VAPID key (base64url) a Uint8Array para pushManager.subscribe */
function urlBase64ToUint8Array(key: string): Uint8Array {
  const padding = '='.repeat((4 - (key.length % 4)) % 4)
  const base64 = (key + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

/** Doc id idempotente: base64url(sha-256(endpoint)) — sync con functions/index.js */
async function hashEndpoint(endpoint: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint))
  let bin = ''
  for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Feature-detect: Push API nativa + SW + crypto.subtle (secure context) */
function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    !!crypto?.subtle
  )
}

/**
 * Espera el service worker con timeout. `navigator.serviceWorker.ready` puede
 * colgarse para siempre si el SW nunca se registró (p.ej. en dev sin devOptions),
 * dejando la UI en 'registering' sin error.
 */
async function waitForServiceWorker(timeoutMs = 8000): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration()
  if (existing) return existing

  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('Service worker no disponible')),
      timeoutMs,
    )
  })

  try {
    return await Promise.race([navigator.serviceWorker.ready, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** Mapea errores técnicos a mensajes legibles (nunca alert() ni errores crudos) */
function friendlyError(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === 'AbortError') {
      return 'El navegador canceló el registro de notificaciones. Intentalo de nuevo.'
    }
    if (err.name === 'InvalidStateError' || err.message.includes('Service worker')) {
      return 'El service worker no está listo. Recargá la página e intentalo de nuevo.'
    }
  }
  return 'No se pudieron activar las notificaciones. Revisá tu conexión e intentalo de nuevo.'
}

// ── Hook ───────────────────────────────────────────────────────

export function useNotifications(): {
  state: NotifState
  errorMessage?: string
  enable(): Promise<void>
  disable(): Promise<void>
} {
  const [state, setState] = useState<NotifState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined)

  // Estado inicial en mount: conserva el estado tras recarga (sin re-registrar)
  useEffect(() => {
    let cancelled = false

    ;(async () => {
      if (!isPushSupported()) {
        if (!cancelled) setState('unsupported')
        return
      }
      if (!('Notification' in window)) {
        if (!cancelled) setState('unsupported')
        return
      }
      if (Notification.permission === 'denied') {
        if (!cancelled) setState('denied')
        return
      }
      if (Notification.permission === 'granted') {
        try {
          const sw = await waitForServiceWorker()
          const sub = await sw.pushManager.getSubscription()
          const vapid = import.meta.env.VITE_VAPID_PUBLIC_KEY
          if (
            sub &&
            localStorage.getItem(LS_NOTIFICATIONS) === 'enabled' &&
            localStorage.getItem(LS_VAPID) === vapid
          ) {
            if (!cancelled) setState('enabled')
            return
          }
        } catch {
          // SW/sub no disponible → cae a 'idle'
        }
      }
      if (!cancelled) setState('idle')
    })()

    return () => {
      cancelled = true
    }
  }, [])

  /** Activa notificaciones: permiso → subscribe → upsert idempotente en pushSubscriptions */
  async function enable(): Promise<void> {
    if (!isPushSupported()) {
      setState('unsupported')
      return
    }
    if (!('Notification' in window)) {
      setState('unsupported')
      return
    }

    setErrorMessage(undefined)
    setState('registering')

    try {
      // 1. Permiso (requestPermission solo si está 'default'; nunca con 'denied')
      let permission = Notification.permission
      if (permission === 'default') {
        permission = await Notification.requestPermission()
      }
      if (permission === 'denied') {
        setState('denied')
        return
      }
      if (permission !== 'granted') {
        // 'default' -> el usuario cerró el prompt sin decidir
        setState('idle')
        return
      }

      // 2. SW listo (con timeout — ready puede colgarse si no hay registro)
      const sw = await waitForServiceWorker()
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
      const storedVapid = localStorage.getItem(LS_VAPID)

      // 3. Reusar sub vigente; rotar si cambió la VAPID pública; crear si falta
      let sub = await sw.pushManager.getSubscription()
      if (sub && storedVapid !== vapidKey) {
        // VAPID rotó: la sub vieja es inútil → unsubscribe + subscribe nuevo
        try {
          await sub.unsubscribe()
        } catch {
          // el unsubscribe pudo fallar; seguimos con subscribe igual
        }
        sub = null
      }
      if (!sub) {
        sub = await sw.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
        })
      }

      // 4. Upsert idempotente: doc id = hash(endpoint), SIEMPRE setDoc(merge)
      const json = sub.toJSON()
      const endpoint = json.endpoint
      if (!endpoint) {
        setErrorMessage('El navegador no devolvió una suscripción válida. Intentalo de nuevo.')
        setState('error')
        return
      }
      const id = await hashEndpoint(endpoint)
      await setDoc(
        doc(db, 'pushSubscriptions', id),
        {
          ...json,
          userAgent: navigator.userAgent,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )

      // 5. Marcar en localStorage para conservar estado entre recargas
      localStorage.setItem(LS_NOTIFICATIONS, 'enabled')
      localStorage.setItem(LS_VAPID, vapidKey)
      setState('enabled')
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setState('denied')
      } else {
        setErrorMessage(friendlyError(err))
        setState('error')
      }
    }
  }

  /** Desactiva: unsubscribe local + tombstone remoto (active:false) */
  async function disable(): Promise<void> {
    try {
      const sw = await waitForServiceWorker()
      const sub = await sw.pushManager.getSubscription()
      if (sub) {
        try {
          await sub.unsubscribe()
        } catch {
          // la sub local ya no existe o no se pudo borrar — no es crítico
        }
        // TOMBSTONE: las rules deniegan delete al cliente (solo el cron via Admin SDK borra)
        const id = await hashEndpoint(sub.endpoint)
        await updateDoc(doc(db, 'pushSubscriptions', id), {
          active: false,
          updatedAt: serverTimestamp(),
        })
      }
    } catch {
      // si algo falla, igual limpiamos el estado local
    }
    localStorage.removeItem(LS_NOTIFICATIONS)
    localStorage.removeItem(LS_VAPID)
    setErrorMessage(undefined)
    setState('idle')
  }

  return { state, errorMessage, enable, disable }
}