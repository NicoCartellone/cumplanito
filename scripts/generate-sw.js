/**
 * Genera public/firebase-messaging-sw.js desde el template
 * reemplazando las variables de entorno de Firebase.
 *
 * Se ejecuta automáticamente antes de cada build (prebuild script).
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// Cargar .env manualmente (para que funcione sin depender de Vite)
function loadEnv() {
  const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env')
  try {
    const content = readFileSync(envPath, 'utf-8')
    const vars = {}
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const value = trimmed.slice(eqIdx + 1).trim()
      vars[key] = value
    }
    return vars
  } catch {
    // Si no hay .env, intentar usar process.env (Netlify deploy)
    const keys = [
      'VITE_FIREBASE_API_KEY',
      'VITE_FIREBASE_AUTH_DOMAIN',
      'VITE_FIREBASE_PROJECT_ID',
      'VITE_FIREBASE_STORAGE_BUCKET',
      'VITE_FIREBASE_MESSAGING_SENDER_ID',
      'VITE_FIREBASE_APP_ID',
    ]
    const vars = {}
    for (const key of keys) {
      if (process.env[key]) vars[key] = process.env[key]
    }
    if (Object.keys(vars).length > 0) return vars
    console.warn('⚠️  No se encontró .env ni variables de entorno de Firebase')
    return {}
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const templatePath = resolve(__dirname, '..', 'public', 'firebase-messaging-sw.js.template')
const outputPath = resolve(__dirname, '..', 'public', 'firebase-messaging-sw.js')

const env = loadEnv()
let template = readFileSync(templatePath, 'utf-8')

const replacements = {
  __VITE_FIREBASE_API_KEY__: env.VITE_FIREBASE_API_KEY ?? '',
  __VITE_FIREBASE_AUTH_DOMAIN__: env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  __VITE_FIREBASE_PROJECT_ID__: env.VITE_FIREBASE_PROJECT_ID ?? '',
  __VITE_FIREBASE_STORAGE_BUCKET__: env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  __VITE_FIREBASE_MESSAGING_SENDER_ID__: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  __VITE_FIREBASE_APP_ID__: env.VITE_FIREBASE_APP_ID ?? '',
}

for (const [placeholder, value] of Object.entries(replacements)) {
  template = template.replaceAll(placeholder, value)
}

writeFileSync(outputPath, template, 'utf-8')
console.log('✅ firebase-messaging-sw.js generado desde el template')
