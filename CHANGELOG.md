# Changelog

## Unreleased: the October 14 brief

- **Loader**: text only, three or four status lines ("Setting up balloons...", "Buying the
  drinks..."), about 2.5 s, then in; everything else keeps loading behind.
- **Accounts**: sign up (username = the doll's name, password, date of birth, 18+) and sign in;
  30-day refresh tokens that rotate on use and end on Sign out; scrypt passwords; "That username is
  already taken." and other exact errors; the doll is saved to the account. Served by the realtime
  server, mounted on the game's own dev/preview origin (so chat is live, not "offline"). Logo: the
  favicon with a sparkle on its right.
- **Landing**: Bibi 11th (the middle of 21), witty one-liners for every doll and random doll;
  women slimmer overall; plus-size men and women in Random doll; no toasts or confirm dialogs while
  trying things on (changes land on the doll).
- **Cast**: Bibi's iced matcha (clear cup, milk and matcha layers, ice, straw, held upright);
  Ifeoma's green bandeau, wide-leg trousers and a fat hand-rolled joint seen from the front, with low,
  red eyes (anyone holding a joint); Grace long blonde in a lilac maxi; Mei a caramel baddie in a
  black two-piece with her phone, long nails, her part in her skin tone; Sofia's mark beside her lip,
  darker; Chloe in overalls; Nala's long curly wig; new bios. Men on the male base: straight backs,
  lean thighs, flat chests (Ji-woo's reduced); Tobi in round glasses; Femi in a tracksuit; Chidi in
  a tailored suit; Jayden fat with lean thighs. Glasses: round or rectangular only.
- **Wardrobe**: every store stocks at least four tops, bottoms, dresses and shoes (cross-stocked
  pieces in their colourways); chains, necklaces and pearls drape over clothing.
- **Fixes**: male chests and every garment over them shaded with craters (morph normals of keys
  built on other morphs are recomputed after the build: `fix_morph_normals.py`); stray sliver
  triangles poking out of garments are dropped (lace briefs, slip dress); tattoos didn't render
  (the skin used 17 texture units; hide masks now pack into one) and now read on every skin tone;
  a wig keeps the last doll's colour when the next doll wears the same style; Tolaptsd's shutter
  flicker; the realtime server crashing on a dropped connection; swipes on Safari touch.
- **The street**: the stores round a curve like a game map, golden hour; each building its own
  roofline; ← →, wheel/trackpad and swipe move store to store; the active store glows (outline,
  aura, sign, light) and chimes its own note; Sign out (no Back); "Back to Street" in the stores.
- **Studio**: tooltips on the rail, a real shoe icon, Body/Face zoom, Undo and Turn only ("Hold to
  see before" removed), Take a picture (mirror selfie, selfie, screen capture; save or share).
- **Beauty Doctor**: piercings grouped by area; a true septum horseshoe, a long industrial bar,
  three lip piercings (labret, Monroe, snake bites).
- **Skincare**: the morning first (bonnet off, pull the pimple patch, peel the eye patches, wash);
  a fuller face wash (wet, lather between the palms, massage, rinse, pat dry with a towel); ASMR
  sounds per step (foam bubbles, creamy squelches, pats, peels...); tap the pimple, then the squeeze.
- **Make a Scene**: only the selections, with the scene's name and dress code top left; light and
  weather as painted swatches (your view only); real players per scene or "Be the first to enter";
  "X and Y are here" on arrival; tap a person to talk to them (tagged), or talk to everyone; Selfie
  in every scene (the real shot, to save or share); "Kiss" removed (it was the pout); real dolls as
  the guests; hands clasped redone.

## Unreleased: wardrobe pieces, cast and street (October 2026 brief)

- **Wardrobe as pieces**: 40 reusable pieces (14 tops, 13 bottoms, 4 dresses, 9 heeled shoes), each
  one asset recoloured through three colour slots (main, second, accent) with colourway presets and
  per-slot pickers; dolls are presets that reference pieces. Classic MakeHuman sets/shoes remain
  (one tint). Old saves are migrated to pieces. Fitted tops tuck into loose bottoms.
- **Shoes**: pumps, block heels, mules, strappy sandals, ankle-strap heels, heeled boots, platforms,
  kitten heels, coral beaded heels: lofted around the arched foot; the app pitches the feet and lifts
  the doll by each shoe's own arch/lift. Dresses and skirts are always worn with heels.
- **Bodies**: ChestFlat (a male chest: masculine dolls no longer show breasts), Pregnant (Grace only),
  arms relax in the doll's own frame (no spread arms after turning her).
- **Accessories & body art**: coral headband/necklaces/bracelets/anklets, waist beads, horsehair
  whisk, lit joint (ember + smoke), clutch, fan, rainbow pins, glasses chain, layered chains,
  industrial piercing; tattoos inked in the skin (12 designs, 23 spots), laser removal and piercing
  counter at the Beauty Doctor. Glasses re-spaced to real frame proportions. Mei's wig has a part line.
- **Cast**: 21 dolls with one-line bios (new: Bambi, Jayden, Elias, Remi, Candi); new hair: boho
  Fulani braids (613 blonde for Bibi), a fringe afro (Ifeoma).
- **Entry**: Enter button sized to its label; date of birth required (under 18 can't enter; only the
  yes/no is kept); unique doll names (Firestore `dollNames`, realtime-server register in dev):
  "That name is already taken"; Random doll is text only; the name sits centred under the doll.
- **Hub**: a golden-hour high street with 12 distinct buildings (Tolaptsd, Thai Collective, Mon
  Cherie, Nova Sport, Glam Studio, Dope by Fabby, Deji Deji, Skin Bay, Beauty Doctor, Okrika Closet,
  BOOTY, Make a Scene), lit display windows, lamps, trees, traffic; "People already here" when others
  are inside. Header: logo + Back only. Store interiors match their buildings.
- **Loader**: cycling glam icons (hair dryer, hangers, ring, lipstick, chain), "Loading your scenes...".

## Unreleased: DollScene · Beauty Studio upgrade (`dollscene-lagos-life`)

See `docs/UPGRADE_AUDIT.md` for the audit and setup.

- **Brand**: DollScene · Beauty Studio everywhere players look; 18+ ("I confirm I am 18 or older").
- **Loading screen**: three cross-fading SVG silhouette vignettes (brushing hair, a man in jeans, a
  paparazzi crowd with flashes) on an animated gradient with bokeh, sparkles and stars; "Loading your
  scenes…" with a progress bar tied to real preloading of every model, texture, thumbnail and scene.
- **Pick a doll**: all 16 dolls on one screen, Random doll (any tone, face, body incl. plus-size,
  hair, outfit), name + 18+ gate, instant pooled swaps (0 hidden frames under rapid clicking).
- **Cast**: 16 bare-faced dolls incl. Bibi; three quarters average, curvy or plus-size across races.
- **Anatomy**: skeleton-consistent body shapes (joint drift removed per slider: masculine arms no
  longer reach the knees), fuller plus-size arms/calves/neck, arms that rest outside hips and skirts,
  wrist joint limits.
- **Poses & expressions**: hands on hips, selfie (with phone), thinking, a proper wave, folded-thumb
  peace sign, puckered blown kiss; kiss and sad expressions; per-doll eased pose blending.
- **The Hub**: first-person atrium of glowing 3D doors (Glam Studio, Kai Collective, Mon Cherrie,
  Dope by Fabby, Deeji, Bolaptsd, Skincare Bay, Beauty Doctor, Make a Scene) with live headcounts.
- **Rooms**: the right panel is gone; left category rail + medium illustrated icon tiles; tap → one
  animated step with sound and haptics; hair colour dropdowns; store try-on spin.
- **Store outfits**: 11 original designs built in Blender (butterfly tanks, garden set, corset set,
  slip dress, sequin mini, flare set, adire iro & buba, ankara peplum set, distressed and tartan sets).
- **Skincare Bay**: pimples, boils, rash, hyperpigmentation and dry flaky skin per doll and visit,
  each with its own treatment; dewy droplets after washing, a dirty cotton pad after toner, a glow
  after sunscreen; marks heal over time; results persist.
- **Multiplayer**: `server/realtime` (WebSockets): presence, headcounts, doll and pose sync, public
  chat bubbles with @mentions, profanity filter, rate limits, block/mute/report.
- **Make a Scene**: other players' dolls with name tags and bubbles; per-scene activities.

## Earlier on this branch: Lagos Life beauty studio

### Phase 3–5: the full beauty game (master prompt)

**Flow.** Full-viewport app (real fullscreen on first tap outside Lagos Life; the Lagos Life frame
doesn't grant the Fullscreen API). Boot loader: three 3D doll silhouettes walking and laughing on
the real rig, up exactly until the studio has loaded. Then *Choose a scene* (2016 Prom, Best
Friend's Wedding, Rave, Fall, Beach, Rooftop Party, Movie Festival, Cinema Date, Halloween), then
for new players: doll name + age/terms confirmation (no personal data), starter gallery with
tone/undertone/face/body, confirmation ("Join the scene"), then the studio opens on Wake Up.

**Studio.** Floating 16-icon toolbar (Wake up, Skincare, Haircare, Hairstyles, Hair colour,
Makeup, Makeup looks, Brows & lashes, Lips, Nails, Jewellery & piercings, Outfits, Beauty Clinic,
Profile, Change scene, Make a Scene) with tooltips, focus states and arrow-key navigation; one
contextual panel (side panel on wide screens, bottom sheet on phones); camera framing per
category that keeps the face clear of the UI; hide-controls (H); undo/redo, turn, hold-to-compare.

**Routines** (`src/studio/actions/`): one reusable step system (product, option, target, regions,
animation, resulting state, verify, undo/replay). Changes land only when the animation completes
or is skipped; cancelled steps change nothing. Two-hand IK on the real rig with held props.
- Skincare A–K: patch peel, optional squeeze (or patch it instead), cleanse (splash/cloth,
  micellar pad), spot treatment, toner on a cotton pad, 5 serums, eye cream, moisturiser,
  sunscreen (face, ears, neck), lip balm, finish (compare, save, go on). Play-all sequence.
- Haircare by hair type: bonnet on/off, brushing (pick / paddle / edge brush / palm roll), wash &
  condition (afros shrink when wet, locs soak, straight hair goes glassy), towel dry, braid
  takedown and loc retwist section by section (8 scalp sections).
- Makeup: primer, colour corrector, foundation (matte/satin/dewy), concealer, powder, contour,
  bronzer, blush, highlighter, setting spray, eyeshadow (+shimmer), inner corner, liner, lower
  liner, mascara, brows (natural/pencil/pomade/laminated), lip liner, lipstick (satin/matte/gloss/
  frosted), ombre centre, gloss; each with applicators, apply and remove. 16 looks (Soft beat,
  Frosted lip, Grunge, Floral, No-makeup, Clean girl, Full/Soft glam, Douyin, Y2K, Gothic,
  Editorial, Party, Bridal…) applied product by product, then editable.
- Manicure: prep, base, colour, art, top coat, nail by nail, both hands.

**Character rendering.** Skin shader: blemishes with surface bumps, dark circles, texture/redness,
foam, wet skin, unblended cream, serum sheen, eye cream, balm, SPF finish, all new makeup layers,
progressive reveal. Real nail plates on the finger bones (6 shapes, length to press-on, cream/
jelly/chrome/glitter/cat-eye, 7 art patterns, rhinestones). Jewellery on head/spine/hand bones.
Pimple patches stuck to the skin. Facial expressions + natural blinking + sleepy morning face.

**Clinic.** Lip/cheek/chin filler, nose refine/lift, jaw, under-eye, hairline, density, BBL- and
lipo-style: live preview on the 3D doll, hold-to-compare, explicit confirm dialog, reversible.
Outside onboarding the base face/body is locked in the store (only the clinic reshapes).

**Scenes.** Six new environments (Wedding, Beach, Rooftop, Movie Festival, Cinema, Halloween) to
the same bar as Prom/Rave/Fall, every time/weather honoured; thumbnails rendered from the app.
Change Scene keeps the whole look and offers "back to last scene". Make a Scene: photo spots,
8 poses, 7 expressions, orbit/zoom/framing, hide UI, real capture, device gallery + download.

**Reliability.** App error boundary ("Oops, the glam team hit a little glitch." · Try Again /
Back to Studio / Report Issue), async error handler, per-hairstyle/garment load boundaries that
fall back to the last item that loaded, one toast per failed save, look rescued to the device on
crash/page hide, accessible toasts and confirm dialog, reduced-motion respected.

### Asset and rendering fixes
- **Torn sleeves / shards at the shoulders:** linear-blend-skinning folds at the armpit when the
  arms relax down from the A-pose (34 folded triangles on the sports top). The build now smooths
  shoulder/arm weights on the 4 bones the glTF keeps; measured 34→1, 30→0, 30→6, 28→8 per outfit.
  Garments also ride 3.5 mm off the skin after skinning.
- **See-through legs:** garments didn't write depth (the glTF loader disables it for alpha-blend
  materials), so the floor and scene ground drew over them. Fixed.
- **Hair through the body:** the MPFB library styles (long, ponytail, single braid, bob) were
  weighted to the shoulder/arm bones and swung with the arms; those weights now go to Spine2.
- **Loc roots:** flat stubs along the hairline; roots are now sunk and tapered into the scalp.
- Anchors (nails, jewellery, wet-hair centre, hair surface) no longer go through inverse bind
  matrices, which carry meshopt dequantisation; they use the live skinned surface and bones.

### Tests
- `npm run test:studio`: 22 headless tests on the real three.js hand rig (routines, cancel/skip,
  clinic lock, scenes, persistence, failed save). Backend suites updated for the renamed afro.

### Phase 2: hairstyles (first 3 for review)
- **Base character is now `~/Downloads/base_female.blend`.** Her MPFB macros live in
  `scripts/character/base_female.json` and `build_character.py` reads them, so the studio doll,
  her clothes and every hairstyle share one body. She keeps the app's Mixamo rig.
  `art/blender/base/base_female_mixamo.blend` is the fitting base for hand-built hair.
  The original file is never written to; `art/blender/base/base_female_session_2026-10-13.blend`
  is a copy of the unsaved Blender session from before this work.
- **New hairstyles:**
  - `fulani_braids`: centre and side cornrows into hanging braids, with gold cuffs and white beads (~19.5k tris).
  - `afro`: a rounded coily volume with a soft fuzz outline that replaces `afro01`; old saves map to it (~15.6k tris).
  - `pixie`: MPFB `short04`.
- **Hand-built hair pipeline:**
  - `scripts/character/hair/hairkit.py` holds the shared helpers: scalp mapping, hairline, gravity
    drape that keeps strands off the body, braid tubes, skinning down Head → Neck → Spine, and
    poke-through report.
  - Each style is a script, `style_<id>.py`, that writes `art/blender/hair/hair_<id>.blend` and its
    textures to `art/hair_tex/`.
  - `build_character.py` loads these, gives them the face and body slider shapes via the nearest
    head skin, and exports a `_tip` root-to-tip attribute on all hair.
- **Hair colour is one material with parameters:**
  - Base colour, tip colour (ombre), blend, roughness and shine; see `src/studio/character/hairMaterial.ts`.
  - 16 presets plus a custom picker (`src/shared/studio/hairColors.ts`).
  - Beads and cuffs keep their own colours.
- `*.blend` / `*.blend1` are gitignored. The build now clears its module folders first, so removed
  assets don't get shipped.
