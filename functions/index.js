import { onSchedule } from 'firebase-functions/v2/scheduler'
import { setGlobalOptions } from 'firebase-functions/v2/options'
import { logger } from 'firebase-functions/v2'
import admin from 'firebase-admin'

// ── Init ──────────────────────────────────────────────────────

admin.initializeApp()
const db = admin.firestore()

setGlobalOptions({
  region: 'southamerica-east1',
  maxInstances: 1, // solo necesitamos 1 instancia
})

// ── Helpers ───────────────────────────────────────────────────

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

/** Retorna los amigos que cumplen años HOY */
function getTodaysBirthdays(friends, now) {
  const todayMonth = now.getMonth() + 1
  const todayDay = now.getDate()

  return friends.filter((f) => f.month === todayMonth && f.day === todayDay)
}

/** Retorna amigos que cumplen en los próximos N días */
function getUpcomingBirthdays(friends, now, daysAhead = 7) {
  const upcoming = []

  for (let i = 1; i <= daysAhead; i++) {
    const date = new Date(now)
    date.setDate(date.getDate() + i)
    const checkMonth = date.getMonth() + 1
    const checkDay = date.getDate()

    const match = friends.filter((f) => f.month === checkMonth && f.day === checkDay)
    for (const m of match) upcoming.push({ friend: m, daysUntil: i })
  }

  return upcoming
}

// ── Cron diario ───────────────────────────────────────────────

export const dailyBirthdayCheck = onSchedule(
  {
    schedule: '0 9 * * *', // todos los días a las 9am (UTC-3: Argentina)
    timeZone: 'America/Argentina/Buenos_Aires',
    retryCount: 2,
    memory: '128MiB',
  },
  async (event) => {
    logger.info('🔔 Daily birthday check started')

    // 1. Leer todos los amigos
    const friendsSnap = await db.collection('friends').get()
    const friends = friendsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

    if (friends.length === 0) {
      logger.info('No friends found, skipping')
      return
    }

    // 2. Determinar la fecha actual
    const now = new Date()
    // Ajustar a timezone Argentina para la comparación
    const nowArg = new Date(
      now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }),
    )

    const todaysBirthdays = getTodaysBirthdays(friends, nowArg)
    const upcomingBirthdays = getUpcomingBirthdays(friends, nowArg, 7)

    if (todaysBirthdays.length === 0 && upcomingBirthdays.length === 0) {
      logger.info('No birthdays today or in the next 7 days')
      return
    }

    // 3. Leer todos los tokens FCM
    const tokensSnap = await db.collection('fcmTokens').get()
    const tokens = tokensSnap.docs.map((d) => d.data().token).filter(Boolean)

    if (tokens.length === 0) {
      logger.info('No FCM tokens found, skipping notification')
      return
    }

    // 4. Preparar mensajes
    const messages = []

    // Notificación para cumpleaños de HOY
    for (const friend of todaysBirthdays) {
      const name = friend.name ?? 'Un amigo'
      messages.push({
        notification: {
          title: `🎂 ¡Hoy es el cumpleaños de ${name}!`,
          body: `No te olvides de saludar a ${name} 🥳`,
        },
        token: '',
      })
    }

    // Notificación para próximos cumpleaños (solo el más próximo)
    if (upcomingBirthdays.length > 0 && todaysBirthdays.length === 0) {
      const nearest = upcomingBirthdays[0]
      const name = nearest.friend.name ?? 'Un amigo'
      const days = nearest.daysUntil
      const dayFormatted = `${nearest.friend.day} ${MONTH_NAMES[nearest.friend.month - 1]}`

      messages.push({
        notification: {
          title: `🎈 ${name} cumple en ${days} día${days !== 1 ? 's' : ''}`,
          body: `${name} cumple el ${dayFormatted} — prepará el saludo 🎉`,
        },
        token: '',
      })
    }

    // 5. Enviar a TODOS los dispositivos registrados
    const results = []
    for (const msg of messages) {
      for (const token of tokens) {
        try {
          const result = await admin.messaging().send({ ...msg, token })
          results.push({ token: token.slice(0, 20) + '…', success: true, result })
        } catch (err) {
          logger.warn(`Failed to send to token ${token.slice(0, 20)}…`, err)

          // Si el token es inválido, lo borramos
          if (err.code === 'messaging/invalid-registration-token' || err.code === 'messaging/registration-token-not-registered') {
            await db.collection('fcmTokens').doc(token).delete()
            logger.info(`Removed invalid token ${token.slice(0, 20)}…`)
          }
          results.push({ token: token.slice(0, 20) + '…', success: false, error: err.code })
        }
      }
    }

    logger.info('✅ Daily check complete', {
      friends: friends.length,
      today: todaysBirthdays.length,
      upcoming: upcomingBirthdays.length,
      tokens: tokens.length,
      sent: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    })
  },
)
