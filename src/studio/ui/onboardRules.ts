/** DollScene is for adults: the age players confirm before they play (and before public chat). */
export const MIN_AGE = 18

const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} '’.-]{1,23}$/u

/** The doll's name: 2–24 letters, numbers, spaces, apostrophes, dots or hyphens. */
export function validateName(name: string): string | null {
  const n = name.trim()
  if (!n) return 'Give your doll a name.'
  if (n.length < 2) return 'At least 2 characters.'
  if (n.length > 24) return 'Keep it to 24 characters.'
  if (!NAME_RE.test(n)) return 'Letters, numbers, spaces, apostrophes and hyphens only.'
  return null
}

/** Whole years between a date of birth (YYYY-MM-DD) and today. NaN when it isn't a real date. */
export function ageOn(dob: string, today = new Date()): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob)
  if (!m) return NaN
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(Date.UTC(y, mo - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return NaN
  let age = today.getFullYear() - y
  if (today.getMonth() + 1 < mo || (today.getMonth() + 1 === mo && today.getDate() < d)) age--
  return age
}

/** Date of birth: required, real, not in the future, and 18 or over. Only the yes/no is kept. */
export function validateDob(dob: string, today = new Date()): string | null {
  if (!dob) return 'Enter your date of birth.'
  const age = ageOn(dob, today)
  if (!Number.isFinite(age) || age > 120) return 'Enter a real date of birth.'
  if (age < 0) return 'That date is in the future.'
  if (age < MIN_AGE) return `DollScene is for players ${MIN_AGE} and over. You can’t enter yet.`
  return null
}

export const NAME_TAKEN = 'That name is already taken'
