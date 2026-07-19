import { getToken, onMessage } from 'firebase/messaging'
import { doc, setDoc } from 'firebase/firestore'
import { messaging, db } from './firebase'

/**
 * Pide permiso de notificaciones y registra el token FCM en Firestore.
 * Retorna true si el usuario concedió permiso.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (!messaging) return false

  // Paso 1: permiso del browser
  let permission: NotificationPermission
  if (Notification.permission === 'default') {
    permission = await Notification.requestPermission()
  } else {
    permission = Notification.permission
  }

  if (permission !== 'granted') return false

  // Paso 2: obtener token FCM y guardarlo
  try {
    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
    if (!vapidKey) {
      console.warn('VITE_VAPID_PUBLIC_KEY no está configurada')
      return false
    }

    const token = await getToken(messaging, { vapidKey })

    // Guardar token en Firestore (colección fcmTokens)
    const tokenRef = doc(db, 'fcmTokens', token)
    await setDoc(tokenRef, {
      token,
      createdAt: new Date(),
      userAgent: navigator.userAgent,
    })

    // Escuchar mensajes mientras la app está en foreground
    onMessage(messaging, (payload) => {
      const title = payload.notification?.title ?? '🎂 Cumpleañito'
      const body = payload.notification?.body ?? ''
      new Notification(title, { body, icon: '/icon.svg' })
    })

    return true
  } catch (err) {
    console.error('Error al obtener token FCM:', err)
    return false
  }
}

/**
 * Verifica si ya tenemos permiso de notificaciones (sin pedirlo de nuevo).
 */
export function hasNotificationPermission(): boolean {
  return 'Notification' in window && Notification.permission === 'granted'
}
