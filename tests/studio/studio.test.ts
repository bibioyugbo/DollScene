/**
 * Studio logic tests: the avatar state, the beauty routines (played on a real three.js hand rig,
 * headless), the clinic, scenes and persistence. Run: npm run test:studio
 */
import assert from 'node:assert/strict'
import { beforeEach, describe, test } from 'node:test'
import { clinicEffect, effectiveMorphs } from '../../src/shared/studio/clinic'
import { DEFAULT_LOOK, sanitizeLook, type StudioLook } from '../../src/shared/studio/look'
import { BODY_TYPES, CHARACTER_PRESETS, MAKEUP_PRESETS, randomDoll } from '../../src/shared/studio/presets'
import { cancelAction, isRunning, skipAction } from '../../src/studio/actions/engine'
import { RETWIST, TAKEDOWN, WASH } from '../../src/studio/actions/haircare'
import { amountOf, lookStep, makeupStep, removeStep, shadeProduct } from '../../src/studio/actions/makeup'
import { MANICURE } from '../../src/studio/actions/nailcare'
import { BRIGHTEN, CLEANSE, COMPRESS, EXFOLIATE, FACE_WASH, hasConditions, morningLook, padDirt, PATCHES, POP, SKINCARE_STEPS, skinCheckIn, SOOTHE, TONER } from '../../src/studio/actions/skincare'
import { MIN_AGE } from '../../src/studio/ui/onboardRules'
import { runSequence, runStep } from '../../src/studio/actions/steps'
import { fx } from '../../src/studio/state/fx'
import { useStudio } from '../../src/studio/state/store'
import { SCENES } from '../../src/studio/scenes/defs'
import { installCharacter, play } from './fakeCharacter'

const hand = { id: 'hands', name: 'Hands', blurb: '', color: '#ffffff' }
const clone = (l: StudioLook) => structuredClone(l)

function fresh(phase: 'studio' | 'onboard' = 'studio', look: StudioLook = clone(CHARACTER_PRESETS[0].look)) {
  cancelAction()
  useStudio.setState({ look, past: [], future: [], editBase: null, phase, category: 'skincare', toasts: [], action: null, clinicPreview: null, prevScene: null, characterReady: true })
}
const toasts = () => useStudio.getState().toasts.map((t) => `${t.tone}:${t.text}`)

beforeEach(() => {
  installCharacter()
  fresh()
})

/* ------------------------------------------------------------------ 1–4: onboarding */

describe('onboarding', () => {
  test('1. a new player names their doll (validated)', async () => {
    const { validateName } = await import('../../src/studio/ui/onboardRules')
    assert.equal(validateName(''), 'Give your doll a name.')
    assert.equal(validateName('A'), 'At least 2 characters.')
    assert.match(validateName('<script>') ?? '', /Letters/)
    assert.equal(validateName('Adaeze'), null)
    assert.equal(validateName("Ọlá-Mi O'Neil"), null)
  })

  test('2. choosing a starter avatar sets her face and body (only during creation)', () => {
    fresh('onboard', clone(DEFAULT_LOOK))
    const ife = CHARACTER_PRESETS.find((c) => c.id === 'ifeoma')!
    useStudio.getState().replace(ife.look)
    assert.equal(useStudio.getState().look.morphs.Hips, ife.look.morphs.Hips)
    assert.equal(useStudio.getState().look.hair.style, 'afro_big')
  })

  test('3–4. the starting scene and the onboarded profile persist through a save', () => {
    fresh('onboard', clone(DEFAULT_LOOK))
    const s = useStudio.getState()
    s.apply((l) => void (l.scene = { id: 'wedding', time: 'golden', weather: 'breeze', spot: 'arch' }))
    s.apply((l) => void ((l.profile.name = 'Adaeze'), (l.profile.onboarded = true)))
    const saved = sanitizeLook(JSON.parse(JSON.stringify(useStudio.getState().look)))
    assert.deepEqual(saved.scene, { id: 'wedding', time: 'golden', weather: 'breeze', spot: 'arch' })
    assert.equal(saved.profile.onboarded, true)
    assert.equal(saved.profile.name, 'Adaeze')
  })
})

