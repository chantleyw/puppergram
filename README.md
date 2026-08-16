# Puppergram

**Gram by gram, day by day.** A neonatal litter monitor for dog breeders — birth to eight weeks.

> Weight is the first thing to change in a failing newborn puppy, and the last thing anyone notices.

<!-- TODO(before submission): replace with a screenshot of the demo litter's critical alert firing.
     Load the demo litter, screenshot the home screen, save to docs/alert.png -->
![The litter home screen with a critical alert firing on the green-collar puppy](docs/alert.png)

**Live:** <!-- TODO: paste the Cloudflare Pages URL --> `https://puppergram.pages.dev`
**Verify a passport (no wallet needed):** `https://puppergram.pages.dev/verify`

---

## The problem

Neonatal puppy mortality is concentrated in the first two weeks, and weight is the single most predictive vital sign: a puppy that fails to gain for 24 hours, or drops below its birth weight, is in serious trouble before there is any visible symptom. Most hobby breeders record weights in a paper notebook, where a stalling trend is invisible until it is a crisis. Puppergram is not a weight log with a calendar — it is an early-warning system that reads every entry against a fixed set of rules and tells you which puppy needs attention tonight.

## How alerts work

The rules are hard-coded and shown in full inside the app, because a breeder being asked to act at 3am is entitled to know exactly what triggered the alarm.

Normal expectation: **5–10% gain per day**; roughly **double birth weight by day 7–10**.

| Rule | Condition | Severity |
| --- | --- | --- |
| Failure to gain | No weight increase in 24h | Warning |
| Weight loss | Any drop vs. previous entry | Warning |
| Below birth weight | Current < birth weight after 48h | Critical |
| Significant loss | More than 10% below peak weight | Critical |
| Slow doubling | Under 1.8× birth weight by day 10 | Warning |
| Litter divergence | More than 25% below litter median on day N | Warning |
| Missing entry | No weight logged in 36h | Info |

Severity ordering is `critical > warning > info`. A puppy shows only its highest severity; the litter banner shows a count per severity and links to the worst-affected puppy. Every alert carries a plain-language action line, e.g. *"Check that Blue is latching, and check box temperature. Contact your vet if there is no gain by the next weigh-in."*

`src/logic/triage.ts` is a pure function — litter, puppies, weights and care events in, the complete view out. It has **no side effects and writes nothing back to the database**, so logging one weight updates the matrix, chart, alert banner, timeline and care cards at once, with no refresh step and no possibility of a cached value disagreeing with the rules. It is covered by 91 unit tests, including a suite asserting that a normally growing litter produces **zero** alerts — a false critical at 3am destroys trust in everything else the app says.

```bash
npm test
```

## Voice, via ElevenLabs

Voice is not a bolt-on here. The user is holding a wet puppy in one hand and a kitchen scale in the other, at 3am, in a dim outbuilding. **Typing is the worst possible interface**, so hold-to-talk is the primary input and the keypad is the fallback — not the other way round.

- **Input.** Hold to talk on the weigh flow, `POST /api/stt`, then parse the transcript locally into `{ collar, grams }`. `src/lib/parseSpeech.ts` handles digits, spoken compounds and digit-by-digit readings — `"blue two forty five"`, `"blue two hundred and forty five"`, `"blue 245"` and `"blue two four five"` all resolve to `{ collar: 'blue', grams: 245 }`. The parse is **always** rendered as a confirmation chip with one-tap correction before anything is written; voice you cannot correct is worse than typing.
- **Output.** Spoken readback after each entry — *"Blue, 245 grams, up 18. Good."* On a triage hit the wording escalates: *"Red has lost weight since the last weigh-in. Check warmth and nursing."* The readback is generated from the same triage output that colours the screen, so the spoken line and the visible alert can never disagree.
- **Daily briefing.** One button that speaks the whole litter status, hands free.

<!-- TODO(before submission): record a GIF of speaking "blue, two forty five" and the row updating.
     Save to docs/voice.gif -->
![Speaking "blue, two forty five" and the row updating](docs/voice.gif)

