# DollScene

An 18+ 3D dress-up and character game with Lagos roots: hyper-customisable avatars, a living 3D globe, fashion challenges, cribs, careers and friends. **Make a look. Make a life.**

Built with **Vite + React 19 + TypeScript + Tailwind v4**, **Three.js / React Three Fiber / Drei**, **Zustand**, and **Firebase** (Auth, Firestore, Storage, Cloud Functions, Cloud Messaging).

> **Works with zero setup.** Without Firebase keys the game runs on a built-in offline backend (localStorage + IndexedDB). Each browser tab is its own player and tabs sync in real time. Add Firebase keys and the same code runs against Firebase with server-side rules.

**Brand.** Name: DollScene (set `VITE_APP_NAME` to change it). Primary call to action: **Join the scene**. Type: Nunito Black (wordmark), Outfit ExtraBold (display), Space Grotesk (alternate), DM Sans (UI). Palette tokens in `src/index.css`: bone `#F4F0EA`, blush `#F5D4DA`, ink `#0E0B10`, chrome `#C7CAD1`, electric pink `#FF2E88`, acid lime `#C8FF3D`. Earned currency is **Glam**; premium **Gems** are kept separate. *Trademark, domain and social handles for “DollScene” still need checking.*

## Quick start

```bash
npm install
npm run dev            # http://localhost:5173
```

1. Click **Join the scene**, enter a date of birth (18+, checked again on the server), accept the rules, sign up.
2. Tap **Play**: the globe slides left and the "Pick your doll" panel opens. Flip through 35 default dolls with the arrows or **New doll**, tweak fit/skin/hair, then sign up beside her (doll name, @username, email, password) → 18+ check (date of birth + rules) → privacy choices (username, city, show on globe, online status; who can message you lives in Settings) → you land in your crib, where a truck drops off your Ghana Must Gos, suitcases and boxes to unpack.
3. Open a second tab, sign out there, and sign up as another player to test friends and chat.

```bash
npm run build          # type-check + production build to dist/
npm run test:logic     # end-to-end test of all server-side game rules
npm run catalog        # regenerate the shop catalog
npm run lint
```

## What's in the box

