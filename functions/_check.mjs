import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (getApps().length === 0) {
  initializeApp({ projectId: 'cumplanito-bday' })
}
const db = getFirestore()

const snapshot = await db.collection('friends').orderBy('month', 'asc').orderBy('day', 'asc').get()

console.log('Total docs:', snapshot.size)
if (snapshot.size === 0) {
  console.log('⚠️ No hay documentos en la colección friends')
} else {
  snapshot.docs.forEach(d => console.log(d.id, '=>', JSON.stringify(d.data())))
}

const tokenSnap = await db.collection('fcmTokens').limit(5).get()
console.log('\nfcmTokens docs:', tokenSnap.size)
tokenSnap.docs.forEach(d => console.log(d.id, '=>', JSON.stringify(d.data())))

process.exit(0)
