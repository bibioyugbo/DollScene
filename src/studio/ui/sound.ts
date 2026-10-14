/**
 * UI sounds, synthesised (no files to download): a soft "pop" click for picks and arrows.
 * Silent until the first user gesture (browsers require it) and when the game is paused.
 */
let ctx: AudioContext | null = null
let muted = false

function audio(): AudioContext | null {
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

/** A short, bright click with a little body (pitch drops fast, like a button bottoming out). */
export function click(kind: 'tap' | 'select' | 'go' = 'tap') {
  if (muted) return
  const a = audio()
  if (!a) return
  const t = a.currentTime
  const o = a.createOscillator()
  const g = a.createGain()
  const f0 = kind === 'go' ? 880 : kind === 'select' ? 1150 : 1400
  o.type = 'triangle'
  o.frequency.setValueAtTime(f0, t)
  o.frequency.exponentialRampToValueAtTime(f0 * 0.42, t + 0.07)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(kind === 'go' ? 0.22 : 0.16, t + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'go' ? 0.16 : 0.09))
  o.connect(g).connect(a.destination)
  o.start(t)
  o.stop(t + 0.2)
  if (kind === 'go') {
    // a second, higher note: "ding"
    const o2 = a.createOscillator()
    const g2 = a.createGain()
    o2.type = 'sine'
    o2.frequency.setValueAtTime(1320, t + 0.07)
    g2.gain.setValueAtTime(0.0001, t + 0.07)
    g2.gain.exponentialRampToValueAtTime(0.12, t + 0.08)
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.3)
    o2.connect(g2).connect(a.destination)
    o2.start(t + 0.07)
    o2.stop(t + 0.32)
  }
}

/** A soft two-note bell at `f` Hz (the street's active store: each store has its own note). */
export function chime(f: number) {
  if (muted) return
  const a = audio()
  if (!a) return
  const t = a.currentTime
  for (const [mul, delay, gain] of [
    [1, 0, 0.09],
    [1.5, 0.06, 0.05],
  ] as [number, number, number][]) {
    const o = a.createOscillator()
    const g = a.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(f * mul, t + delay)
    g.gain.setValueAtTime(0.0001, t + delay)
    g.gain.exponentialRampToValueAtTime(gain, t + delay + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.45)
    o.connect(g).connect(a.destination)
    o.start(t + delay)
    o.stop(t + delay + 0.5)
  }
}

/* ------------------------------------------------------------------ ASMR effects */

let noiseBuf: AudioBuffer | null = null
function noise(a: AudioContext) {
  if (noiseBuf) return noiseBuf
  const len = a.sampleRate * 1.5
  noiseBuf = a.createBuffer(1, len, a.sampleRate)
  const d = noiseBuf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  return noiseBuf
}

export const setMuted = (m: boolean) => void (muted = m)
export const isMuted = () => muted

/** A burst of filtered noise: the body of swipes, brushes, sprays, splashes and pats. */
function hiss(a: AudioContext, t: number, dur: number, f: number, q: number, gain: number, sweep = 1, type: BiquadFilterType = 'bandpass') {
  const src = a.createBufferSource()
  src.buffer = noise(a)
  const bp = a.createBiquadFilter()
  bp.type = type
  bp.frequency.setValueAtTime(f, t)
  bp.frequency.exponentialRampToValueAtTime(Math.max(40, f * sweep), t + dur)
  bp.Q.value = q
  const g = a.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.03, dur * 0.25))
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(bp).connect(g).connect(a.destination)
  src.start(t, Math.random() * 0.5)
  src.stop(t + dur + 0.02)
}

function tone(a: AudioContext, t: number, f0: number, f1: number, dur: number, gain: number, type: OscillatorType = 'sine') {
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = type
  o.frequency.setValueAtTime(f0, t)
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.005)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(a.destination)
  o.start(t)
  o.stop(t + dur + 0.02)
}

export type Sfx = 'pop' | 'squish' | 'swipe' | 'pat' | 'dab' | 'splash' | 'drip' | 'brush' | 'spray' | 'sparkle' | 'door' | 'chime' | 'whoosh' | 'peel' | 'snip' | 'zip' | 'buzz' | 'zap' | 'bubbles' | 'squelch'

