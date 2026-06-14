// Generates the pre-computed lipsync track for the coordinator onboarding intro
// audio, mirroring the landing-page generator
// (landing-page/scripts/neo-voices/generate-lipsync-tracks.mjs) so the console
// uses the same offline, deterministic mouth animation flow instead of a live
// analyser.
//
// Audio generation for the corresponding MP3 MUST follow the central branding
// pipeline in branding/docs/walkie-voice-pipeline.md: exact transcript,
// ElevenLabs clean speech, walkie EQ/compression/noise, sampled radio
// intro/outro, and carrier/static bed. Do not regenerate this asset from plain
// TTS or ad-hoc replacement copy.
//
// The intro audio is a concatenation of spoken segments and pure radio
// transition effects (radio crackle, tuning whooshes, R2-D2 bleeps, silences).
// A live analyser mistakes those effects for speech and flaps the mouth, so we
// force every non-speech window in the prelude to a motionless (silent) mouth.
// The speech windows below are derived from the exact segment durations used to
// build the prelude (see Desktop/marty-recording-draft/segments).
//
// Usage: node scripts/generate-onboarding-lipsync.mjs <input.wav> <output.json> <publicSrc>

import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const FPS = 60;
const FFT_SIZE = 2048;
const HISTORY_SIZE = 12;

// End of the spoken-Marty prelude (seconds). Everything after this is the
// second onboarding phase, left untouched.
const PRELUDE_END = 20.54;
// Spoken-word windows within the prelude [start, end] (seconds). Any prelude
// time outside these is a transition effect and is masked to a still mouth.
const SPEECH_WINDOWS = [
  [0.55, 3.661],
  [4.551, 7.059],
  [8.716, 10.109],
  [10.999, 15.132],
  [15.702, 16.352],
  [16.772, 17.237],
  [17.657, 18.4],
  [18.82, 19.47],
  [19.69, 20.54],
];

function isSpeechTime(t) {
  if (t > PRELUDE_END) return true; // second phase: keep analyser output as-is
  return SPEECH_WINDOWS.some(([start, end]) => t >= start && t <= end);
}

const BANDS = [
  { start: 50, end: 200 },
  { start: 200, end: 400 },
  { start: 400, end: 800 },
  { start: 800, end: 1500 },
  { start: 1500, end: 2500 },
  { start: 2500, end: 4000 },
  { start: 4000, end: 8000 },
];

const VISEMES = {
  sil: 'viseme_sil',
  PP: 'viseme_PP',
  FF: 'viseme_FF',
  TH: 'viseme_TH',
  DD: 'viseme_DD',
  kk: 'viseme_kk',
  CH: 'viseme_CH',
  SS: 'viseme_SS',
  nn: 'viseme_nn',
  RR: 'viseme_RR',
  aa: 'viseme_aa',
  E: 'viseme_E',
  I: 'viseme_I',
  O: 'viseme_O',
  U: 'viseme_U',
};

const VISEME_CATEGORY = {
  [VISEMES.sil]: 'silence',
  [VISEMES.PP]: 'plosive',
  [VISEMES.FF]: 'fricative',
  [VISEMES.TH]: 'fricative',
  [VISEMES.DD]: 'plosive',
  [VISEMES.kk]: 'plosive',
  [VISEMES.CH]: 'fricative',
  [VISEMES.SS]: 'fricative',
  [VISEMES.nn]: 'plosive',
  [VISEMES.RR]: 'fricative',
  [VISEMES.aa]: 'vowel',
  [VISEMES.E]: 'vowel',
  [VISEMES.I]: 'vowel',
  [VISEMES.O]: 'vowel',
  [VISEMES.U]: 'vowel',
};

function avg(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function parseWav(buffer) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const str = (offset, len) => buffer.toString('ascii', offset, offset + len);
  if (str(0, 4) !== 'RIFF' || str(8, 4) !== 'WAVE') {
    throw new Error('not a RIFF/WAVE file');
  }

  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let audioFormat = 0;
  let dataOffset = -1;
  let dataSize = 0;

  for (let offset = 12; offset + 8 <= buffer.length; ) {
    const id = str(offset, 4);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === 'fmt ') {
      audioFormat = view.getUint16(body, true);
      channels = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
      bitsPerSample = view.getUint16(body + 14, true);
    } else if (id === 'data') {
      dataOffset = body;
      dataSize = size;
    }
    offset = body + size + (size % 2);
  }

  if (audioFormat !== 1 || bitsPerSample !== 16 || dataOffset < 0) {
    throw new Error(`unsupported WAV format: format=${audioFormat}, bits=${bitsPerSample}`);
  }

  const frames = dataSize / (channels * 2);
  const samples = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let ch = 0; ch < channels; ch++) {
      sum += view.getInt16(dataOffset + (i * channels + ch) * 2, true) / 32768;
    }
    samples[i] = sum / channels;
  }

  return { samples, sampleRate, duration: samples.length / sampleRate };
}