### Backend resolution — three layers, no key entry field

There is **no API key field anywhere in the UI**, and no key ever reaches the browser.

1. **ElevenLabs**, through a Cloudflare Pages Function that holds the key server-side. Anyone opening the live URL gets this with zero configuration.
2. **Web Speech API** (`speechSynthesis` + `webkitSpeechRecognition`) whenever the proxy is absent, out of quota, or failing. A silent downgrade, never an error.
3. **The manual keypad**, always on screen regardless.

Any non-200 from the proxy means *downgrade and continue*. The active backend is shown as a small label in Settings — `Voice: ElevenLabs` / `Voice: browser`.

The proxies (`functions/api/tts.ts`, `functions/api/stt.ts`) enforce an origin allowlist, a per-IP daily counter and a global daily ceiling, and never log the key or echo an upstream error body. The origin check and per-IP counter are speed bumps; the real ceilings are `GLOBAL_DAILY` and a hard monthly credit cap set on the ElevenLabs key itself.

> **Note:** the ElevenLabs speech-to-text model was verified against the live docs during the build — `scribe_v1` is now **deprecated**, so this uses `scribe_v2`. Text-to-speech uses `eleven_flash_v2_5`.

## Provenance, via Solana

Framed as a timestamping notary, not a collectible. **No NFT is minted** — the memo anchor is the whole mechanism.

Buyers are handed printed "health records" that are trivially fabricated, and have no way to check that a puppy's early history is real. Puppergram already holds a timestamped, day-by-day growth record, which is exactly the artifact worth making tamper-evident.

1. At handover the breeder taps **Seal passport**.
2. The app builds a **canonical JSON** passport — keys sorted at every level, no structural whitespace, integers only, timestamps as ISO strings — so the digest is reproducible byte-for-byte on any machine, in any browser, years later.
3. `crypto.subtle.digest` produces a SHA-256 hex digest.
4. One devnet transaction is sent to the **SPL Memo program** (`MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`) with the memo `PGRAM1:<digest>`, signed via the breeder's wallet.
5. The signature is stored locally and rendered as a QR code carrying the passport plus the signature (gzipped and base64url-encoded to fit).
6. The buyer opens `/verify`, scans or pastes, and the app re-hashes and compares.

**Only a hash and a timestamp go on chain.** No personal data, no images.

- Devnet only, public RPC `https://api.devnet.solana.com`, no key required.
- `/verify` is **read-only and needs no wallet** — that is the half a buyer actually uses, and it must work for someone with nothing installed.
- If RPC is unreachable, `/verify` shows the last cached verdict with its timestamp rather than an error. Sealing may fail loudly; verification always renders something.

Editing a sealed passport by **one gram** produces a mismatch on `/verify`. That property is pinned by tests in `src/logic/passport.test.ts`.

**A real sealed transaction you can paste into Solana Explorer (devnet):**
<!-- TODO(before submission): seal one demo puppy from the live site with a devnet wallet,
     then paste the signature here. It must be a real signature — a judge will check it. -->
```
<paste devnet transaction signature here>
```

## Run locally

Runs with **no API keys**. Voice falls back to the browser backend automatically.

```bash
git clone https://github.com/<you>/puppergram.git && cd puppergram
npm install
npm run dev
```

Then open http://localhost:5173 and press **Load demo litter**.

To exercise the Pages Functions (`/api/health`, `/api/tts`, `/api/stt`) locally:

```bash
npm run build && npx wrangler pages dev dist --kv QUOTA
```

With no `ELEVENLABS_API_KEY` set, `/api/health` reports `{"elevenlabs":false}` and the app uses the browser voice backend — exactly the path a fresh clone takes.

## Demo litter

If the database is empty the app offers **Load demo litter**: dam "Nala", Labrador Retriever, whelped six days ago, seven puppies. Six days of realistic weights gaining 6–9% per day — except **Green**, who stalls from day four and loses on day six, tripping *failure to gain*, *weight loss*, *significant loss* and *litter divergence*, and sitting a third below the litter median. A judge opens the app and immediately sees a live critical alert instead of an empty form. **Reset demo** is in Settings.

