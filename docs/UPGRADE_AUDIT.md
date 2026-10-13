# DollScene · Beauty Studio: upgrade audit (October 2026)

What was wrong in the existing game, what changed, and what needs setting up.

## Audit: what was wrong

| Area | Finding | Fix |
|---|---|---|
| **Arm length / proportions** | The skeleton itself was in proportion (elbow at the waist, wrist at the crotch, fingertips mid-thigh). But MakeHuman's body macros move the joints, and those changes were baked as plain shape keys over one fixed skeleton. The masculine end of the gender macro moved the head 13 cm up, made the forearm 28 % and the hand 22 % longer and the legs 11 cm longer. On the masculine dolls (Chidi, Femi, Tobi) the arms hung to the knees with oversized hands, and faces sat off their head bone. Weight, muscle and shoulder sliders drifted joints by 0.5–2.5 cm too. | `build_character.py` refits the rig for every slider and subtracts each bone's drift from the vertices it skins (lerped along the bone). Every body shape now changes girth and form only. Limb lengths, neck, leg-to-torso ratio and head height stay the base's ~7.5-head adult on all bodies. Arm length scales with height only. |
| Plus-size bodies | Weight only touched the torso and upper arm, so plus-size dolls had thin forearms, calves and necks. | `Arms` now includes the forearm. New `Calves` and `NeckFull` shapes. `BODY_TYPES` (slim to superPlus) move every soft-tissue area together. |
| Arms vs. hips | The relaxed pose opened the arms by a fixed amount, so on wide hips or full skirts the hands sank into the body. | `armClearance` measures her live, morphed hips and thighs at each joint's height, plus the outfit's skirt ease and the arm's girth, and opens the arms just enough. |
| Makeup on starters | Every starting doll wore a makeup look. | All 16 are bare-faced. Makeup exists only once applied in the Makeup Studio. |
| Doll swap | Hair and clothes were cloned and bound each time, behind `useDeferredValue`. The old outfit could show on the new body for a frame, or the doll could blank while a file downloaded. | Every module is downloaded and parsed during the loading screen, then pooled per doll and swapped by visibility in the same frame. A render check draws the doll only once every layer it wears is attached. |
| Restarting animations | Tapping again during a step cancelled it and started over. | Tiles are locked while a step plays. Poses blend once per doll, eased. |
| Pose details | The peace-sign thumb didn't fold, blow-a-kiss had no pucker, wrists had no limits, and one global pose blend was shared by every doll. | Peace grip folds the thumb over the curled fingers. Blow-a-kiss puckers. Wrists have swing/twist joint limits. Each doll blends its own poses. Added: hands on hips, thinking, selfie (with phone). Added expressions: kiss, sad. |
| Right-hand panel | Every studio screen had a long rectangular settings panel. | Removed. Left category rail plus medium icon tiles. Tap a tile and the step plays once, with hands, tools, sound and haptics. Hairstyles have a colour dropdown. |
| Clothes | 12 generic MakeHuman outfits only. | 11 original store outfits (`scripts/character/outfit/`), sold in five stores. Shells are cut from the body (clipping-free), skirts are tubes around the body's hull, and all prints are original art. |
| Skin | Only pimples, patches, dark circles and texture existed. | Added rash, hyperpigmentation, dry/flaky patches, boils (warm compress, then drained), flat spots after patches, and marks that heal on their own. Each condition has its own treatment. Results show on the doll and in a result badge: dewy droplets after a wash, a dirty cotton pad after toner, a glow after sunscreen. |
| Multiplayer | None (`Vatar.match` is 2–4-player staked matches only). | New WebSocket server (`server/realtime`): presence, headcounts per door and scene, doll and pose sync, public chat bubbles with @mentions, moderation. |
| Branding | "Dollscene", "Lagos Life" in titles, loader and copy. | DollScene · Beauty Studio everywhere players look. The host platform is named only in developer docs. |
| Age gate | 13+. | 18+ ("I confirm I am 18 or older"). The chat server refuses anyone who hasn't confirmed. |

## Flow

Loading screen (three silhouette vignettes; real preload progress) → **Pick a doll** (16 at once, Random doll, name, 18+) → **the Hub** (first-person atrium; doors glow on hover or tap; live count over each) → a room:

* **Glam Studio**: Makeup Studio (base, sculpt, eyes, brows & lashes, lips, full looks, nails, jewellery) and Hair Studio (styles with colour dropdowns, colour and ombre, haircare)
* **Skincare Bay**: wake up, cleanse, treat, tone & serum, moisturise & protect. Arrive with a fresh mix of issues whenever her skin is clear.
* **Beauty Doctor** (drip icon): glow drip and procedures, previewed, confirmed, reversible
* **Kai Collective · Mon Cherrie · Dope by Fabby · Deeji · Bolaptsd**: outfits and shoes
* **Make a Scene** → choose one of the nine scenes → pose, expressions, scene activities, photos, public chat with everyone there

## What needs a backend or setup

1. **Realtime server**: `server/realtime` (Node 20 + `ws`). See its README: `npm test`, Cloud Run deploy, `VATAR_SECRET`, `ALLOWED_ORIGINS`. Build the game with `VITE_REALTIME_URL=wss://<host>/realtime`.
2. **Functions**: redeploy `vatarApi` so the server-side look sanitiser knows the new outfits, shapes and skin fields (`npm --prefix functions run build` syncs `src/shared`).
3. **Character assets**: `scripts/character/outfit/build_outfits.py` then `npm run character` (Blender 4.5 + MPFB 2) rebuild everything in `public/models/studio`. Thumbnails come from the dev-server renderer described in `docs/PIPELINE.md`.
