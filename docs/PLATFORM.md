# DollScene · Beauty Studio: platform build (Vatar Games SDK)

A separate, lean build of DollScene that runs inside the Lagos Life Games app through the
official Vatar Games SDK v1 ([docs](https://lagoslife.app/developers/docs)). It opens
straight into the 3D beauty studio: no landing page, no sign-up, no login of our own.

```bash
npm run dev:studio        # http://localhost:5174/studio.html (preview mode: not framed)
npm run build:studio      # dist-studio/
npm run test:vatar        # backend checks: sessions, looks, purchases, webhooks, XP
npm run character         # rebuild the 3D character from MakeHuman CC0 data (needs Blender + MPFB)
```

## Audit of the existing codebase (October 2026)

| | Finding |
|---|---|
| Renderer | Vite 8 + React 19 + React Three Fiber 9 + drei 10 + three r186. Kept. |
| Asset formats | GLB/glTF only, with Draco/Meshopt and KTX2 decoders self-hosted. A drop-in manifest lists `public/models/**`. |
| Characters | **No real character existed.** `public/models/*` held only `.gitkeep` files, so every doll was the procedural placeholder in `src/three/doll/` (capsules, spheres and lathes, no skeleton, no morph targets, makeup drawn as colour swaps on primitives). Not usable for realistic beauty work. |
| What had to be replaced | The base character, hair, garments and eyes: all of it. The procedural doll stays for the main game until real starters exist. |
| Good bones | `docs/ASSET_SPEC.md` (shared skeleton, `<Name>_Neg/_Pos` morph pairs) and the bone-name module binder in `GlbDoll`, now `src/three/doll/attachModule.ts`, reused by the studio. |
| Pre-existing build errors | `src/pages/Shop.tsx` fails `tsc -b` (`WorldStoreKind` values, unused `Storefront`). Untouched; the studio type-checks with its own `tsconfig.studio.json`. |

## The character (milestone 1)

Generated headlessly by `scripts/character/build_character.py` from MakeHuman / MPFB 2 data,
all released **CC0**:

- Adult female base (age macro 25, African ethnicity macro), ~14.5k vertices, mixamo-named
  skeleton without the `mixamorig:` prefix, A-pose relaxed at runtime.
- **62 real morph targets** (31 sliders × Neg/Pos) baked from MakeHuman targets: nose width,
  bridge, tip, length; lip volume, width, cupid's bow; jaw, chin, chin width; cheekbones,
  cheeks; forehead; eye size, spacing, openness; brow height and arch; face fullness and
  length; shoulders, bust, bust height, waist, belly, hips, glutes, thighs, arms, softness,
  muscle.
- The same morphs are baked onto brows, lashes, hair and clothes by refitting each MakeHuman
  proxy at every morph extreme, so garments really reshape with the body.
- Skin: the CC0 African female texture turned into a near-white detail map (pores, lips,
  palms kept; painted scalp hair and nipple/genital detail removed) that the chosen tone
  multiplies, plus a fine normal map.
- Makeup masks baked in the body's UV space from mesh vertex groups and facial landmarks:
  foundation, concealer, contour, blush, highlight, eyeshadow, upper and lower liner, brow
  fill, lip, lip liner, nails, close-cropped scalp hair. Composited live in a custom skin
  shader (`src/studio/character/skinMaterial.ts`), with per-layer roughness for gloss.
- Body-hide masks per outfit and shoe, so skin under clothes is never drawn.
- Assets: 6 hairstyles, 4 outfits, 3 shoes, 3 brow shapes, 3 lash styles, 5 iris colours.
  Compressed with meshopt + WebP: 2.7 MB body, 0.1–0.9 MB per module.

**Honest quality note.** This is a real, rigged, morph-driven human, but MakeHuman is
mid-fidelity: no eye/jaw bones or facial rig, a 2K skin map, alpha-card hair (the afro reads
as a cap), and dated clothes. It is the right foundation to build the systems on, not the
final art.

## Assets you must obtain externally

| Need | Why | Recommended source / workflow |
|---|---|---|
| Hero base characters (several faces) | Premium realism: 4K skin, detail normals, wrinkle maps, eye and jaw bones, ARKit-style face shapes | **Reallusion Character Creator 4** with the Game Base export (licence allows game distribution), or a commissioned artist sculpt. Keep the mixamo bone names and add our 31 `_Neg/_Pos` morph pairs. *Avoid MetaHuman (licence is Unreal-only) and Daz (needs a per-title interactive licence).* |
| Braids, knotless, cornrows, locs, twists, Bantu knots, Fulani braids, wigs, gele | Not in any CC0 library at usable quality | Commission (strand-to-card in Blender or Houdini), or licensed packs from game-asset stores with redistribution rights. Skin to `Head`, material `Hair`, grayscale map for dyeing (see `ASSET_SPEC.md` §4). |
| Fashion: aso-oke, ankara, iro and buba, agbada, bodycon, jewellery, bags, nails shapes | MakeHuman clothes are generic | Marvelous Designer → Blender: refit on the base, transfer the body morphs (the build script's refit approach works for any mesh), export one GLB per item. |
| Listing art | Review checklist item 07 | 512 px square PNG icon, 3–5 screenshots, short description ≤ 120 chars. |

The pipeline is data-driven: a new hair or garment is a GLB in `public/models/studio/…` plus
an entry in `character.json` (written by the build); editors list whatever the catalog holds.

## Architecture

```
studio.html                  loads the official SDK from lagoslife.app, then src/studio/main.tsx
src/shared/studio/           pure TS shared with the server (copied by functions' sync-shared)
  look.ts                    the look model + sanitizeLook (server re-validates every save)
  presets.ts                 skin tones, makeup looks, character presets, transformation presets
  challenges.ts              daily briefs + scoring (styling only), influencer levels
  products.ts                Vatar product ids → entitlements (prices live in the dashboard)
src/studio/
  character/                 3D renderer: StudioCharacter, skin shader, pose, catalog
  stage/StudioStage.tsx      canvas, light-formers, turntable, framing, pinch zoom
  state/store.ts             appearance state, undo/redo, before/after, pause, sync status
  editors/                   Face, Makeup, Hair, Body, Fashion, Transform, Looks, Play
  vatar/sdk.ts               Vatar SDK adapter (documented calls only)
  backend/api.ts             our server client + per-device cache keyed by Vatar player id
  session.ts                 boot, autosave, offline fallback, purchase restore and claim
functions/src/vatar.ts       HTTP function: session verify, looks, challenge XP, purchase grant, webhook
```

### How the SDK is used

| Docs | Here |
|---|---|
| `Vatar.init()` → `{ player, session, mode }` | Player name and avatar in the header; `player.id` keys all saves. Not framed → clearly labelled **Preview** mode (device-only saves, no purchases, no leaderboard). |
| `Vatar.session()` | A fresh token on every server call; the server calls `POST /session/verify` and uses the `playerId` it returns. Nothing from the client is trusted as identity. No cookies. |
| `Vatar.purchase(id)` / `onPurchase` / `purchases()` | Shop palettes. Every result goes to `/api/vatar/claim`; the server `GET /purchases/{id}`, checks `playerId`, refuses `refunded`, grants once per purchase id in a transaction, then `POST /purchases/{id}/deliver`. `purchases()` after init restores interrupted ones. |
| Webhook `purchase.paid` | Signature checked (`sha256=` HMAC, constant time), deduped by event id, then the same API-verified grant. |
| `submitScore` / `leaderboard` | Score = influencer XP, which only the server awards (scored from the shared rubric; only improvements count). |
| `onPause` / `onResume` | Canvas frameloop stops (`never`), idle animation stops. Also on `visibilitychange`. No audio yet, so nothing plays before a tap. |
| Not used | `Vatar.match.*`: the studio isn't multiplayer. Nothing assumes access to the player's Lagos Life 3D avatar or writes to it. |

Frame constraints respected: no popups, `alert`/`confirm`, new windows, downloads, fullscreen,
camera, clipboard or payment APIs; touch-only controls; storage access wrapped in try/catch.

## Deploy

1. Firebase project (Blaze for Functions). Add a hosting site for the studio and map it:
   `firebase target:apply hosting studio <studio-site-id>` and `firebase target:apply hosting app <main-site-id>`.
2. Secrets: `firebase functions:secrets:set VATAR_SECRET` (`vtr_test_…` first) and
   `VATAR_WEBHOOK_SECRET` (`vtr_whsec_test_…`).
3. `npm run build:studio && firebase deploy --only functions:vatarApi,firestore:rules,hosting:studio`
4. The `studio` target sends `Content-Security-Policy: frame-ancestors https://lagoslife.app https://www.lagoslife.app https://naijalife.app https://www.naijalife.app https://lagoslife.eliysites.com` and no `X-Frame-Options`, and rewrites `/api/vatar/**` to the function on the same HTTPS domain. Use your own domain (Firebase custom domain); the webhook must be `https://<your-domain>/api/vatar/webhook`.
5. In the Vatar dashboard create the products `palette-gold-hour` and `palette-lagos-nights` (one-off, ₦100–₦50,000).

## Sandbox test checklist (not yet run)

The official sandbox needs your developer account, the draft's test keys and the deployed
HTTPS address, so it has **not** been run. Run this at `https://lagoslife.app/developers/sandbox/<draft>`:

- [ ] Studio opens straight into the character; header shows your name and the **Sandbox** badge (`mode: "test"`, `t_…` id).
- [ ] Change a look, reload: it comes back (server copy). Save a look to the lookbook; reload; it's there.
- [ ] Shop → Get → **Pay (test)**: palette unlocks; dashboard shows the purchase verified and delivered. Repeat with **Fail (test)**: nothing unlocks.
- [ ] "Send test webhook" from the dashboard returns 2xx.
- [ ] Play → Send to the judges → Leaderboard shows your XP.
- [ ] Background the phone / open the pay sheet: the 3D stage freezes, resumes after.
- [ ] 375 × 812 portrait, touch only, on mobile data.
