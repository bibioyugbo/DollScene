/**
 * Studio logic tests: the avatar state, the beauty routines (played on a real three.js hand rig,
 * headless), the clinic, scenes and persistence. Run: npm run test:studio
 */
import assert from 'node:assert/strict'
import { beforeEach, describe, test } from 'node:test'
import { clinicEffect, effectiveMorphs } from '../../src/shared/studio/clinic'
import { DEFAULT_LOOK, HEELS, nameKey, needsHeels, PIECE_IDS, sanitizeLook, slotOf, type StudioLook } from '../../src/shared/studio/look'
import { BODY_TYPES, CHARACTER_PRESETS, DEFAULT_PRESET, MAKEUP_PRESETS, randomDoll } from '../../src/shared/studio/presets'
import { cancelAction, isRunning, skipAction } from '../../src/studio/actions/engine'
import { RETWIST, TAKEDOWN, WASH } from '../../src/studio/actions/haircare'
import { amountOf, lookStep, makeupStep, removeStep, shadeProduct } from '../../src/studio/actions/makeup'
import { MANICURE } from '../../src/studio/actions/nailcare'
import { BRIGHTEN, CLEANSE, COMPRESS, EXFOLIATE, EYE_PATCHES, FACE_WASH, hasConditions, morningLook, padDirt, PATCHES, POP, SKINCARE_STEPS, skinCheckIn, SOOTHE, TONER } from '../../src/studio/actions/skincare'
import { ageOn, MIN_AGE, validateDob } from '../../src/studio/ui/onboardRules'
import { runSequence, runStep } from '../../src/studio/actions/steps'
import { fx } from '../../src/studio/state/fx'
import { useStudio } from '../../src/studio/state/store'
import { SCENES } from '../../src/studio/scenes/defs'
import { installCharacter, play } from './fakeCharacter'

const hand = { id: 'hands', name: 'Hands', blurb: '', color: '#ffffff' }
const clone = (l: StudioLook) => structuredClone(l)

