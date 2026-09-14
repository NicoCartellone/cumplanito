import { onSchedule } from 'firebase-functions/v2/scheduler'
import { defineSecret } from 'firebase-functions/params'
import { setGlobalOptions } from 'firebase-functions/v2/options'
import { logger } from 'firebase-functions/v2'
import { createHash } from 'node:crypto'
import admin from 'firebase-admin'
import webpush from 'web-push'

// ── Init ──────────────────────────────────────────────────────

admin.initializeApp()
const db = admin.firestore()

setGlobalOptions({
  region: 'southamerica-east1',
  memory: '256MiB',
  maxInstances: 1, // solo necesitamos 1 instancia
})

// ── VAPID ─────────────────────────────────────────────────────

// Private: SOLO en Secret Manager (firebase functions:secrets:set VAPID_PRIVATE_KEY).
// Pública: env var de functions (no es secreto) — fail-fast si falta.
const VAPID_PRIVATE_KEY = defineSecret('VAPID_PRIVATE_KEY')
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY

if (!VAPID_PUBLIC_KEY) {
  throw new Error('Falta VAPID_PUBLIC_KEY en las env vars de functions (nunca commitear la private)')
}

const VAPID_MAILTO = 'mailto:hola@cumplanito.app'

// ── Helpers ───────────────────────────────────────────────────

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/**
 * Doc id de pushSubscriptions: base64url(sha-256(endpoint)).
 * SYNC con el frontend (src/lib/notifications.ts, hashEndpoint via crypto.subtle):
 * deben producir EL MISMO id. NO cambiar un lado sin el otro.
 */
function hashEndpoint(endpoint) {
  return createHash('sha256').update(endpoint).digest('base64url')
}

/** Día del año (1–365) para un mes/día; simplificación sin Feb 29 */
function dayOfYear(month, day) {
  let total = 0
  for (let i = 0; i < month - 1; i++) total += DAYS_PER_MONTH[i]
  return total + day
}

/** Fecha de HOY en Argentina → { ymd: 'YYYY-MM-DD', month, day } (Intl, robusto ante DST) */
function argentinaToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const v = (type) => parts.find((p) => p.type === type).value
  return {
    ymd: `${v('year')}-${v('month')}-${v('day')}`,
    month: Number(v('month')),
    day: Number(v('day')),
  }
}

/** Amigos que cumplen HOY (comparación pura mes/día) */
function getTodaysBirthdays(friends, fecha) {
  return friends.filter((f) => f.month === fecha.month && f.day === fecha.day)
}

/** Amigos que cumplen en los próximos N días (aritmética pura, rollover dic→ene) */
function getUpcomingBirthdays(friends, fecha, daysAhead = 7) {
  const today = dayOfYear(fecha.month, fecha.day)
  const yearLength = 365
  const upcoming = []

  for (let i = 1; i <= daysAhead; i++) {
    let target = today + i
    if (target > yearLength) target -= yearLength // rollover dic→ene

    for (const friend of friends) {
      if (dayOfYear(friend.month, friend.day) === target) {
        upcoming.push({ friend, daysUntil: i })
      }
    }
  }
  return upcoming
}

/** Una sub es enviable si tiene endpoint https y keys p256dh/auth */
function isValidSubscription(sub) {
  return (
    typeof sub.endpoint === 'string' &&
    sub.endpoint.startsWith('https://') &&
    !!sub.keys &&
    typeof sub.keys.p256dh === 'string' &&
    typeof sub.keys.auth === 'string'
  )
}

/** Envía todos los payloads a una sub; clasifica errores web-push */
async function sendAll(sub, payloads, stats) {
  for (const payload of payloads) {
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload), {
        TTL: 86400, // 24h: si el dispositivo está offline, la notif expira
        urgency: 'normal',
      })
      stats.sent++
    } catch (err) {
      if (err instanceof webpush.WebPushError) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          // Sub muerta (Gone) → borrar doc (el frontend no puede, rules lo niegan)
          await db.doc(`pushSubscriptions/${hashEndpoint(sub.endpoint)}`).delete()
          stats.deleted++
          logger.warn(`Sub inválida (${err.statusCode}) — doc borrado`, {
            endpoint: sub.endpoint.slice(0, 40) + '…',
          })
        } else if (err.statusCode === 401) {
          // VAPID inválido: error de CONFIG, no de la sub. Log crítico + abortar, NO borrar.
          logger.error('VAPID inválido (401) — abortando envío, revisar keys del par', err)
          throw err
        } else {
          // 429 (rate limit) / 5xx: transitorio → conservar la sub
          stats.failed++
          logger.warn(`Error de envío (${err.statusCode}) — sub conservada`, {
            endpoint: sub.endpoint.slice(0, 40) + '…',
          })
        }
      } else {
        // Error de red (ECONNREFUSED, timeout, etc.) → conservar la sub
        stats.failed++
        logger.warn('Error de red al enviar — sub conservada', {
          endpoint: sub.endpoint.slice(0, 40) + '…',
          message: err.message,
        })
      }
    }
  }
}