| Area | Where |
|---|---|
| **Landing**: a toy earth covered in player and bot dolls; tap one for a thought-cloud card (name, core, level, city, **Befriend**). **Change the scene** cycles Bubblegum (pink floral), Spacy (purple with stars), Earthy (valley with trees, a stream and deer) and Icy (falling snow); the globe, the button, the 18+ badge and the logo box all follow the scene, and the logo doll stays pink. **Play** (or Befriend when signed out) slides the globe left and opens "Pick your doll" with sign-up beside it | `src/pages/Landing.tsx`, `src/components/landing/`, `src/three/EarthGlobe.tsx` |
| **In-game frame**: no sidebar. Every place (Crib, Drip, Chat, DollScene) fills the screen; a small floating panel on the left has a little 3D icon for each, plus your profile and settings; level, XP bar, Glam, Gems and notifications float top right | `src/components/AppShell.tsx`, `src/components/NavIcons3D.tsx` |
| **Module loader**: whole-screen "Spinning up the next scene" globe whenever you switch between Crib, Shop, Friends and DollScene | `src/components/SceneLoader.tsx`, `src/App.tsx` |
| Auth: Google + email/password, 18+ date-of-birth gate (checked again on the server) | `src/components/AuthModal.tsx`, `src/shared/age.ts` |
| 35 default dolls across streetwear, classy, basics, thrift, edgy, baddie, gym and traditional drip: Ada (gele + oleku), Chioma (Igbo lace, George wrapper, coral), Zainab (Hausa crop + zani + dankwali), Tunde (agbada + fila), Obinna (isiagu + red cap + coral); the traditional pieces also arrive in your move-in suitcase | `src/shared/starters.ts`, `src/shared/catalog.ts` |
| **Crib** (home): every player starts in a furnished studio (sleeping mat, rug, beanbag, side table, plant and a Ghana Must Go that stays; about half also get a cat or a dog), older players get it added once, Wardrobe / Makeover / Beauty Doctor / Decorate / Missions dock; first visit: the truck drives up and your 2 Ghana Must Gos, 2 suitcases and 3 boxes land in the room, tap each (or Unpack all) to fill your wardrobe and furniture tray (+15 Glam each); build mode, decor, layouts, upgrades, friend visits | `src/pages/Home.tsx`, `src/three/apartment/`, `src/shared/movein.ts` |
| **Wardrobe**: 3D walk-in closet behind your doll (rails, shoe walls and cubbies coloured from what you own), filters, presets, post a look | `src/pages/Wardrobe.tsx`, `src/three/DollStage.tsx` |
| **Makeover**: thin, cute studio panel with an emoji icon rail: skin, face, eyes, 25+ hairstyles, makeup, beard, nails, 29 piercing sites, tattoo body map, body, outfit, identity | `src/pages/Create.tsx`, `src/components/customizer/` |
| **Beauty Doctor**: Botox, lip filler, nose job, jawline, chin, brow lift, veneers, glow facial, BBL, breast lift, tummy tuck, lipo, body contour; live 3D preview, bill shown, pay only when happy | `src/pages/BeautyDoctor.tsx`, `CLINIC_PROCEDURES` in `src/shared/economy.ts` |
| **Drip** (shop): a 3D street of ten stores: Tolapsd (streetwear), Thai Collective (classy dresses), Sheeen (basics), Bend Down Select (thrift), Deji Deji (edgy), Dope by Febby (baddie & owambe), Booty (lingerie & lounge: velvet curtains, heart mirror), Meirre Chen (luxury: quilted facade, pearls, gold plinths), Nova Sport (gym: speed stripe, sneaker pyramid, treadmill) and GoBonkers (Naija streetwear: jerseys, football). The store in front lights up; tap to walk in. Inside, your doll walks into a fitting room: rails for shirts, shoes, belts, caps, bags and chains (plus dresses or lingerie where the store sells them), each piece a small 3D model on a 3D rail you scroll with 3D arrows; the piece in the middle goes straight on your doll, pick a print, then Buy & wear. "Browse every rail" keeps the full catalogue and furniture | `src/pages/Shop.tsx`, `src/three/DripWorld.tsx`, `src/three/ItemCarousel.tsx`, `src/three/ItemModel.tsx`, `src/shared/drip.ts` |
| **Friends**: friends list (favourite, Chat, Visit their crib, Go out), date invites, requests (accept/decline/block), chats + message requests, Discover with filters | `src/pages/Friends.tsx`, `src/components/GoOutDialog.tsx` |
| **Flip phone chat**: the whole text chat (receipts, typing, reactions, replies, look cards, report/block) on the screen of a 3D flip phone that flips open and snaps shut | `src/pages/PhoneChat.tsx`, `src/components/chat/` |
| **DollScene**: a toy-map of Lagos with real spots (Eko Atlantic, Landmark Beach, Lekki–Ikoyi Link Bridge, Lekki Conservation Centre, Nike Art Gallery, National Theatre, Balogun Market, Freedom Park, TBS, Ikoyi rooftop). Tap a spot to fly there and see who's around and add friends; plan romantic or friendship dates (romantic dates respect dating preferences; residents say yes; +30 Glam); the Eko Atlantic **Runway** is the fashion challenge where people vote for the best outfit | `src/pages/DollSceneWorld.tsx`, `src/three/LagosMap.tsx`, `src/shared/places.ts`, `src/pages/Challenges.tsx` |
| Careers: starter job, 6 mini-games, promotions, Career Fair after 7 play days, daily/weekly missions | `src/pages/Work.tsx`, `src/components/minigames.tsx`, `src/shared/careers.ts` |
| Residents: 16 curated NPCs with lore, jobs, hangouts and lookbooks; always labelled, never stored as user accounts | `src/shared/npcs.ts` |
| Wallet, profiles, follow, feed, fame ladder, privacy settings, block/report, rate limits, data export, account deletion | `src/pages/`, `firestore.rules`, `storage.rules` |

## Architecture

