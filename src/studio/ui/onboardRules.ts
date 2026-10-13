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