/** Soft, satisfying sound effects for the routines (synthesised: nothing to download). */
export function sfx(kind: Sfx) {
  if (muted) return
  const a = audio()
  if (!a) return
  const t = a.currentTime + 0.005
  switch (kind) {
    case 'bubbles':
      // foam: a fizz of tiny bubbles popping at random, high and soft
      for (let k = 0; k < 7; k++) {
        const at = t + Math.random() * 0.28
        const f = 1400 + Math.random() * 2600
        tone(a, at, f, f * 0.55, 0.035, 0.035 + Math.random() * 0.03)
      }
      hiss(a, t, 0.3, 5200, 0.8, 0.025, 1.1, 'highpass')
      break
    case 'squelch':
      // cream between fingers: a wet, slurpy low squish with a wobble
      hiss(a, t, 0.26, 420, 3.2, 0.13, 0.55, 'lowpass')
      tone(a, t, 150 + Math.random() * 40, 70, 0.22, 0.09, 'triangle')
      tone(a, t + 0.08, 260, 120, 0.1, 0.04, 'sine')
      break
    case 'pop':
      tone(a, t, 520, 140, 0.09, 0.28)
      hiss(a, t, 0.05, 2400, 1.2, 0.08)
      break
    case 'squish':
      hiss(a, t, 0.22, 600, 2.5, 0.12, 0.5, 'lowpass')
      tone(a, t, 180, 90, 0.18, 0.08, 'triangle')
      break
    case 'swipe':
      hiss(a, t, 0.32, 1800, 0.9, 0.07, 2.2)
      break
    case 'pat':
      hiss(a, t, 0.06, 900, 1.4, 0.12, 0.6, 'lowpass')
      tone(a, t, 220, 120, 0.05, 0.06, 'triangle')
      break
    case 'dab':
      hiss(a, t, 0.08, 1300, 2, 0.08, 0.7)
      break
    case 'splash':
      hiss(a, t, 0.45, 3200, 0.7, 0.16, 0.35)
      for (let i = 0; i < 4; i++) tone(a, t + 0.05 + i * 0.06, 900 + Math.random() * 900, 300, 0.07, 0.04)
      break
    case 'drip':
      tone(a, t, 1400, 520, 0.12, 0.12)
      break
    case 'brush':
      hiss(a, t, 0.4, 5200, 0.6, 0.05, 0.8, 'highpass')
      break
    case 'spray':
      hiss(a, t, 0.5, 6000, 0.5, 0.07, 1, 'highpass')
      break
    case 'sparkle':
      for (let i = 0; i < 5; i++) tone(a, t + i * 0.05, 1800 + i * 260, 1500 + i * 260, 0.18, 0.05)
      break
    case 'door':
      hiss(a, t, 0.6, 400, 0.8, 0.1, 0.4, 'lowpass')
      tone(a, t + 0.05, 660, 990, 0.35, 0.06)
      break
    case 'chime':
      tone(a, t, 1320, 1320, 0.22, 0.08)
      tone(a, t + 0.09, 1760, 1760, 0.3, 0.07)
      break
    case 'whoosh':
      hiss(a, t, 0.5, 300, 0.7, 0.12, 6)
      break
    case 'peel':
      hiss(a, t, 0.35, 2600, 3, 0.06, 0.6)
      break
    case 'snip':
      tone(a, t, 3000, 1200, 0.04, 0.08, 'square')
      break
    case 'zip':
      hiss(a, t, 0.25, 1200, 4, 0.08, 3)
      break
    case 'buzz':
      // a tattoo machine: a low, fast buzz
      for (let i = 0; i < 6; i++) tone(a, t + i * 0.09, 118, 112, 0.085, 0.05, 'sawtooth')
      hiss(a, t, 0.55, 900, 3, 0.03, 1)
      break
    case 'zap':
      // a laser pulse: a bright snap and a crackle
      tone(a, t, 2600, 900, 0.07, 0.07, 'square')
      hiss(a, t + 0.02, 0.12, 4200, 2, 0.06, 0.6, 'highpass')
      break
  }
}

/** A gentle tap on phones that support vibration (ignored elsewhere). */
export function haptic(ms = 12) {
  if (muted) return
  try {
    navigator.vibrate?.(ms)
  } catch {
    /* not allowed in this frame */
  }
}
