import { useEffect, useState, useCallback } from 'react'
import type { Friend } from '../types'
import { loadFriends, addFriend, saveFriend, deleteFriend } from '../lib/storage'
import { formatBirthday } from '../lib/birthdays'

type FormState = {
  name: string
  day: string
  month: string
  whatsapp: string
  emoji: string
}

const EMPTY_FORM: FormState = { name: '', day: '', month: '', whatsapp: '', emoji: '' }

const MONTHS = [
  { value: '1', label: 'Enero' },
  { value: '2', label: 'Febrero' },
  { value: '3', label: 'Marzo' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Mayo' },
  { value: '6', label: 'Junio' },
  { value: '7', label: 'Julio' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
]

function validate(form: FormState): string | null {
  if (!form.name.trim()) return 'El nombre es obligatorio'
  const day = Number(form.day)
  if (!Number.isInteger(day) || day < 1 || day > 31) return 'El día debe ser entre 1 y 31'
  const month = Number(form.month)
  if (!Number.isInteger(month) || month < 1 || month > 12) return 'El mes es inválido'
  return null
}

export default function FriendsPage() {
  const [friends, setFriends] = useState<Friend[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadFriends().then((f) => {
      setFriends(f)
      setLoading(false)
    })
  }, [])

  const resetForm = useCallback(() => {
    setForm(EMPTY_FORM)
    setError(null)
    setShowForm(false)
    setEditingId(null)
  }, [])

  const handleSubmit = async () => {
    const err = validate(form)
    if (err) {
      setError(err)
      return
    }
    setError(null)
    setSaving(true)

    const friendData: Omit<Friend, 'id'> = {
      name: form.name.trim(),
      month: Number(form.month),
      day: Number(form.day),
      whatsapp: form.whatsapp.trim() || undefined,
      emoji: form.emoji.trim() || undefined,
    }

    try {
      if (editingId) {
        const updated: Friend = { id: editingId, ...friendData }
        await saveFriend(updated)
        setFriends((prev) => prev.map((f) => (f.id === editingId ? updated : f)))
      } else {
        const created = await addFriend(friendData as Friend)
        setFriends((prev) => [...prev, created])
      }
      resetForm()
    } catch (e) {
      setError('Error al guardar. ¿Tenés conexión a internet?')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (friend: Friend) => {
    setForm({
      name: friend.name,
      day: String(friend.day),
      month: String(friend.month),
      whatsapp: friend.whatsapp ?? '',
      emoji: friend.emoji ?? '',
    })
    setEditingId(friend.id)
    setShowForm(true)
    setError(null)
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteFriend(id)
      setFriends((prev) => prev.filter((f) => f.id !== id))
      if (editingId === id) resetForm()
    } catch {
      setError('Error al eliminar. ¿Tenés conexión a internet?')
    }
  }

  if (loading) {
    return (
      <div className="page page--center">
        <span style={{ fontSize: 48 }}>👥</span>
        <p style={{ color: 'var(--muted)' }}>Cargando amigos…</p>
      </div>
    )
  }

  return (
    <div className="page page--scrollable">
      <div className="friends-header">
        <h1>👥 Amigos</h1>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => {
            resetForm()
            setShowForm(!showForm)
          }}
        >
          {showForm ? '✕ Cerrar' : '+ Agregar'}
        </button>
      </div>

      {/* ── Formulario ── */}
      {showForm && (
        <div
          className="card"
          style={editingId ? { borderColor: 'rgba(244, 114, 182, 0.4)' } : undefined}
        >
          <h2 className="card-title">{editingId ? '✏️ Editar amigo' : '🎈 Nuevo amigo'}</h2>

          <div className="friend-form">
            <div className="form-field">
              <label className="form-label" htmlFor="f-name">
                Nombre
              </label>
              <input
                id="f-name"
                className="form-input"
                type="text"
                placeholder="Ej: Juan"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="form-row">
              <div className="form-field">
                <label className="form-label" htmlFor="f-day">
                  Día
                </label>
                <input
                  id="f-day"
                  className="form-input"
                  type="number"
                  min={1}
                  max={31}
                  placeholder="1–31"
                  value={form.day}
                  onChange={(e) => setForm({ ...form, day: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="f-month">
                  Mes
                </label>
                <select
                  id="f-month"
                  className="form-select"
                  value={form.month}
                  onChange={(e) => setForm({ ...form, month: e.target.value })}
                >
                  <option value="">Seleccionar</option>
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label className="form-label" htmlFor="f-emoji">
                  Emoji
                </label>
                <input
                  id="f-emoji"
                  className="form-input"
                  type="text"
                  placeholder="🎉 (opcional)"
                  maxLength={4}
                  value={form.emoji}
                  onChange={(e) => setForm({ ...form, emoji: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="f-whatsapp">
                  WhatsApp
                </label>
                <input
                  id="f-whatsapp"
                  className="form-input"
                  type="text"
                  placeholder="5491112345678 (opcional)"
                  value={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                />
              </div>
            </div>

            {error && <span style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</span>}

            <div className="form-actions">
              <button
                className="btn btn-primary"
                type="button"
                onClick={handleSubmit}
                disabled={saving}
              >
                {saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Agregar amigo'}
              </button>
              <button className="btn btn-ghost" type="button" onClick={resetForm} disabled={saving}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lista de amigos ── */}
      <div className="friend-list">
        {friends.length === 0 && (
          <div className="empty-state">
            <span className="empty-state-emoji">🎂</span>
            <p className="empty-state-text">
              Todavía no hay amigos cargados.
              <br />
              ¡Agregá el primero!
            </p>
          </div>
        )}

        {friends.map((friend) => {
          const isEditing = editingId === friend.id
          return (
            <div
              key={friend.id}
              className={`friend-card${isEditing ? ' friend-card--editing' : ''}`}
            >
              <span className="friend-emoji">{friend.emoji ?? '🎉'}</span>

              <div className="friend-info">
                <div className="friend-name">{friend.name}</div>
                <div className="friend-date">
                  {formatBirthday(friend.month, friend.day)}
                  {friend.whatsapp ? ' · 📱 WhatsApp' : ''}
                </div>
              </div>

              <div className="friend-actions">
                {friend.whatsapp && (
                  <a
                    href={`https://wa.me/${friend.whatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="friend-action friend-action--whatsapp"
                    title="Abrir WhatsApp"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  </a>
                )}

                <button
                  className="friend-action"
                  type="button"
                  title="Editar"
                  onClick={() => startEdit(friend)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>

                <button
                  className="friend-action friend-action--danger"
                  type="button"
                  title="Eliminar"
                  onClick={() => handleDelete(friend.id)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
