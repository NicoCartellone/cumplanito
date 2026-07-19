import type { Friend } from '../types'

/** Returns the *next* occurrence of the friend's birthday (as a Date at midnight). */
function getNextBirthdayDate(friend: Friend): Date {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const currentYear = now.getFullYear()

  const thisYear = new Date(currentYear, friend.month - 1, friend.day)

  if (thisYear < today) {
    return new Date(currentYear + 1, friend.month - 1, friend.day)
  }
  return thisYear
}

/** Full days until the next birthday (0 = today). */
export function daysUntilNextBirthday(friend: Friend): number {
  const next = getNextBirthdayDate(friend)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffMs = next.getTime() - today.getTime()
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

/** Returns friends sorted by closest upcoming birthday. */
export function getUpcomingBirthdays(friends: Friend[], limit?: number): Friend[] {
  const sorted = [...friends].sort(
    (a, b) => daysUntilNextBirthday(a) - daysUntilNextBirthday(b),
  )
  return limit ? sorted.slice(0, limit) : sorted
}

/** Is today the friend's birthday? */
export function isBirthdayToday(friend: Friend): boolean {
  const now = new Date()
  return now.getMonth() === friend.month - 1 && now.getDate() === friend.day
}

/** Friends whose birthday falls in a given month (1–12). */
export function getFriendsInMonth(friends: Friend[], month: number): Friend[] {
  return friends.filter((f) => f.month === month)
}

export function getMonthName(month: number): string {
  const names = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ]
  return names[month - 1]
}

export function formatBirthday(month: number, day: number): string {
  return `${day} ${getMonthName(month)}`
}