/* ------------------------------------------------------------------ skincare */

describe('skincare routine', () => {
  test('5. removing a pimple patch peels it off and leaves a flat spot', async () => {
    useStudio.getState().apply((l) => morningLook(l, { patches: 2, spots: 3, underEye: true, bonnet: true }))
    assert.deepEqual(useStudio.getState().look.care.patches, ['cheekL', 'forehead1'])
    let peeled = 0
    const r = await play(runStep(PATCHES, { product: hand, target: 'cheekL', option: null }), { onFrame: () => (peeled = Math.max(peeled, fx.skin.peel.cheekL ?? 0)) })
    assert.equal(r, 'done')
    assert.ok(peeled > 0.9, 'the patch visibly peeled during the animation')
    const care = useStudio.getState().look.care
    assert.deepEqual(care.patches, ['forehead1'])
    assert.equal(care.spots.cheekL, 'flat')
    assert.ok(toasts().some((t) => t.startsWith('success:')))
  })

  test('6. cleansing completes, lifts makeup and wakes her up; undo restores', async () => {
    useStudio.getState().apply((l) => {
      morningLook(l, { patches: 0, spots: 1, underEye: true, bonnet: false })
      l.makeup.lipstick.amount = 0.8
    })
    let foam = 0
    const r = await play(runStep(CLEANSE, { product: CLEANSE.products[0], target: null, option: 'splash' }), { onFrame: () => (foam = Math.max(foam, fx.skin.foam.cheekL)) })
    assert.equal(r, 'done')
    assert.ok(foam > 0.5, 'foam built up on the cheeks')
    const l = useStudio.getState().look
    assert.ok(l.care.done.includes('cleanse'))
    assert.equal(l.care.morning, false)
    assert.equal(l.makeup.lipstick.amount, 0)
    assert.equal(fx.skin.foam.cheekL, 0, 'temporary foam is cleared after the step')
    useStudio.getState().undo()
    assert.equal(useStudio.getState().look.makeup.lipstick.amount, 0.8)
  })

  test('a skipped step lands the finished state at once; a cancelled one changes nothing', async () => {
    const before = useStudio.getState().look.care.texture
    const p = runStep(TONER, { product: TONER.products[0], target: null, option: null })
    await play(Promise.resolve(), { maxFrames: 1 })
    await new Promise((r) => setTimeout(r, 0))
    skipAction()
    assert.equal(await p, 'skipped')
    assert.ok(useStudio.getState().look.care.texture < before)
    const mid = clone(useStudio.getState().look)
    const q = runStep(TONER, { product: TONER.products[0], target: null, option: null })
    await new Promise((r) => setTimeout(r, 0))
    cancelAction()
    assert.equal(await q, 'cancelled')
    assert.deepEqual(useStudio.getState().look, mid)
  })

  test('popping is optional: the gentle alternative patches the spot instead', async () => {
    useStudio.getState().apply((l) => morningLook(l, { patches: 0, spots: 2, underEye: false, bonnet: false }))
    const r = await play(runStep(POP, { product: hand, target: 'cheekL', option: 'patch' }))
    assert.equal(r, 'done')
    assert.ok(useStudio.getState().look.care.patches.includes('cheekL'))
    assert.equal(useStudio.getState().look.care.spots.cheekL, 'pimple')
  })

  test('the whole routine plays in order and every step updates the look', async () => {
    useStudio.getState().apply((l) => morningLook(l, { patches: 1, spots: 2, underEye: true, bonnet: false }))
    const ok = await play(runSequence(SKINCARE_STEPS, () => {}, true), { dt: 0.1 })
    assert.equal(ok, true)
    const care = useStudio.getState().look.care
    for (const s of ['patches', 'cleanse', 'toner', 'serum', 'eyeCream', 'moisturiser', 'sunscreen', 'lipBalm']) assert.ok(care.done.includes(s as never), `${s} done`)
    assert.equal(care.spf, true)
    assert.equal(care.lips, 1)
  })
})

