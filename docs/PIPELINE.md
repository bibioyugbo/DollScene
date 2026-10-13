# Adding content to DollScene · Beauty Studio

Everything the studio shows comes from `public/models/studio/character.json` (written by the
character build) plus small data tables in code. You rarely touch rendering code.

## A hairstyle

1. Write `scripts/character/hair/style_<id>.py` (copy a sibling: `style_locs.py` for strand styles,
   `style_afro_big.py` for volume styles, `style_pixie.py` to fit an MPFB library hair). The kits
   (`hairkit`, `lockit`, `braidkit`, `shellkit`, `afrokit`, `volkit`, `flowkit`) handle the scalp
   mapping, gravity drape, skinning to Head/Neck/Spine and the `_tip` / `_section` attributes.
2. Build it: `/Applications/Blender.app/Contents/MacOS/Blender -b --python scripts/character/hair/style_<id>.py`.
   It saves `art/blender/hair/hair_<id>.blend`, renders a multi-view sheet to
   `art/screens/hair/<id>.png` and prints a `POKE` report (vertices inside the skin; deliberately
   buried root rings count there, so judge by the sheet).
3. Add `"<id>": ("blend", "Display name")` to `HAIR` in `scripts/character/build_character.py` and
   the id to `HAIR_IDS` in `src/shared/studio/look.ts` (and to a group in
   `src/studio/panels/HairPanels.tsx`).
4. `npm run character` (about 7 minutes) rebuilds and compresses everything into `public/models/studio`.
5. Thumbnail: a 256 px WebP at `public/thumbs/hair/<id>.webp` (render with the dev `?shot` hooks).

Colour needs no work: every style uses the hair master material (base, tip, blend, roughness, shine).

## A garment or shoes

**A store outfit (original design).** Add a function to `scripts/character/outfit/build_outfits.py`
and an entry to its `CATALOG` (name and store: `kai`, `moncherrie`, `dopebyfabby`, `deeji`,
`bolaptsd`), add the id to `OUTFIT_IDS` in `look.ts`, then:

```bash
OUTFIT_ENGINE=cycles OUTFIT_SAMPLES=16 Blender -b --python scripts/character/outfit/build_outfits.py -- <id>
npm run character            # bakes every body shape into it, exports, compresses
```

A design is made of *shells* (body faces cut by a signed field: `top_field`, `legs_field`; pushed
out along the skin; clipping-free on every body because each vertex rides the skin vertex it came
from) and *tubes* (skirts, wrappers, peplums: rings around the body's convex outline, each covering
the body halfway to its neighbours, `over()` / `drape_over()` for layering). Paint with the
position-map helpers (`paint_shell`, `paint_tube`). Material names carry the finish the app renders:
`Fabric`, `Fabric_satin`, `Fabric_sequin`, `Fabric_denim`, `Fabric_net` (alpha holes: rips, nets).
Check `art/screens/outfits/<id>.png` (five views, arms relaxed) before shipping.

**A MakeHuman asset.** Add its name to `OUTFITS` / `SHOES` in `build_character.py` (and a store in
`OUTFIT_STORES`) and to `OUTFIT_IDS` / `SHOE_IDS` in `look.ts`, then `npm run character`. The build
fits it to every body shape, smooths its shoulder weights and writes the body-hide mask.

**Thumbnails** (portraits, outfits, shoes, hair) are rendered from the running dev server by the
puppeteer script kept with the QA tools (`thumbs.mjs`: dolls on the blue stage, 256 px WebP into
`public/thumbs/<kind>/<id>.webp`).

## A body shape

Body sliders are MakeHuman targets or macros (`BODY_MORPHS` in `build_character.py`). The build refits
the rig for each and removes the joints' drift from the shape key, so a shape never changes limb
length or proportions (only height does). Body types for the cast and the random doll are recipes in
`BODY_TYPES` (`src/shared/studio/presets.ts`).

## A makeup product, shade or look

- Shades: the palettes in `src/studio/editors/palettes.ts`.
- A look: add an entry to `MAKEUP_PRESETS` in `src/shared/studio/presets.ts`. Looks are made of the
  same layers players edit, and play product by product automatically.
- A new layer needs a mask channel (build), a uniform in `skinMaterial.ts`, a field in `Makeup`
  (`look.ts`, with sanitising), an animation in `src/studio/actions/makeup.ts` and a rail entry in
  `MakeupPanels.tsx`.

## A routine step

Add a `StepDef` (see `src/studio/actions/steps.ts`): products, regions, `moves` (built from
`stroke`, `both`, `holdAt`, `onHair` in `moves.ts`), `apply` (the state it leaves) and `verify`.
Then cover it in `tests/studio/studio.test.ts` (`npm run test:studio`).

## A scene

Add a `SceneDef` to `src/studio/scenes/defs.ts`, a component `src/studio/scenes/<id>.tsx` built from
`scenes/kit`, a loader line in `scenes/loaders.ts`, and a 480×360 WebP at `public/scenes/<id>.webp`.

Fonts: drop the licensed Spicy Sale file into `public/fonts/` as `SpicySale.woff2` (or .otf/.ttf);
until then Bagel Fat One stands in.