The demo's alert profile is asserted in `src/db/seed.test.ts`, so it cannot silently drift into being either boring or alarmist.

## Install (PWA)

Offline-first — the whelping box is usually in an outbuilding with no signal, so an app that needs a network is dead weight. The shell is precached and weight entry is fully usable with the network off.

| Platform | Install | Notes |
| --- | --- | --- |
| Android | Chrome install prompt | Best experience |
| Windows | Edge/Chrome → Install app | Runs windowed, Start menu entry |
| iOS | Safari → Share → Add to Home Screen | An install hint card appears in iOS Safari only |

iOS has no programmatic install prompt, and `getUserMedia` needs iOS 16.4+ inside an installed PWA — if the microphone misbehaves the keypad is always there. Wallet interaction inside an iOS PWA is awkward, so **sealing** is desktop/Android-first; **verification** works everywhere. Export passport is prominent because it doubles as your backup against storage eviction.

## Screenshots

<!-- TODO(before submission): capture these three.
     1. Phone weigh flow (375px wide), mid-entry, collar-tinted header
     2. Desktop litter matrix with the green row flagged
     3. The verify page showing a green "Record verified" verdict -->
| Phone weigh flow | Desktop matrix | Verify |
| --- | --- | --- |
| ![Weigh flow](docs/weigh.png) | ![Matrix](docs/matrix.png) | ![Verify](docs/verify.png) |

## Design

The subject's world is a dim outbuilding at 3am, a heat lamp, a kitchen scale, and coloured yarn tied round ten indistinguishable necks — the palette is warm and low-blue because blue light is the wrong choice for a room where someone is trying to stay half-asleep.

**The collar spine** is the signature element: every puppy row and card carries a vertical yarn-coloured spine down its left edge, the growth chart draws each puppy's line in its **literal collar colour**, and the weigh flow tints its header to the current puppy's colour. The result is that the app needs **no chart legend anywhere**, because the user already identifies puppies by exactly this system. Collar colours are the only saturated hues in the interface.

Numerals are IBM Plex Mono with tabular figures throughout, so columns align and deltas scan vertically as instrument output. Motion is limited to the number roll on a new weight and a single pulse when an alert changes severity, and `prefers-reduced-motion` is respected. Alert state is never conveyed by colour alone — always colour plus label plus icon.

## Architecture

```
functions/api/     health, tts, stt — the server-side key never leaves here
src/db/            Dexie schema, domain constants, demo seed
src/logic/         triage (the core), milestones, feeding, passport, readback — all pure
src/hooks/         useLitterView — the single read path
src/components/    screens and widgets
src/lib/           voice, speech parsing, solana, hashing, formatting
```

Only three things are ever stored: litter details, puppy details, and weights. **Birth weight is not a stored field** — it is the earliest weight entry for that puppy, because storing it separately guarantees the two eventually disagree. There are no accounts, no auth, and no server-side database; persistence is per-device IndexedDB.

## Security

- `.gitignore` covered `.env` and `.dev.vars` before the first commit.
- `ELEVENLABS_API_KEY` is set only as an encrypted environment variable in the Cloudflare Pages dashboard, for both Production and Preview. Local development uses `.dev.vars`, which is never committed — see `.dev.vars.example`.
- Restrict the key to Text to Speech → Access, Voices → Read, everything else → No Access. Set a hard monthly credit cap and leave auto-disable-if-leaked enabled.
- If usage looks wrong, rotate the key in the Cloudflare dashboard — one click, no redeploy.

## Deploying

Cloudflare Pages. Build command `npm run build`, output directory `dist`.

```bash
wrangler kv namespace create QUOTA   # paste the id into wrangler.toml and the dashboard
```

Then set `ELEVENLABS_API_KEY` (and optionally `ELEVENLABS_VOICE_ID`) as encrypted environment variables in the Pages dashboard for Production and Preview.

---

**Puppergram is a breeder's record-keeping tool. It is not veterinary advice, and it is not a health certificate.** If something looks wrong, call your vet.