/* ------------------------------------------------------------------ makeup */

describe('makeup', () => {
  test('7. foundation and concealer apply as separate, editable layers', async () => {
    fresh('studio', clone(DEFAULT_LOOK))
    await play(runStep(makeupStep('foundation'), { product: shadeProduct('#6B4430'), target: null, option: 'sponge', extra: { amount: 0.7, finish: 'matte' } }))
    await play(runStep(makeupStep('concealer'), { product: shadeProduct('#7A5038'), target: null, option: 'brush', extra: { amount: 0.5 } }))
    const m = useStudio.getState().look.makeup
    assert.equal(m.foundation.amount, 0.7)
    assert.equal(m.foundationFinish, 'matte')
    assert.equal(m.concealer.amount, 0.5)
    assert.equal(m.concealer.color, '#7A5038')
    // removing one layer leaves the other
    await play(runStep(removeStep('concealer'), { product: shadeProduct('#fff'), target: null, option: null }))
    assert.equal(useStudio.getState().look.makeup.concealer.amount, 0)
    assert.equal(useStudio.getState().look.makeup.foundation.amount, 0.7)
  })

  test('a cancelled makeup preview restores the look exactly', async () => {
    fresh('studio', clone(DEFAULT_LOOK))
    const before = clone(useStudio.getState().look)
    const p = runStep(makeupStep('blush'), { product: shadeProduct('#A8424A'), target: null, option: null, extra: { amount: 0.6 } })
    await new Promise((r) => setTimeout(r, 0))
    assert.equal(useStudio.getState().look.makeup.blush.amount, 0.6, 'previewed while applying')
    cancelAction()
    assert.equal(await p, 'cancelled')
    assert.deepEqual(useStudio.getState().look, before)
    assert.equal(useStudio.getState().past.length, 0, 'nothing landed in history')
  })

  test('8. a default look builds from the same layers and stays editable', async () => {
    fresh('studio', clone(DEFAULT_LOOK))
    await play(runStep(lookStep('soft-beat'), { product: shadeProduct('#fff'), target: null, option: null }), { dt: 0.1 })
    const tone = useStudio.getState().look.skin.tone
    assert.deepEqual(useStudio.getState().look.makeup, MAKEUP_PRESETS.find((p) => p.id === 'soft-beat')!.build(tone))
    await play(runStep(removeStep('blush'), { product: shadeProduct('#fff'), target: null, option: null }))
    const m = useStudio.getState().look.makeup
    assert.equal(m.blush.amount, 0)
    assert.ok(amountOf(m, 'lipstick') > 0 && amountOf(m, 'foundation') > 0, 'other layers untouched')
  })
})

/* ------------------------------------------------------------------ hair */

