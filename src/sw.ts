/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare let self: ServiceWorkerGlobalScope

// Precache inyectado por vite-plugin-pwa (injectManifest) en build
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Shell offline: rutas SPA → index.html (injectManifest NO genera navigateFallback solo)
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

// AUTO-UPDATE: el SW nuevo se activa apenas se instala y toma control del cliente.
// El flujo anterior ('prompt' esperando un mensaje SKIP_WAITING que nadie enviaba)
// dejaba el SW nuevo en 'waiting' para siempre → el celular seguía sirviendo el
// bundle de la primera instalación y nunca veía los deploys nuevos.
self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      if (self.clients && 'claim' in self.clients) {
        await self.clients.claim()
      }
    })(),
  )
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