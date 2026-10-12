export const MIN_AGE = 18

/** Whole years between a YYYY-MM-DD birth date and `now`, or null if the date is invalid. */
export function ageFromDob(dob: unknown, now: number): number | null {
  if (typeof dob !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null
  const [y, m, d] = dob.split('-').map(Number)
  const birth = new Date(Date.UTC(y, m - 1, d))
  if (birth.getUTCFullYear() !== y || birth.getUTCMonth() !== m - 1 || birth.getUTCDate() !== d) return null
  if (birth.getTime() > now || y < 1900) return null
  const today = new Date(now)
  let age = today.getUTCFullYear() - y
  if (today.getUTCMonth() < m - 1 || (today.getUTCMonth() === m - 1 && today.getUTCDate() < d)) age -= 1
  return age
}

/** Latest birth date that is old enough today, for the date input's max. */
export function latestEligibleDob(now: number): string {
  const t = new Date(now)
  return new Date(Date.UTC(t.getUTCFullYear() - MIN_AGE, t.getUTCMonth(), t.getUTCDate())).toISOString().slice(0, 10)
}
