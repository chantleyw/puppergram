---
title: "Puppergram: gram by gram, day by day"
published: false
tags: devchallenge, weekendchallenge, solana, elevenlabs
cover_image: https://raw.githubusercontent.com/chantleyw/puppergram/master/docs/screenshots/alert.png
---

*This is a submission for [Weekend Challenge: Dog Days Edition](https://dev.to/challenges/weekend-2026-08-13)*

## What I Built

My dog just had ten puppies.

If you have never done this, here is the part nobody warns you about: newborn puppies all look identical, they cannot regulate their own temperature, and the only reliable sign that one is in trouble is that it stops gaining weight. Not crying. Not looking thin. **Weight.** A puppy that fails to gain for 24 hours is in serious trouble a day or more before anything is visible to you.

So you weigh them. Every day, all ten, and you write it in a notebook. And then at 2am on day five you are staring at a page of numbers trying to work out whether green is genuinely falling behind or whether you are just tired.

That is what I built. **Puppergram is not a weight log with a calendar attached — it is an early-warning system.** You record weights; it tells you which puppy needs attention tonight.

![The critical alert firing on a six-day-old litter](https://raw.githubusercontent.com/chantleyw/puppergram/master/docs/screenshots/alert.png)

Seven hard-coded rules run over every weight you have entered:

| Rule | Condition | Severity |
| --- | --- | --- |
| Failure to gain | No weight increase in 24h | Warning |
| Weight loss | Any drop vs. previous entry | Warning |
| Below birth weight | Current < birth weight after 48h | **Critical** |
| Significant loss | More than 10% below peak weight | **Critical** |
| Slow doubling | Under 1.8× birth weight by day 10 | Warning |
| Litter divergence | More than 25% below litter median on day N | Warning |
| Missing entry | No weight logged in 36h | Info |

Nothing is inferred, predicted or modelled. The rule table is printed inside the app as well, because at 3am you are entitled to know exactly what set off the alarm.

Every alert carries an action, never just a label:

> **Green (Gorse) is 11% below its peak weight of 470 g.**
> Contact your vet today. Losses of this size in a neonate escalate quickly. Start supplemental feeding and check box temperature while you wait.

## Demo

**🐕 [puppergram.pages.dev](https://puppergram.pages.dev)** — press **Load demo litter**. You land on a six-day-old litter of seven with one puppy already in trouble, not an empty form.

**🔍 [puppergram.pages.dev/verify](https://puppergram.pages.dev/verify)** — the buyer's half. No wallet, no account, nothing installed.

Works offline once loaded, and installs as a PWA. The whelping box is in an outbuilding with no signal, so an app that needs a network is dead weight.

**On a phone — the 3am screen:**

![The weigh flow: one puppy per screen, giant keypad, hold to talk](https://raw.githubusercontent.com/chantleyw/puppergram/master/docs/screenshots/weigh.png)

**On desktop — the whole litter at once:**

![The litter matrix](https://raw.githubusercontent.com/chantleyw/puppergram/master/docs/screenshots/matrix.png)

Read green's row: `+32 +30 +32 ±0 −2 −48`. That stall is the entire product.

## Code

{% embed https://github.com/chantleyw/puppergram %}

```bash
git clone https://github.com/chantleyw/puppergram.git
cd puppergram && npm install
npm run dev
```

**It runs with no API keys.** Voice degrades to the browser's own recognition, and the keypad is always there.

## How I Built It

React 18 + TypeScript + Vite + Tailwind, Dexie over IndexedDB, Recharts, deployed on Cloudflare Pages with Pages Functions. No accounts, no auth, no server-side database — everything lives on the device.

### Nothing computed is ever stored

The whole app is one pure function:

```ts
buildLitterView(litter, puppies, weights, care, now) → LitterView
```

Weights in, everything out: day columns, daily gains, litter medians, alerts, milestone state, feeding volumes, temperature targets. There is no refresh button and no recalculate step because there is nothing to keep in sync. Log one weight by voice and the matrix, chart, alert banner, timeline and care cards all re-render from the same derivation.

**Birth weight is not a stored field.** It is the earliest weight entry. Store it separately and the two eventually disagree.

`now` is a parameter rather than a `Date.now()` call, which makes every time-window rule deterministic — and testable.

### 118 tests, because a false alarm is worse than no app

A false critical at 3am destroys trust in everything else the app says. So each threshold is tested in both directions — 10% below peak does *not* fire, 10.1% does — and there is a test asserting that a **normally growing litter produces zero alerts.**

Two pieces of deliberate restraint came out of writing those:

- **Below birth weight has a 48-hour grace window.** Healthy newborns dip for the first day or two. Firing on that would train me to ignore the app by day three.
- **Litter divergence needs at least three weighed puppies.** A median of two is just an average, and "below average" is not a finding.

### Two features that came from using it on my own litter

I built this while the litter was already a week old, which surfaced things I would never have designed for:

**Backlogging.** I had a notebook full of weights and had only typed in day 0 and day 9. The realistic case is not "I will enter each weight as I take it." So the weigh flow records against *any* day, with chips showing which days are complete, partial, or empty — the gaps are visible rather than remembered.

**Eighteen collar colours.** I had ten puppies and the app had exactly ten collars. Running out mid-whelp is a real failure, not a theoretical one.

### The collar spine

Collar colour is the app's entire visual language. Every row carries a yarn-coloured spine; the chart draws each puppy's line in its literal collar colour; the weigh flow tints its header to whoever you are holding. **The result is that the chart needs no legend anywhere** — you already identify puppies by exactly this system, from the wool round their necks.

---

## Prize Categories

### 🎙️ Best Use of ElevenLabs

You are holding a wet puppy in one hand and a kitchen scale in the other, in a dim shed, at 3am. **Typing is the worst possible interface.** Saying *"blue, two forty five"* is the best one.

ElevenLabs Scribe (`scribe_v2`) handles transcription through a Cloudflare Pages Function using a server-side key. **There is no key entry field anywhere in the UI.**

**I use ElevenLabs for speech-to-text only, and that is a deliberate split.** Transcription is where accuracy decides whether the feature works at all — mishearing *"two forty five"* as 240 writes a wrong weight into what is effectively a medical record, and that error propagates into every gain, median and alert downstream. That earns a real model. Reading a line back, though, is solved: every browser does it offline, instantly, free. A cloud readback would be silent exactly when the app is needed most. So **ElevenLabs transcribes, and the device speaks.**

Breeders do not talk like a form, so the parser handles what people actually say:

| Spoken | Parsed |
| --- | --- |
| `blue two forty five` | 245 g |
| `blue two hundred and forty five` | 245 g |
| `blue two four five` | 245 g |
| `blue one ten` | 110 g |

The interesting case is the **elided hundred** — *"two forty five"* means 245, so a single digit followed by a tens word becomes hundreds-plus-tens. It also copes with punctuation Scribe adds (`"Blue, two forty-five"` is a real transcript, now a test case), homophones (`gray`/`grey`, `for`/`four`), and refuses anything outside a plausible 50–20000 g range rather than recording it.

**A parse is never committed automatically.** It appears as a confirmation chip with one-tap Save, Correct or Discard. Voice you cannot correct is worse than typing.

Three layers, degrading silently: **ElevenLabs → Web Speech API → the keypad, which is always on screen.** Any non-200 means downgrade and continue. A voice feature that dies at 3am because a quota ran out would be worse than useless.

### ⛓️ Best Use of Solana

The problem: a buyer is handed a printed "health record" that anyone could have typed five minutes ago. There is no way to tell a real growth history from an invented one.

Puppergram already holds a timestamped, day-by-day record — exactly the artifact worth making tamper-evident.

**I use Solana as a timestamping notary. No NFT is minted, and nothing but a hash goes on chain.**

At handover the app builds a canonical passport (sorted keys, no whitespace, integers only, so the digest is reproducible byte-for-byte years later), takes its SHA-256, and writes one SPL Memo to devnet.

**Here is a real sealed puppy — paste it into [Solana Explorer](https://explorer.solana.com/tx/jQbLD3m3zZQCGUtQ8hWfUujyRYqriLKrJcwdUPNuH137QXqZA3Lz7CMzeRs4TYxkzMjBFvC19b6ZMsK3BV5PdwK?cluster=devnet) with the cluster set to devnet:**

```
jQbLD3m3zZQCGUtQ8hWfUujyRYqriLKrJcwdUPNuH137QXqZA3Lz7CMzeRs4TYxkzMjBFvC19b6ZMsK3BV5PdwK
```

The entire on-chain footprint:

```
Program log: Memo (len 71): "PGRAM1:13de6b0ceda53db495804660c51cddbfe47c2c915fa1b609739c0ff1c4ef423b"
```

A prefix and a hash. No name, no dam, no weights, no photo. Total cost: 0.00008 SOL.

**The buyer's half needs nothing.** They scan a QR that carries the whole passport — gzipped into the URL fragment, so it never even reaches my server — and `/verify` re-hashes it locally and compares against the chain. No wallet, no account, no app.

![The verify page](https://raw.githubusercontent.com/chantleyw/puppergram/master/docs/screenshots/verify.png)

Both verdicts are confirmed on real hardware: sealing a puppy, scanning its QR with a phone, and getting **✓ Record verified** — and editing a single gram produces a clear mismatch, with both fingerprints shown side by side.

Being straight about the limits: this proves a record has not been **edited since sealing**. It does not prove the weights were true in the first place. It is tamper-evidence, not truth — and it is on devnet, so it is a demonstration rather than a durable guarantee.

---

**Puppergram is a breeder's record-keeping tool. It is not veterinary advice and not a health certificate.** If something looks wrong, call your vet. I built it because I was doing this arithmetic on paper at 2am with ten puppies and a head torch, and a computer should have been doing it for me.

MIT licensed.