describe('hair', () => {
  test('9–10. both afros and Fulani braids are selectable, and old saves map to the big afro', () => {
    for (const id of ['afro_short', 'afro_big', 'fulani_braids'] as const) {
      useStudio.getState().apply((l) => void (l.hair.style = id))
      assert.equal(useStudio.getState().look.hair.style, id)
    }
    assert.equal(sanitizeLook({ hair: { style: 'afro01' } }).hair.style, 'afro_big')
    assert.equal(sanitizeLook({ hair: { style: 'afro' } }).hair.style, 'afro_big')
  })

  test('braid takedown runs section by section and ends as a braid-out', async () => {
    useStudio.getState().apply((l) => void ((l.hair.style = 'box_braids'), (l.hair.care.bonnet = false)))
    await play(runStep(TAKEDOWN, { product: hand, target: '0', option: null }), { dt: 0.1 })
    let ch = useStudio.getState().look.hair.care.change
    assert.ok(ch && ch.sections === 1 && ch.from === 'box_braids' && ch.to === 'braid_out')
    assert.equal(useStudio.getState().look.hair.style, 'box_braids', 'still braided until every section is out')
    await play(runStep(TAKEDOWN, { product: hand, target: 'all', option: null }), { dt: 0.1 })
    ch = useStudio.getState().look.hair.care.change
    assert.equal(ch, null)
    assert.equal(useStudio.getState().look.hair.style, 'braid_out')
  })

  test('12. retwisting locs keeps the loc layout and ends with clean, retwisted roots', async () => {
    useStudio.getState().apply((l) => void ((l.hair.style = 'locs'), (l.hair.care.bonnet = false)))
    const r = await play(runStep(RETWIST, { product: RETWIST.products[0], target: 'all', option: null }), { dt: 0.1 })
    assert.equal(r, 'done')
    assert.equal(useStudio.getState().look.hair.style, 'locs_retwist')
    useStudio.getState().apply((l) => void (l.hair.style = 'microlocs'))
    assert.match(RETWIST.blocked!(useStudio.getState().look) ?? '', /traditional locs/)
  })

  test('washing leaves damp hair; different hair types respond differently to water', async () => {
    const { wetResponse } = await import('../../src/studio/character/hairMaterial')
    assert.ok(wetResponse('afro_big')[2] > 0, 'afros shrink when wet')
    assert.equal(wetResponse('locs')[2], 0)
    assert.notDeepEqual(wetResponse('locs'), wetResponse('long01'))
    useStudio.getState().apply((l) => void ((l.hair.style = 'afro_big'), (l.hair.care.bonnet = false)))
    await play(runStep(WASH, { product: WASH.products[0], target: null, option: null }), { dt: 0.1 })
    assert.ok(useStudio.getState().look.hair.care.wet > 0.3)
  })
})

/* ------------------------------------------------------------------ nails, clinic, scenes */

