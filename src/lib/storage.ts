import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  writeBatch,
} from 'firebase/firestore'
import type { Friend } from '../types'
import { db } from './firebase'
import { defaultFriends } from '../data/friends'

const COLLECTION = 'friends'

// ── Helper de conversión ──────────────────────────────────

function toFriend(id: string, data: Record<string, unknown>): Friend {
  return {
    id,
    name: data.name as string,
    month: data.month as number,
    day: data.day as number,
    whatsapp: (data.whatsapp as string) || undefined,
    emoji: (data.emoji as string) || undefined,
  }
}

// ── CRUD ──────────────────────────────────────────────────

export async function loadFriends(): Promise<Friend[]> {
  try {
    // Ordenamos solo por mes en Firestore (usa índice automático)
    // y completamos el orden por día en JS para no depender de índices compuestos
    const q = query(collection(db, COLLECTION), orderBy('month', 'asc'))
    const snapshot = await getDocs(q)
    const friends = snapshot.docs.map((d) => toFriend(d.id, d.data() as Record<string, unknown>))

    // Si la colección está vacía, seed con los defaults
    if (friends.length === 0) {
      return await seedFriends()
    }

    // Orden completo: mes ascendente, luego día ascendente
    friends.sort((a, b) => a.month - b.month || a.day - b.day)
    return friends
  } catch {
    // Si falla la conexión, intentamos con los defaults
    return defaultFriends
  }
}

export async function saveFriend(friend: Friend): Promise<Friend> {
  const { id, ...data } = friend
  // Firestore no acepta undefined — solo enviamos los campos con valor
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined),
  )
  await updateDoc(doc(db, COLLECTION, id), cleanData)
  return friend
}

export async function addFriend(friend: Friend): Promise<Friend> {
  const docRef = await addDoc(collection(db, COLLECTION), {
    name: friend.name,
    month: friend.month,
    day: friend.day,
    whatsapp: friend.whatsapp ?? null,
    emoji: friend.emoji ?? null,
  })
  return { ...friend, id: docRef.id }
}

export async function deleteFriend(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id))
}

// ── Seed ──────────────────────────────────────────────────

async function seedFriends(): Promise<Friend[]> {
  const batch = writeBatch(db)
  const created: Friend[] = []

  for (const f of defaultFriends) {
    const ref = doc(collection(db, COLLECTION))
    batch.set(ref, {
      name: f.name,
      month: f.month,
      day: f.day,
      whatsapp: f.whatsapp ?? null,
      emoji: f.emoji ?? null,
    })
    created.push({ ...f, id: ref.id })
  }

  await batch.commit()
  return created
}
