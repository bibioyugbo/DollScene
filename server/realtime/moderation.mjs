/**
 * Chat safety for a public, 18+ game: a profanity / slur filter that survives the usual tricks
 * (l33t, repeated letters, spaced or dotted letters), rate limiting, flood and duplicate checks.
 * Pure functions, no I/O, so they're unit-tested (test.mjs).
 */

// Masked, not blocked: the message still goes out with the word starred. Slurs and sexual
// content aimed at people are what an 18+ beauty game must not carry; mild swearing is masked too.
const WORDS = [
  'fuck', 'fucking', 'fucker', 'motherfucker', 'shit', 'bullshit', 'bitch', 'bastard', 'cunt', 'dick', 'cock', 'pussy', 'asshole', 'arsehole',
  'whore', 'slut', 'hoe', 'twat', 'wanker', 'prick', 'nigger', 'nigga', 'faggot', 'fag', 'retard', 'retarded', 'spastic', 'tranny', 'dyke',
  'chink', 'paki', 'kike', 'spic', 'wetback', 'coon', 'gook', 'beaner', 'rape', 'rapist', 'pedo', 'paedo', 'nude', 'nudes', 'porn', 'sex',
  'kys', 'killyourself', 'fatass',
  // Nigerian Pidgin / Yoruba / Igbo insults commonly used at people
  'ashawo', 'olosho', 'mumu', 'oloriburuku', 'werey', 'agbaya',
]
/** Stems that are never the start of an innocent word (so "cocktail", "Dickens", "rapeseed" stay). */
const STEMS = ['fuck', 'motherf', 'shit', 'bitch', 'cunt', 'nigg', 'fagg', 'whore', 'slut', 'twat', 'wank', 'pussy', 'asshol', 'arsehol', 'retard', 'rapist', 'pedo', 'paedo', 'porn']

const LEET = { '0': 'o', '1': 'i', '!': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', '$': 's', '7': 't', '+': 't', '8': 'b', '9': 'g', '|': 'i', '¡': 'i', '€': 'e' }

/** Lowercase, undo l33t, drop separators between single letters, squeeze repeats. */
export function normalise(s) {
  let t = s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  t = [...t].map((c) => LEET[c] ?? c).join('')
  return t
}

const squeeze = (w) => w.replace(/(.)\1{2,}/g, '$1$1')

/** Mask profanity with stars, keeping length and spacing so the sentence still reads. */
export function cleanText(text) {
  const out = [...text]
  const norm = normalise(text)
  // 1. word-by-word (handles l33t and stretched letters)
  const re = /[a-z0-9@$!|+€¡]+/gi
  let m
  while ((m = re.exec(norm))) {
    const w = squeeze(m[0])
    const w2 = w.replace(/(.)\1+/g, '$1')
    if (WORDS.some((bad) => w === bad || w2 === bad) || STEMS.some((st) => w.startsWith(st) || w2.startsWith(st))) {
      for (let i = m.index; i < m.index + m[0].length; i++) if (/\S/.test(out[i])) out[i] = '*'
    }
  }
  // 2. spelled out with separators: "f u c k", "f.u.c.k", "f-u-c-k"
  const letters = []
  for (let i = 0; i < norm.length; i++) if (/[a-z]/.test(norm[i])) letters.push(i)
  const joined = letters.map((i) => norm[i]).join('')
  for (const bad of WORDS.filter((b) => b.length >= 4)) {
    let from = 0
    for (;;) {
      const k = joined.indexOf(bad, from)
      if (k < 0) break
      const a = letters[k]
      const b = letters[k + bad.length - 1]
      const span = norm.slice(a, b + 1)
      // only when it's spaced out (the plain word was handled above, and we must not star "classic")
      // only letters spelled out one at a time ("f u c k", "f.u.c.k"), so "this hit" stays clean
      const before = norm[a - 1] ?? ' '
      const after = norm[b + 1] ?? ' '
      if (/^[a-z](?:[^a-z]{1,3}[a-z])+$/.test(span) && !/[a-z]/.test(before) && !/[a-z]/.test(after)) for (let i = a; i <= b; i++) if (/\S/.test(out[i])) out[i] = '*'
      from = k + 1
    }
  }
  return out.join('')
}

/** Token bucket: `burst` messages, refilled at `perSec`. */
export function bucket(burst, perSec) {
  let tokens = burst
  let last = Date.now()
  return {
    take(now = Date.now()) {
      tokens = Math.min(burst, tokens + ((now - last) / 1000) * perSec)
      last = now
      if (tokens < 1) return false
      tokens -= 1
      return true
    },
  }
}

/** Clean user text: strip control characters, collapse whitespace, cap length. */
export function tidy(s, max) {
  if (typeof s !== 'string') return ''
  return [...s]
    .filter((c) => c.charCodeAt(0) >= 32 && !/[​-‏‪-‮⁦-⁩]/.test(c))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

/** "@Bibi hey" → the names mentioned (case-insensitive, letters/numbers/_-.' up to 24). */
export function mentionsIn(text) {
  const out = new Set()
  for (const m of text.matchAll(/@([\p{L}\p{N}_.'-]{1,24})/gu)) out.add(m[1].toLowerCase())
  return [...out]
}

/** A doll name for display: tidy, no profanity, never empty. */
export function displayName(s) {
  const t = tidy(s, 24)
  if (!t) return 'Doll'
  return cleanText(t).includes('*') ? 'Doll' : t
}