describe('nails, clinic, scenes', () => {
  test('13. a manicure paints coat by coat, then the design is saved', async () => {
    const design = { ...DEFAULT_LOOK.nails, color: '#C0283A', amount: 1, shape: 'almond' as const, length: 0.6, art: 'french' as const, gems: true }
    const stages = new Set<string>()
    const r = await play(runStep(MANICURE, { product: hand, target: null, option: null, extra: { nails: JSON.stringify(design) } }), { dt: 0.1, onFrame: () => stages.add(fx.nails.stage) })
    assert.equal(r, 'done')
    for (const s of ['prep', 'base', 'colour', 'art', 'top']) assert.ok(stages.has(s), `${s} coat played`)
    assert.deepEqual(useStudio.getState().look.nails, design)
  })

  test('14. clinic: preview never saves; confirm applies real morph offsets; daily styling cannot reshape', () => {
    const s = useStudio.getState()
    const base = clone(s.look)
    useStudio.setState({ clinicPreview: { lipFiller: 0.8 } })
    assert.deepEqual(useStudio.getState().look, base, 'previewing changes nothing saved')
    const shown = effectiveMorphs(base, { lipFiller: 0.8 })
    assert.ok(shown.Lips > base.morphs.Lips)
    s.apply((l) => void (l.clinic.lipFiller = 0.8))
    assert.equal(useStudio.getState().look.clinic.lipFiller, 0.8)
    assert.equal(useStudio.getState().look.morphs.Lips, base.morphs.Lips, 'the locked base stays put')
    assert.ok(clinicEffect({ clinic: { underEye: 0.5 } }, 'underEyeFill') === 0.5)
    // ordinary customisation can't touch the base shape
    useStudio.getState().apply((l) => {
      l.morphs.Hips = 0.99
      l.height = 1.06
      l.hair.color = '#A3202A'
    })
    const after = useStudio.getState().look
    assert.equal(after.morphs.Hips, base.morphs.Hips)
    assert.equal(after.height, base.height)
    assert.equal(after.hair.color, '#A3202A')
  })

  test('15. changing scenes keeps the whole look and remembers the last scene', () => {
    const s = useStudio.getState()
    s.apply((l) => void ((l.makeup.lipstick.amount = 0.9), (l.hair.style = 'fulani_braids')))
    const before = clone(useStudio.getState().look)
    s.changeScene({ id: 'halloween', time: 'night', weather: 'fog', spot: 'patch' })
    const after = useStudio.getState().look
    assert.equal(after.scene.id, 'halloween')
    assert.deepEqual({ ...after, scene: before.scene }, before)
    assert.deepEqual(useStudio.getState().prevScene, before.scene)
  })

  test('every scene has a name, story, dress code, thumbnail, times, weather and photo spots', () => {
    assert.equal(SCENES.length, 9)
    for (const sc of SCENES) {
      assert.ok(sc.name && sc.blurb && sc.dressCode && sc.atmosphere && sc.thumbnail)
      assert.ok(sc.times.includes(sc.defaultTime) && sc.weathers.includes(sc.defaultWeather))
      assert.ok(sc.photoSpots.length >= 2)
    }
  })

  test('19. switching categories quickly cancels the running step without changing the look', async () => {
    const before = clone(useStudio.getState().look)
    const p = runStep(TONER, { product: TONER.products[0], target: null, option: null })
    await new Promise((r) => setTimeout(r, 0))
    assert.ok(isRunning())
    for (const c of ['makeup', 'nails', 'hairstyles', 'skincare'] as const) useStudio.getState().setCategory(c)
    assert.equal(await p, 'cancelled')
    assert.equal(isRunning(), false)
    assert.deepEqual(useStudio.getState().look, before)
    assert.equal(fx.skin.wet.forehead, 0)
    assert.ok(!toasts().some((t) => t.startsWith('success:')), 'no success toast for a cancelled step')
  })

  test('20. a refreshed app reloads the saved doll exactly (and old v1 saves still load)', () => {
    const look = clone(useStudio.getState().look)
    look.care.patches = ['chin']
    look.nails.art = 'leopard'
    look.jewellery.ears = 'hoops'
    look.clinic = { bbl: 0.4 }
    assert.deepEqual(sanitizeLook(JSON.parse(JSON.stringify(look))), look)
    const v1 = sanitizeLook({ morphs: { Lips: 0.7 }, hair: { style: 'afro01', color: '#141010' }, makeup: { lipstick: { color: '#7A3A34', amount: 0.5 } } })
    assert.equal(v1.v, 2)
    assert.equal(v1.profile.onboarded, true, 'an existing v1 player is not sent through creation again')
    assert.equal(v1.makeup.lipstick.amount, 0.5)
  })
})


/* ------------------------------------------------------------------ the cast, random dolls, skin conditions */

describe('the cast and random dolls', () => {
  test('16. sixteen bare-faced starting dolls, Bibi among them, mostly average to plus-size across races', () => {
    assert.equal(CHARACTER_PRESETS.length, 16)
    assert.ok(CHARACTER_PRESETS.some((c) => c.name === 'Bibi'))
    for (const c of CHARACTER_PRESETS) {
      for (const k of ['foundation', 'concealer', 'blush', 'eyeshadow', 'liner', 'lipstick', 'contour', 'highlight', 'bronzer', 'powder'] as const) assert.equal(c.look.makeup[k].amount, 0, `${c.name} wears no ${k}`)
      assert.equal(c.look.makeup.mascara, 0, `${c.name} wears no mascara`)
    }
    const fullish = CHARACTER_PRESETS.filter((c) => c.look.morphs.Softness >= 0.5)
    assert.ok(fullish.length >= 11, `three quarters average, curvy or plus (got ${fullish.length})`)
    const plus = CHARACTER_PRESETS.filter((c) => c.look.morphs.Softness >= 0.85)
    assert.ok(new Set(plus.map((c) => c.look.skin.tone)).size >= 4, 'plus-size dolls across different skin tones')
  })

  test('17. random dolls are complete, adult, deterministic, and include plus-size bodies', () => {
    const available = { hair: ['afro_big', 'locs', 'bob02', 'pixie'], outfits: ['kai_butterfly_red', 'female_casualsuit01'], shoes: ['shoes01', 'shoes03'] }
    assert.deepEqual(randomDoll(42, available).look, randomDoll(42, available).look)
    let plus = 0
    for (let seed = 1; seed <= 60; seed++) {
      const d = randomDoll(seed, available)
      const l = sanitizeLook(d.look)
      assert.ok(available.outfits.includes(l.outfit.id) && available.shoes.includes(l.shoes.id))
      assert.ok(l.hair.style === 'none' || available.hair.includes(l.hair.style))
      assert.ok(l.height >= 0.94 && l.height <= 1.06)
      assert.equal(l.makeup.lipstick.amount, 0)
      if (l.morphs.Softness >= BODY_TYPES.plus.Softness) plus++
    }
    assert.ok(plus >= 10, `plus-size bodies come up often (got ${plus} of 60)`)
  })

  test('18. the game is 18+', () => {
    assert.equal(MIN_AGE, 18)
  })
})

