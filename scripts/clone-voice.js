// One-time setup: clones the ElevenLabs voice used for Galley OS's spoken
// step cues from scripts/voice-sample.mp3, and prints the resulting
// voice_id to set as ELEVENLABS_VOICE_ID.
//
// Run this yourself, once, from a machine with real internet access
// (this only needs to happen a single time per ElevenLabs account —
// re-running it creates a *new* cloned voice each time, so don't add it
// to any automated deploy step):
//
//   ELEVENLABS_API_KEY=sk_... node scripts/clone-voice.js
//
// Then copy the printed voice_id into ELEVENLABS_VOICE_ID — in your local
// .env, and as an environment variable on wherever the server runs
// (Vercel project settings, etc).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error('Set ELEVENLABS_API_KEY in your environment first.');
    process.exit(1);
  }

  const samplePath = path.join(__dirname, 'voice-sample.mp3');
  const fileBuffer = fs.readFileSync(samplePath);

  const form = new FormData();
  form.append('name', 'Galley OS Voice');
  form.append('files', new Blob([fileBuffer], { type: 'audio/mpeg' }), 'voice-sample.mp3');

  const res = await fetch('https://api.elevenlabs.io/v1/voices/add', {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: form,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('ElevenLabs error:', res.status, detail);
    process.exit(1);
  }

  const data = await res.json();
  console.log('Voice cloned successfully.');
  console.log('voice_id:', data.voice_id);
  console.log('\nSet ELEVENLABS_VOICE_ID=' + data.voice_id + ' in .env and on your production host.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