function fresh(phase: 'studio' | 'onboard' = 'studio', look: StudioLook = clone(DEFAULT_PRESET.look)) {
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
    assert.equal(useStudio.getState().look.hair.style, 'afro_fringe')
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
    assert.ok(!toasts().some((t) => t.startsWith('success:')), 'no toast: the change shows on the doll')
  })

  test('5b. the morning: she wakes in eye patches; they peel off from the outer corner', async () => {
    useStudio.getState().apply((l) => morningLook(l, { patches: 1, spots: 1, underEye: true, bonnet: true }))
    assert.equal(useStudio.getState().look.care.eyePatches, true)
    let peeled = 0
    const r = await play(runStep(EYE_PATCHES, { product: hand, target: null, option: null }), { onFrame: () => (peeled = Math.max(peeled, fx.skin.eyePeel.L, fx.skin.eyePeel.R)) })
    assert.equal(r, 'done')
    assert.ok(peeled > 0.9, 'the patches visibly peeled')
    assert.equal(useStudio.getState().look.care.eyePatches, false)
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
  test('16. twenty-one bare-faced starting dolls, Bibi in the middle (11th), a range of builds across races', () => {
    assert.equal(CHARACTER_PRESETS.length, 21)
    assert.equal(CHARACTER_PRESETS[10].id, 'bibi', 'Bibi sits in the middle of the lineup')
    assert.equal(DEFAULT_PRESET.id, 'bibi', 'the game still opens on Bibi')
    for (const c of CHARACTER_PRESETS) {
      for (const k of ['foundation', 'concealer', 'blush', 'eyeshadow', 'liner', 'lipstick', 'contour', 'highlight', 'bronzer', 'powder'] as const) assert.equal(c.look.makeup[k].amount, 0, `${c.name} wears no ${k}`)
      assert.equal(c.look.makeup.mascara, 0, `${c.name} wears no mascara`)
    }
    // women read slimmer overall, but full-figured and plus-size dolls are still in the cast
    const fullish = CHARACTER_PRESETS.filter((c) => c.look.morphs.Softness >= 0.5)
    assert.ok(fullish.length >= 6, `a range of builds incl. full-figured (got ${fullish.length})`)
    for (const c of CHARACTER_PRESETS) if (c.look.morphs.Masc < 0.6 && c.id !== 'amaka') assert.ok(c.look.morphs.Softness <= BODY_TYPES.curvy.Softness, `${c.name} is a slimmer build`)
    const plus = CHARACTER_PRESETS.filter((c) => c.look.morphs.Softness >= 0.8)
    assert.ok(new Set(plus.map((c) => c.look.skin.tone)).size >= 3, 'plus-size dolls across different skin tones')
    assert.ok(plus.some((c) => c.look.morphs.Masc >= 1) && plus.some((c) => c.look.morphs.Masc < 0.6), 'plus-size men and women')
  })

  test('16b. every doll has a short bio, and the new five are in the cast', () => {
    for (const c of CHARACTER_PRESETS) {
      assert.ok(c.blurb.length > 10, `${c.name} has a bio`)
      assert.ok(c.blurb.split(/\s+/).length <= 15, `${c.name}'s bio is under ~15 words: ${c.blurb}`)
    }
    assert.equal(CHARACTER_PRESETS.find((c) => c.id === 'grace')!.blurb, 'Sometimes you just have to accept it.')
    for (const id of ['bambi', 'jayden', 'elias', 'remi', 'candi']) assert.ok(CHARACTER_PRESETS.some((c) => c.id === id), id)
  })

  test('16c. men have flat chests, Grace is the only pregnant doll, dresses and skirts come with heels', () => {
    for (const c of CHARACTER_PRESETS) {
      if (c.look.morphs.Masc >= 1) {
        assert.equal(c.look.morphs.Bust, 0, `${c.name}: no breasts on a man`)
        assert.equal(c.look.morphs.ChestFlat, 1, `${c.name}: a male chest`)
        assert.equal(c.look.morphs.BackStraight, 1, `${c.name}: a straight back`)
        assert.ok(c.look.morphs.Thighs <= 0.5, `${c.name}: lean thighs`)
      }
      assert.ok(['none', 'round', 'square', 'sunnies'].includes(c.look.jewellery.glasses), `${c.name}: round or rectangular frames`)
      if (c.look.jewellery.glasses === 'sunnies') assert.equal(c.id, 'chidi', 'only Chidi wears shades')
      if (c.id !== 'grace') assert.equal(c.look.morphs.Pregnant, 0.5, `${c.name} is not pregnant`)
      if (needsHeels(c.look.wear)) assert.ok(HEELS.includes(c.look.wear.shoes!.id), `${c.name} wears heels with a dress or skirt`)
      for (const w of Object.values(c.look.wear)) if (w) assert.ok(slotOf(w.id), `${c.name}: ${w.id} is a real piece`)
    }
    assert.equal(CHARACTER_PRESETS.find((c) => c.id === 'grace')!.look.morphs.Pregnant, 1)
    const bibi = CHARACTER_PRESETS.find((c) => c.id === 'bibi')!.look
    assert.deepEqual(bibi.wear.top, { id: 'top_crop_tank', colors: ['#C8102E', '#FFC72C', '#2A1200'] })
    assert.equal(bibi.wear.bottom!.id, 'bottom_baggy_jeans')
    assert.equal(bibi.hair.style, 'goddess_braids')
    // the defaults wear piercings and ink, all removable
    assert.ok(CHARACTER_PRESETS.some((c) => c.look.jewellery.navel))
    assert.ok(CHARACTER_PRESETS.some((c) => c.look.jewellery.industrial))
    assert.ok(CHARACTER_PRESETS.some((c) => c.look.jewellery.nose !== 'none' || c.look.jewellery.septum || c.look.jewellery.lip !== 'none'))
    assert.ok(CHARACTER_PRESETS.some((c) => c.look.tattoos.length > 0))
  })

  test('16d. one piece, any colourway: recolouring changes three colours, never the asset', () => {
    const l = clone(DEFAULT_PRESET.look)
    for (const colors of [['#C8102E', '#FFC72C', '#2A1200'], ['#1E7A3A', '#FFC72C', '#0E2A16'], ['#1F4FA8', '#F28C28', '#0E1A33'], ['#E07AA6', '#6A3FB0', '#2A1030'], ['#C8102E', '#1E7A3A', '#F4EFE6']] as [string, string, string][]) {
      l.wear.top = { id: 'top_crop_tank', colors }
      const s = sanitizeLook(l)
      assert.equal(s.wear.top!.id, 'top_crop_tank')
      assert.deepEqual(s.wear.top!.colors, colors)
    }
    assert.ok(PIECE_IDS.length >= 35)
  })

  test('16e. old saves (one outfit + shoes) are dressed in pieces', () => {
    const old = sanitizeLook({ v: 2, outfit: { id: 'kai_butterfly_red', dye: '#FFFFFF', dyeAmount: 0 }, shoes: { id: 'shoes06' } })
    assert.equal(old.wear.top!.id, 'top_crop_tank')
    assert.equal(old.wear.bottom!.id, 'bottom_baggy_jeans')
    assert.equal(old.wear.shoes!.id, 'shoes06')
    const classic = sanitizeLook({ v: 2, outfit: { id: 'male_casualsuit01', dye: '#1E5A4A', dyeAmount: 0.75 } })
    assert.deepEqual(classic.wear.dress, { id: 'male_casualsuit01', colors: ['#1E5A4A', '#1E5A4A', '#1E5A4A'] })
    // a dress replaces a top and bottom
    const both = sanitizeLook({ v: 2, wear: { top: { id: 'top_tank', colors: ['#FFFFFF'] }, dress: { id: 'dress_slip', colors: ['#B0124A'] } } })
    assert.equal(both.wear.top, null)
    assert.equal(both.wear.dress!.id, 'dress_slip')
  })

  test('17. random dolls are complete, adult, deterministic, and include plus-size bodies', () => {
    const available = {
      hair: ['afro_big', 'locs', 'bob02', 'pixie'],
      pieces: [
        { id: 'top_crop_tank', slot: 'top', colors: ['#C8102E', '#FFC72C', '#2A1200'] },
        { id: 'top_tank', slot: 'top', colors: ['#FFFFFF', '#000000', '#000000'] },
        { id: 'bottom_baggy_jeans', slot: 'bottom', colors: ['#7FA3C9', '#D8A04A', '#B8B8B8'] },
        { id: 'bottom_mini_skirt', slot: 'bottom', colors: ['#EEEBE3', '#D8D2C4', '#B8B8B8'] },
        { id: 'dress_slip', slot: 'dress', colors: ['#B0124A', '#E8C7A0', '#FFFFFF'] },
        { id: 'shoes01', slot: 'shoes', colors: ['#FFFFFF', '#FFFFFF', '#FFFFFF'] },
        { id: 'shoes_pumps', slot: 'shoes', colors: ['#111111', '#2A1A14', '#111111'] },
      ],
    }
    assert.deepEqual(randomDoll(42, available).look, randomDoll(42, available).look)
    let plus = 0
    let plusMen = 0
    let plusWomen = 0
    for (let seed = 1; seed <= 60; seed++) {
      const d = randomDoll(seed, available)
      const l = sanitizeLook(d.look)
      assert.ok(l.wear.shoes && (l.wear.dress || (l.wear.top && l.wear.bottom)), 'fully dressed')
      if (needsHeels(l.wear)) assert.ok(HEELS.includes(l.wear.shoes.id), 'heels with a skirt or dress')
      assert.ok(l.hair.style === 'none' || available.hair.includes(l.hair.style))
      assert.ok(l.height >= 0.94 && l.height <= 1.06)
      assert.equal(l.makeup.lipstick.amount, 0)
      if (l.morphs.Softness >= BODY_TYPES.plus.Softness - 0.04) {
        plus++
        if (l.morphs.Masc >= 1) plusMen++
        else plusWomen++
      }
      if (l.morphs.Masc >= 1) {
        assert.equal(l.morphs.Bust, 0, 'random men: no breasts')
        assert.equal(l.morphs.BackStraight, 1, 'random men: straight back')
      }
      assert.notEqual(l.jewellery.glasses, 'cateye')
      assert.ok(d.blurb.length > 10 && !d.blurb.includes('fresh face'), 'a witty one-liner')
    }
    assert.ok(plus >= 10, `plus-size bodies come up often (got ${plus} of 60)`)
    assert.ok(plusMen >= 2 && plusWomen >= 4, `plus-size men and women both (men ${plusMen}, women ${plusWomen})`)
  })

  test('18. the game is 18+: a date of birth is required and under-18s cannot enter', () => {
    assert.equal(MIN_AGE, 18)
    const today = new Date(2026, 9, 13)
    assert.equal(validateDob('', today), 'Enter your date of birth.')
    assert.match(validateDob('2010-05-01', today) ?? '', /18 and over/)
    assert.match(validateDob('2008-10-14', today) ?? '', /18 and over/, 'one day short of 18')
    assert.equal(validateDob('2008-10-13', today), null, '18 today')
    assert.equal(validateDob('1990-02-28', today), null)
    assert.match(validateDob('2030-01-01', today) ?? '', /future/)
    assert.match(validateDob('1999-02-30', today) ?? '', /real date/)
    assert.equal(ageOn('2000-10-13', today), 26)
  })

  test('18a. old saves: lip stud/ring become labret/snake bites; cat-eye frames become rectangular', () => {
    const old = { ...clone(DEFAULT_LOOK), jewellery: { ...DEFAULT_LOOK.jewellery, lip: 'stud', glasses: 'cateye' } } as unknown
    const l = sanitizeLook(old)
    assert.equal(l.jewellery.lip, 'labret')
    assert.equal(l.jewellery.glasses, 'square')
    assert.equal(sanitizeLook({ ...clone(DEFAULT_LOOK), jewellery: { ...DEFAULT_LOOK.jewellery, lip: 'ring' } }).jewellery.lip, 'snakebites')
  })

  test('18b. doll names collide regardless of case, accents and punctuation', () => {
    assert.equal(nameKey('Bibi'), nameKey('bibi'))
    assert.equal(nameKey('B.i.b.i'), nameKey('Bíbí'))
    assert.notEqual(nameKey('Bibi'), nameKey('Bibie'))
    assert.ok(nameKey('美玲').length > 0, 'non-Latin names still have a key')
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