describe('Skincare Bay', () => {
  test('19. every check-in gives a realistic mix of at least three skin issues, differing by seed', () => {
    const seen = new Set<string>()
    for (let seed = 1; seed <= 40; seed++) {
      const l = clone(DEFAULT_LOOK)
      skinCheckIn(l, seed)
      const c = l.care
      const issues = [Object.values(c.spots).includes('pimple'), Object.values(c.spots).includes('boil'), c.rash > 0, c.pigment > 0, c.dry > 0, c.underEye > 0.5].filter(Boolean).length
      assert.ok(issues >= 3, `seed ${seed}: ${issues} issues`)
      assert.ok(hasConditions(c))
      seen.add(JSON.stringify([Object.keys(c.spots).sort(), c.rash > 0, c.pigment > 0, c.dry > 0]))
    }
    assert.ok(seen.size > 10, 'varied combinations')
  })

  test('20. each condition has its treatment, and treating changes the skin logically', async () => {
    useStudio.getState().apply((l) => {
      l.care = { ...l.care, spots: { chin: 'boil', cheekL: 'pimple' }, rash: 0.8, pigment: 0.8, dry: 0.8, dew: 0, done: [] }
    })
    assert.equal(await play(runStep(SOOTHE, { product: SOOTHE.products[0], target: null, option: null })), 'done')
    assert.ok(useStudio.getState().look.care.rash < 0.3)
    assert.equal(await play(runStep(BRIGHTEN, { product: BRIGHTEN.products[0], target: null, option: null })), 'done')
    assert.ok(useStudio.getState().look.care.pigment < 0.4)
    assert.equal(await play(runStep(EXFOLIATE, { product: EXFOLIATE.products[0], target: null, option: null })), 'done')
    assert.ok(useStudio.getState().look.care.dry < 0.25)
    assert.equal(await play(runStep(COMPRESS, { product: COMPRESS.products[0], target: 'chin', option: null })), 'done')
    assert.equal(useStudio.getState().look.care.spots.chin, 'drained')
    assert.equal(await play(runStep(POP, { product: hand, target: 'cheekL', option: 'squeeze' })), 'done')
    assert.equal(useStudio.getState().look.care.spots.cheekL, 'popped')
    // a face wash leaves her wet and dewy; the toner pad then shows what it lifted
    assert.equal(await play(runStep(FACE_WASH, { product: FACE_WASH.products[0], target: null, option: null })), 'done')
    assert.equal(useStudio.getState().look.care.dew, 1)
    assert.ok(padDirt(useStudio.getState().look) < padDirt({ ...useStudio.getState().look, care: { ...useStudio.getState().look.care, done: [] } }), 'a washed face leaves a cleaner pad')
    assert.equal(await play(runStep(TONER, { product: TONER.products[0], target: null, option: null })), 'done')
    assert.ok(useStudio.getState().look.care.dew < 1)
  })
})
