/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare let self: ServiceWorkerGlobalScope

// Precache inyectado por vite-plugin-pwa (injectManifest) en build
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Shell offline: rutas SPA → index.html (injectManifest NO genera navigateFallback solo)
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

// registerType 'prompt': el SW espera la orden de skipWaiting
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

// Push (Web Push puro — el payload JSON lo arma functions/index.js)
self.addEventListener('push', (event) => {
  let title = '🎂 Cumpleañito'
  let body = 'Tenés un recordatorio de cumpleaños'
  let url = '/'

  try {
    const data = event.data?.json()
    if (data?.title) title = data.title
    if (data?.body) body = data.body
    if (data?.url) url = data.url
  } catch {
    // payload no-JSON o vacío → fallback genérico
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon.svg',
      badge: '/favicon.svg',
      // 'vibrate' no está en NotificationOptions de la lib DOM (solo en la WebWorker)
      ...({ vibrate: [200, 100, 200] } as unknown as NotificationOptions),
      requireInteraction: true,
      tag: 'birthday-reminder',
      data: { url },
    }),
  )
})

// Click en la notificación: enfocar cliente del MISMO origin o abrir ventana
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? self.location.origin

  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of list) {
      if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
        await client.focus()
        if ('navigate' in client) await client.navigate(url)
        return
      }
    }
    await self.clients.openWindow(url)
  })())
})