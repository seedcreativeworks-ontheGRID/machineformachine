// One-time (re-run only when the seed dishes/steps below change) setup:
// bakes every phrase the LIVE TASKS voice cues can say into a static mp3
// per phrase, in the cloned voice from scripts/clone-voice.js. The app
// then stitches these together client-side at playback time — no live
// TTS call, no network dependency, no per-cue cost at runtime.
//
// Run this yourself, once, from a machine with real internet access
// (same restriction as clone-voice.js — this sandbox can't reach
// api.elevenlabs.io):
//
//   ELEVENLABS_API_KEY=sk_... ELEVENLABS_VOICE_ID=... node scripts/generate-cue-clips.js
//
// Safe to re-run: it skips any clip whose file already exists, so it only
// pays for what's new or changed.
//
// IMPORTANT: the dish/step list below must stay in sync with the seed
// `dishes` array in public/app.js — the client builds clip ids from
// whatever dish name / step text a user actually has loaded, so a custom
// (user-added) dish or an edited seed dish has no matching clip and is
// silently skipped in the audio (see slugify()/cueIdsFor* in app.js).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'public', 'audio', 'cues');

// Must match public/app.js's seed `dishes` array exactly (name + step text).
const SEED_DISHES = [
  { name: "Fire-Grilled Chicken Skewers", steps: [
    "Skewer chicken chunks tightly, season with salt & any herbs or citrus",
    "Grill over hot coals, turning every 3-4 min",
    "Move to cooler embers, finish through until juices run clear",
  ]},
  { name: "Charred Island Vegetables", steps: [
    "Cut vegetables into large, even pieces",
    "Toss with oil and salt",
    "Char on grill or hot stone, turning occasionally until edges blacken",
  ]},
  { name: "Seared Catch of the Day", steps: [
    "Pat fish dry, season with salt",
    "Sear skin-side down over the hottest part of the fire",
    "Flip and finish searing until it flakes easily",
    "Rest briefly, finish with citrus or greens if available",
  ]},
];

// Must match slugify() in public/app.js.
function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function buildPhrases() {
  const phrases = [
    { id: 'five-minutes-to-serve', text: 'Five minutes to serve.' },
    { id: 'one-minute-to-serve', text: 'One minute to serve.' },
    { id: 'ignites-in', text: 'ignites in' },
    { id: 'is-ready', text: 'is ready.' },
    { id: 'left', text: 'left.' },
    { id: 'minute', text: 'minute' },
    { id: 'minutes', text: 'minutes' },
    { id: 'second', text: 'second' },
    { id: 'seconds', text: 'seconds' },
    { id: 'sequence-engaged', text: 'Sequence engaged. Audio feedback online.' },
  ];
  for (let n = 0; n <= 99; n++) {
    phrases.push({ id: 'num-' + n, text: String(n) });
  }
  SEED_DISHES.forEach((d) => {
    phrases.push({ id: 'dish-' + slugify(d.name), text: d.name + '.' });
    d.steps.forEach((stepText, i) => {
      phrases.push({ id: `step-${slugify(d.name)}-${i}`, text: stepText + '.' });
    });
  });
  return phrases;
}

async function synthesize(apiKey, voiceId, text) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'audio/mpeg',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2_5',
      voice_settings: { stability: 0.5, similarity_boost: 0.85 },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`ElevenLabs error ${res.status}: ${detail}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) {
    console.error('Set both ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID (from clone-voice.js) first.');
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });
  const phrases = buildPhrases();
  let generated = 0, skipped = 0, failed = 0;

  for (const { id, text } of phrases) {
    const filePath = path.join(outDir, `${id}.mp3`);
    if (fs.existsSync(filePath)) { skipped++; continue; }
    try {
      const audio = await synthesize(apiKey, voiceId, text);
      fs.writeFileSync(filePath, audio);
      generated++;
      console.log(`OK   ${id}`);
    } catch (err) {
      failed++;
      console.error(`FAIL ${id}: ${err.message}`);
    }
  }

  console.log(`\nDone. Generated ${generated}, skipped ${skipped} (already existed), failed ${failed}.`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