function fft(real, imag) {
  const n = real.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wLenR = Math.cos(ang);
    const wLenI = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wr = 1;
      let wi = 0;
      for (let j = 0; j < len / 2; j++) {
        const uR = real[i + j];
        const uI = imag[i + j];
        const vR = real[i + j + len / 2] * wr - imag[i + j + len / 2] * wi;
        const vI = real[i + j + len / 2] * wi + imag[i + j + len / 2] * wr;
        real[i + j] = uR + vR;
        imag[i + j] = uI + vI;
        real[i + j + len / 2] = uR - vR;
        imag[i + j + len / 2] = uI - vI;
        const nextWr = wr * wLenR - wi * wLenI;
        wi = wr * wLenI + wi * wLenR;
        wr = nextWr;
      }
    }
  }
}

function bandFeatures(samples, sampleRate, centerSample) {
  const real = new Float64Array(FFT_SIZE);
  const imag = new Float64Array(FFT_SIZE);
  const start = centerSample - FFT_SIZE / 2;
  for (let i = 0; i < FFT_SIZE; i++) {
    const sample = samples[start + i] ?? 0;
    real[i] = sample * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)));
  }
  fft(real, imag);

  const binWidth = sampleRate / FFT_SIZE;
  const mags = new Float64Array(FFT_SIZE / 2);
  for (let i = 0; i < mags.length; i++) {
    mags[i] = Math.hypot(real[i], imag[i]) / (FFT_SIZE / 2);
  }

  return BANDS.map(({ start: lo, end }) => {
    const a = Math.round(lo / binWidth);
    const b = Math.min(Math.round(end / binWidth), mags.length - 1);
    let sum = 0;
    let count = 0;
    for (let i = a; i < b; i++) {
      sum += mags[i];
      count++;
    }
    return count ? sum / count : 0;
  });
}

function averaged(history) {
  const out = {
    volume: 0,
    centroid: 0,
    bands: Array(BANDS.length).fill(0),
    deltaBands: Array(BANDS.length).fill(0),
  };
  if (history.length === 0) return out;
  for (const item of history) {
    out.volume += item.volume;
    out.centroid += item.centroid;
    item.bands.forEach((value, idx) => {
      out.bands[idx] += value;
    });
  }
  out.volume /= history.length;
  out.centroid /= history.length;
  out.bands = out.bands.map((value) => value / history.length);
  out.deltaBands = out.bands;
  return out;
}

function computeScores(current, average, dVolume, dCentroid) {
  const scores = Object.fromEntries(Object.values(VISEMES).map((viseme) => [viseme, 0]));
  const [, , band3, , , , band7] = current.bands;
  void band3;

  if (average.volume < 0.2 && current.volume < 0.2) scores[VISEMES.sil] = 1;
  for (const [viseme, category] of Object.entries(VISEME_CATEGORY)) {
    if (category === 'plosive') {
      if (dVolume < 0.01) scores[viseme] -= 0.5;
      if (average.volume < 0.2) scores[viseme] += 0.2;
      if (dCentroid > 1000) scores[viseme] += 0.2;
    }
  }

  if (current.centroid > 1000 && current.centroid < 8000) {
    if (current.centroid > 7000) scores[VISEMES.DD] += 0.6;
    else if (current.centroid > 5000) scores[VISEMES.kk] += 0.6;
    else if (current.centroid > 4000) {
      scores[VISEMES.PP] += 1;
      if (band7 > 0.25 && current.centroid < 6000) scores[VISEMES.DD] += 1.4;
    } else {
      scores[VISEMES.nn] += 0.6;
    }
  }

  if (
    dCentroid > 1000 &&
    current.centroid > 6000 &&
    average.centroid > 5000 &&
    current.bands[6] > 0.4 &&
    average.bands[6] > 0.3
  ) {
    scores[VISEMES.FF] = 0.7;
  }

  if (average.volume > 0.1 && average.centroid < 6000 && current.centroid < 6000) {
    const [band1, band2Avg, band3Avg, band4Avg, band5Avg] = average.bands;
    const band12Diff = Math.abs(band1 - band2Avg);
    const spread = Math.max(
      Math.abs(band2Avg - band3Avg),
      Math.abs(band2Avg - band4Avg),
      Math.abs(band3Avg - band4Avg)
    );
    if (band3Avg > 0.1 || band4Avg > 0.1) {
      if (band4Avg > band3Avg) {
        scores[VISEMES.aa] = 0.8;
        if (band3Avg > band2Avg) scores[VISEMES.aa] += 0.2;
      }
      if (band3Avg > band2Avg && band3Avg > band4Avg) scores[VISEMES.I] = 0.7;
      if (band12Diff < 0.25) scores[VISEMES.U] = 0.7;
      if (spread < 0.25) scores[VISEMES.O] = 0.9;
      if (band2Avg > band3Avg && band3Avg > band4Avg) scores[VISEMES.E] = 1;
      if (band3Avg < 0.2 && band4Avg > 0.3) scores[VISEMES.I] = 0.7;
      if (band3Avg > 0.25 && band5Avg > 0.25) scores[VISEMES.O] = 0.7;
      if (band3Avg < 0.15 && band5Avg < 0.15) scores[VISEMES.U] = 0.7;
    }
  }

  return scores;
}