// ── Cron diario ───────────────────────────────────────────────

export const dailyBirthdayCheck = onSchedule(
  {
    schedule: '0 9 * * *', // todos los días a las 9am (UTC-3: Argentina)
    timeZone: 'America/Argentina/Buenos_Aires',
    retryCount: 2,
    memory: '128MiB',
    timeoutSeconds: 120,
    secrets: [VAPID_PRIVATE_KEY],
  },
  async (event) => {
    logger.info('🔔 Daily birthday check started')

    // 0. VAPID (la private se resuelve recién en runtime)
    webpush.setVapidDetails(VAPID_MAILTO, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY.value())

    // 1. Clock transaccional: cortocircuito ante retries del MISMO día
    const fechaArg = argentinaToday()
    const clockRef = db.doc('meta/dailyBirthdayCheck')
    const outcome = await db.runTransaction(async (tx) => {
      const snap = await tx.get(clockRef)
      if (snap.exists && snap.data().lastRunDate === fechaArg.ymd) return 'skip'
      tx.set(clockRef, { lastRunDate: fechaArg.ymd }, { merge: true })
      return 'run'
    })

    if (outcome === 'skip') {
      logger.info('Cron ya corrió hoy — skip', { date: fechaArg.ymd })
      return
    }

    // 2. Leer amigos y seleccionar cumpleaños
    const friendsSnap = await db.collection('friends').get()
    const friends = friendsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

    const todaysBirthdays = getTodaysBirthdays(friends, fechaArg)
    const upcomingBirthdays = getUpcomingBirthdays(friends, fechaArg, 7)

    // 3. Armar payloads { title, body, url } — los consume src/sw.ts
    const payloads = []
    for (const friend of todaysBirthdays) {
      const name = friend.name ?? 'Un amigo'
      payloads.push({
        title: `🎂 ¡Hoy es el cumpleaños de ${name}!`,
        body: `No te olvides de saludar a ${name} 🥳`,
        url: '/',
      })
    }
    // Próximos: solo el más cercano, cuando no hay cumpleaños hoy
    if (upcomingBirthdays.length > 0 && todaysBirthdays.length === 0) {
      const nearest = upcomingBirthdays[0]
      const name = nearest.friend.name ?? 'Un amigo'
      const days = nearest.daysUntil
      const dayFormatted = `${nearest.friend.day} ${MONTH_NAMES[nearest.friend.month - 1]}`

      payloads.push({
        title: `🎈 ${name} cumple en ${days} día${days !== 1 ? 's' : ''}`,
        body: `${name} cumple el ${dayFormatted} — prepará el saludo 🎉`,
        url: '/',
      })
    }

    if (payloads.length === 0) {
      logger.info('Sin cumpleaños hoy o en los próximos 7 días — skip', { date: fechaArg.ymd })
      return
    }

    // 4. Leer suscripciones Web Push (tombstones → sweep; malformadas → warn + skip)
    const subsSnap = await db.collection('pushSubscriptions').get()
    const stats = { sent: 0, failed: 0, deleted: 0 }
    const validSubs = []

    for (const doc of subsSnap.docs) {
      const sub = doc.data()

      if (sub.active === false) {
        await doc.ref.delete() // sweep diario de tombstones
        stats.deleted++
        continue
      }
      if (!isValidSubscription(sub)) {
        logger.warn('Sub malformada — skip', { endpoint: (sub.endpoint ?? '').slice(0, 40) + '…' })
        continue
      }
      validSubs.push({
        endpoint: sub.endpoint,
        expirationTime: sub.expirationTime ?? null,
        keys: sub.keys,
      })
    }

    // 5. Enviar por lotes de 25 con Promise.all (no excede timeoutSeconds)
    const CHUNK = 25
    for (let i = 0; i < validSubs.length; i += CHUNK) {
      const chunk = validSubs.slice(i, i + CHUNK)
      await Promise.all(chunk.map((sub) => sendAll(sub, payloads, stats)))
    }

    // 6. Log resumido
    logger.info('✅ Daily check complete', {
      date: fechaArg.ymd,
      friends: friends.length,
      today: todaysBirthdays.length,
      upcoming: upcomingBirthdays.length,
      subs: validSubs.length,
      sent: stats.sent,
      failed: stats.failed,
      deleted: stats.deleted,
      skipped: false,
    })
  },
)