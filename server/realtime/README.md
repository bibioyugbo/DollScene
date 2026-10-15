# DollScene realtime server

Live presence, per-door and per-scene headcounts, doll and pose sync, and public scene chat
(speech bubbles, `@name` mentions) for DollScene · Beauty Studio. Node 20+, one dependency (`ws`).

```bash
npm install
npm run dev          # ALLOW_GUESTS=1 on :8787 (the game's dev build connects here by default)
npm test             # moderation unit tests + a live two-player session (counts, chat, block, 18+)
```

## Protocol (JSON over `wss://<host>/realtime`)

| Client → server | |
|---|---|
| `hello {session?, adult: true, name, look, channel}` | first message; `adult` must be `true` (18+) |
| `join {channel}` | `hub`, `door:<id>`, `scene:<id>` |
| `state {s: {x, z, ry, pose, expr, act}}` | at scenes, ≤ 12/s, relayed batched at 10 Hz |
| `look {name, look}` | the doll others see (≤ 12 KB, ≤ 1 per 3 s) |
| `chat {text, cid}` | public to the channel (scenes only), ≤ 200 chars |
| `block {id, on}` · `report {id, reason, text}` · `ping` | |

| Server → client | |
|---|---|
| `welcome {you, name}` · `counts {c}` (every second when changed) | `door:scenes` = everyone at any scene |
| `roster {channel, peers, counts}` · `join {peer}` · `leave {id}` · `states {list}` · `look {id, name, look}` | |
| `chat {id, from, name, text, mentions, ts, cid?}` · `mention {...}` (to a mentioned player elsewhere) | |
| `notice {kind, text}` · `error {code}` | slow / dupe / muted / reported / adult_only / unauthorised |

## Safety

* **18+ only**: the game confirms age at doll creation and sends `adult: true`; anything else is refused.
* **Profanity**: slurs, sexual and abusive words are starred, including l33t, stretched and spelled-out
  variants (`moderation.mjs`), and names are cleaned the same way.
* **Rate limits**: chat 4 burst / 0.6 per second, duplicates within 15 s dropped, state 12/s, looks
  1 per 3 s, reports 3 burst; ≤ 8 connections per IP; 16 KB max message.
* **Block**: both directions, enforced on the server (chat, dolls and states). **Mute** is client-side.
* **Report**: logged as JSON (stdout, plus `REPORT_LOG` file if set) and the reporter blocks them;
  three different reporters within 10 minutes pause the sender's chat for 15 minutes.

## Identity

Inside the games app the client sends the Vatar session token; the server verifies it with
`POST https://lagoslife.app/api/games/v1/session/verify` using `VATAR_SECRET` and uses the player id
it returns (one live connection per player). `ALLOW_GUESTS=1` (local/preview only) gives
unauthenticated players a random server-side id.

## Deploy (Cloud Run)

See the comment at the top of `Dockerfile`. Then build the game with
`VITE_REALTIME_URL=wss://<service-url>/realtime npm run build:studio`, and add the service's origin to
the studio's `Content-Security-Policy` if you add a `connect-src` there. Presence is in memory, so
run a single instance (`--max-instances 1`, which comfortably holds thousands of sockets); to scale
out, put the channel maps in Redis pub/sub.