function adjustScores(scores, currentViseme, visemeStartMs, timestampMs) {
  const out = { ...scores };
  if (currentViseme) {
    const elapsed = timestampMs - visemeStartMs;
    for (const viseme of Object.keys(out)) {
      if (viseme !== currentViseme) continue;
      let multiplier;
      if (elapsed <= 100) multiplier = 1.3;
      else {
        const extra = elapsed - 100;
        multiplier = Math.max(0.5, 1 - extra / 1000);
      }
      out[viseme] *= multiplier;
    }
  }
  return out;
}

function getDroidSpeechLevel(volume) {
  return clamp01(Math.sqrt(Math.max(0, volume - 0.045)) * 1.05);
}

async function generateTrack(filePath, src) {
  const buffer = await readFile(filePath);
  const { samples, sampleRate, duration } = parseWav(buffer);
  const frameCount = Math.ceil(duration * FPS) + 1;
  const rawBands = [];

  for (let i = 0; i < frameCount; i++) {
    rawBands.push(bandFeatures(samples, sampleRate, Math.round((i / FPS) * sampleRate)));
  }

  const allBandValues = rawBands.flat().sort((a, b) => a - b);
  const p95 = allBandValues[Math.floor(allBandValues.length * 0.95)] || 1;
  const scale = p95 > 0 ? 0.55 / p95 : 1;
  const history = [];
  let currentViseme = VISEMES.sil;
  let visemeStartMs = 0;
  let smoothedSpeechLevel = 0;
  const frames = [];

  for (let i = 0; i < frameCount; i++) {
    const bands = rawBands[i].map((value) => clamp01(value * scale));
    const previous = history[history.length - 2];
    const deltaBands = bands.map((value, idx) => (previous ? value - previous.bands[idx] : 0));
    let centroidNumerator = 0;
    let centroidDenominator = 0;
    BANDS.forEach(({ start, end }, idx) => {
      const mid = (start + end) / 2;
      centroidNumerator += mid * bands[idx];
      centroidDenominator += bands[idx];
    });
    const feature = {
      bands,
      deltaBands,
      volume: avg(bands),
      centroid: centroidDenominator > 0 ? centroidNumerator / centroidDenominator : 0,
    };
    history.push(feature);
    if (history.length > HISTORY_SIZE) history.shift();

    const average = averaged(history);
    const scores = adjustScores(
      computeScores(
        feature,
        average,
        feature.volume - average.volume,
        feature.centroid - average.centroid
      ),
      currentViseme,
      visemeStartMs,
      (i / FPS) * 1000
    );
    let bestScore = -Infinity;
    let bestViseme = VISEMES.sil;
    for (const [viseme, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestViseme = viseme;
      }
    }
    if (bestViseme !== currentViseme) {
      currentViseme = bestViseme;
      visemeStartMs = (i / FPS) * 1000;
    }

    const speechLevel = getDroidSpeechLevel(feature.volume);
    smoothedSpeechLevel = smoothedSpeechLevel * 0.72 + speechLevel * 0.28;
    const isActive = speechLevel > 0.08 || bestViseme !== VISEMES.sil || smoothedSpeechLevel > 0.08;
    frames.push([bestViseme, Number(smoothedSpeechLevel.toFixed(3)), isActive ? 1 : 0]);
  }

  // Mask every non-speech moment in the prelude so radio crackle, tuning
  // whooshes, and bleeps never animate the mouth.
  let maskedFrames = 0;
  for (let i = 0; i < frames.length; i++) {
    if (!isSpeechTime(i / FPS)) {
      frames[i] = [VISEMES.sil, 0, 0];
      maskedFrames += 1;
    }
  }

  return {
    track: {
      src,
      audioSha256: createHash('sha256').update(buffer).digest('hex'),
      fps: FPS,
      duration: Number(duration.toFixed(3)),
      frames,
    },
    maskedFrames,
  };
}

async function main() {
  const [, , inputWav, outputJson, publicSrc] = process.argv;
  if (!inputWav || !outputJson || !publicSrc) {
    throw new Error(
      'Usage: node scripts/generate-onboarding-lipsync.mjs <input.wav> <output.json> <publicSrc>'
    );
  }

  const { track, maskedFrames } = await generateTrack(inputWav, publicSrc);
  await mkdir(path.dirname(outputJson), { recursive: true });
  await writeFile(outputJson, JSON.stringify(track));
  console.log(
    `wrote ${outputJson} (${track.frames.length} frames, ${maskedFrames} masked, duration ${track.duration}s)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