```
src/
  shared/            Pure TS used by the browser AND Cloud Functions
    types.ts           every document type
    server/handlers.ts authoritative game logic (money, inventory, careers, friends…)
    catalog.json       generated shop catalog
  services/
    local/             offline backend: Firestore-like store on localStorage, IndexedDB blobs
    firebase/          Firebase backend (Auth, Firestore w/ offline cache, Storage, Functions, FCM)
  app/                 session provider + route guards
  pages/ components/   UI
  three/               globe, doll (procedural + GLB), stage, apartment, city
functions/           Cloud Functions: one callable per handler + push on new message
firestore.rules  storage.rules  firestore.indexes.json  firebase.json
docs/ASSET_SPEC.md   how to make and drop in real 3D models
```

**One rulebook.** Everything that touches money, inventory, careers, apartments or friendships runs through `src/shared/server/handlers.ts`. Offline, the handlers run in the browser. On Firebase they run as Cloud Functions (`functions/` copies `src/shared` at build time) and clients cannot write those collections. Chat messages, receipts, reactions, typing and presence are direct Firestore writes, validated by `firestore.rules`, so they stay instant.

## Drop in real 3D models

Put GLBs in `public/models/…` with the file names from **[docs/ASSET_SPEC.md](docs/ASSET_SPEC.md)**. That's it: a Vite plugin builds `/models/manifest.json` from the folder, and dolls, hair, garments and furniture switch from placeholders to your models automatically (Draco/Meshopt + KTX2 decoders are self-hosted in `public/draco` and `public/basis`).

```
public/models/starters/ada.glb          → Ada uses your model
public/models/hair/knotless-braids.glb  → every knotless-braid look
public/models/garments/gele.glb         → every gele in the shop
public/models/furniture/sofa.glb        → every sofa
```

## Going live on Firebase

1. Create a Firebase project. Enable **Authentication** (Google + Email/Password), **Firestore**, **Storage**, and the **Blaze** plan (needed for Functions).
2. `cp .env.example .env.local` and fill in the web config (plus `VITE_FIREBASE_VAPID_KEY` for push).
3. Deploy the backend:
   ```bash
   npm i -g firebase-tools && firebase login && firebase use --add
   npm --prefix functions install
   firebase deploy --only firestore,storage,functions
   ```
4. Deploy the app: `npm run build && firebase deploy --only hosting`.
5. The first visit seeds 60 demo dolls (flagged `isDemo`). You can also run `npm --prefix functions run seed` with service-account credentials.

Local emulators: `firebase emulators:start` and set `VITE_USE_EMULATORS=true`.

Functions default to `europe-west1`. To change it, set `FUNCTIONS_REGION` for the functions and `VITE_FUNCTIONS_REGION` for the app.

## What still needs a human

- [ ] **Real 3D assets**: 12 rigged, morph-ready starter characters on one shared skeleton; hair and garment modules; furniture. Follow `docs/ASSET_SPEC.md`. Until then everything uses procedural placeholders.
- [ ] **Brand permissions**: the shop shows original fictional labels by default. Real names (Meji Meji, Bolapsd, J Bottoms, Yati) appear only with `VITE_USE_FICTIONAL_BRANDS=false`, after written permission. No real logos are used.
- [ ] **Name clearance**: check trademark, domain and social handles for “DollScene”.
- [ ] **Age assurance**: date of birth is self-declared and checked on the server. For stronger assurance, add an ID or age-estimation provider before launch in strict jurisdictions.
- [ ] **Legacy attachments**: decide a retention policy for old voice notes and photos under `voice/` and `chat/` in Storage. New uploads are already blocked.
- [ ] **Legal pages**: `/terms` and `/privacy` are placeholders. Get them reviewed (NDPR, GDPR, age verification, user content, virtual currency).
- [ ] **Payments**: Paystack for Gems/VIP is not wired. It needs keys plus a server-side verification function.
- [ ] **Firebase project**: keys, Blaze plan, VAPID key, App Check, budget alerts.
- [ ] **Moderation**: reports land in `reports/` (admin-only). Build or choose a review tool.
- [ ] **Analytics sink**: `src/lib/analytics.ts` logs in dev. Plug in Firebase Analytics or your provider with `setAnalyticsSink`.

## Notes

- Ages 18+ only. Location is city-level and jittered. Real coordinates are never requested.
- The offline backend does not enforce security rules. It is for development and demos.
- `backup-pre-v2/` holds a copy of the original v1 source (git-ignored).
