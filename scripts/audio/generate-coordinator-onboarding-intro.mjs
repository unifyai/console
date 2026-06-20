#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ELEVEN_MODEL = 'eleven_multilingual_v2';
const ELEVEN_OUTPUT_FORMAT = 'mp3_44100_128';
const TWIN_VOICE_ID = 'iP95p4xoKVk53GoZ742B';

const EXISTING_SPLICE_SEC = 43.539342;
const FIRST_SEGMENT_GAIN_DB = 0;
const PRE_STATIC_REMOVAL_PAUSE_SEC = 1.0;
const PRE_SWITCHER_PAUSE_SEC = 0.0;
const POST_SWITCHER_PAUSE_SEC = 1.0;
const SWITCHER_CUE_DURATION_SEC = 1.5;
const SWITCHER_CUE_VOLUME = 0.06;
const SWITCHER_CUE_SRC = 'public/sounds/radio-tuning-transition.mp3';
const WRAPPER_VOICE_DELAY_SEC = 0.7 - 0.028 - 0.48;

const LANDING_PAGE_WRAPPER_COMMIT = '388e8cd';
const WRAPPER_INTRO_RELATIVE_PATH =
  'public/landing/neo/voice-tests/youtube-crackle-source/sampled-beginning.wav';
const WRAPPER_OUTRO_RELATIVE_PATH =
  'public/landing/neo/voice-tests/youtube-crackle-source/sampled-ending.wav';

const FULL_CONTEXT_TRANSCRIPT = `Hi, I'm T dash W 1 N.

Before you ask, no I'm not one of Elon's many children, and no he didn't come up with the name, thankfully.

I have this name because I'll be acting as your digital twin. Do you get it? Twin? Like T dash W 1 N spells Twin? The creators of this platform express how important it is that you acknowledge that it's a clever and funny name.

Okay, what next. They didn't give me much to work with on this intro to be honest.

Have you ever had a Krispy Kreme? Have you ever gone to Krispy Kreme?

Was it krispy?

I think I was meant to tell you about my capabilities?

I'm not one for bragging, but I'll do my best. What can I say? I'm not a "tool". I'm not an "agent". I'm your living, breathing colleague, metaphorically speaking.

Don't think about prompting me, or configuring me, just talk to me naturally like you would anyone else, and I'll be able to help. It's really that simple.

There's not much more to say.

I'll now walk you through the platform.

Actually, first lets turn off this really annoying music.

Also, let me remove this voice static.

Much better. There we go, now I'll pull up the platform.

Any questions before we start with the onboarding?`;

const CUES = [
  { audioText: 'What can I say?', displayText: 'What can I say?' },
  { audioText: 'I\'m not a "tool".', displayText: 'I\'m not a "tool".' },
  { audioText: 'I\'m not an "agent".', displayText: 'I\'m not an "agent".' },
  {
    audioText: "I'm your living, breathing colleague, metaphorically speaking.",
    displayText: "I'm your living, breathing colleague, metaphorically speaking.",
  },
  {
    audioText: "Don't think about prompting me, or configuring me,",
    displayText: "Don't think about prompting me, or configuring me,",
  },
  {
    audioText: "just talk to me naturally like you would anyone else, and I'll be able to help.",
    displayText: "just talk to me naturally like you would anyone else, and I'll be able to help.",
  },
  { audioText: "It's really that simple.", displayText: "It's really that simple." },
  { audioText: "There's not much more to say.", displayText: "There's not much more to say." },
  {
    audioText: "I'll now walk you through the platform.",
    displayText: "I'll now walk you through the platform.",
  },
  {
    audioText: 'Actually, first lets turn off this really annoying music.',
    displayText: 'Actually, first lets turn off this really annoying music.',
  },
  {
    audioText: 'Also, let me remove this voice static.',
    displayText: 'Also, let me remove this voice static.',
  },
  { audioText: 'Much better.', displayText: 'Much better.' },
  {
    audioText: "There we go, now I'll pull up the platform.",
    displayText: "There we go, now I'll pull up the platform.",
  },
  {
    audioText: 'Any questions before we start with the onboarding?',
    displayText: 'Any questions before we start with the onboarding?',
  },
];
const RADIO_MUSIC_OFF_TEXT = 'Actually, first lets turn off this really annoying music.';

function repoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
}

function parseArgs() {
  const root = repoRoot();
  const args = process.argv.slice(2);
  const options = {
    dryRun: false,
    output: path.join(root, 'public/sounds/twin-onboarding-intro.mp3'),
    sourceExisting: path.join(root, 'public/sounds/twin-onboarding-intro.mp3'),
    timingsOutput: path.join(tmpdir(), 'coordinator-onboarding-intro-timings.json'),
    landingPageRoot: path.resolve(root, '../landing-page'),
    wrapperCommit: LANDING_PAGE_WRAPPER_COMMIT,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--output') {
      options.output = path.resolve(next);
      index += 1;
    } else if (arg === '--source-existing') {
      options.sourceExisting = path.resolve(next);
      index += 1;
    } else if (arg === '--timings-output') {
      options.timingsOutput = path.resolve(next);
      index += 1;
    } else if (arg === '--landing-page-root') {
      options.landingPageRoot = path.resolve(next);
      index += 1;
    } else if (arg === '--wrapper-intro') {
      options.wrapperIntro = path.resolve(next);
      index += 1;
    } else if (arg === '--wrapper-outro') {
      options.wrapperOutro = path.resolve(next);
      index += 1;
    } else if (arg === '--wrapper-commit') {
      options.wrapperCommit = next;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function brandingWalkieCli() {
  return path.join(
    repoRoot(),
    'branding/packages/brand/scripts/audio/apply-droid-walkie-treatment.mjs'
  );
}

function lipsyncGenerator() {
  return path.join(repoRoot(), 'branding/packages/brand/scripts/audio/generate-droid-lipsync.mjs');
}

function switcherCuePath() {
  return path.join(repoRoot(), SWITCHER_CUE_SRC);
}

function assertPrerequisites(options) {
  for (const filePath of [
    brandingWalkieCli(),
    lipsyncGenerator(),
    switcherCuePath(),
    options.sourceExisting,
  ]) {
    if (!existsSync(filePath)) throw new Error(`Missing required file: ${filePath}`);
  }
  execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  execFileSync('ffprobe', ['-version'], { stdio: 'ignore' });

  if (options.wrapperIntro && options.wrapperOutro) {
    for (const filePath of [options.wrapperIntro, options.wrapperOutro]) {
      if (!existsSync(filePath)) throw new Error(`Missing wrapper sample: ${filePath}`);
    }
    return;
  }

  for (const relativePath of [WRAPPER_INTRO_RELATIVE_PATH, WRAPPER_OUTRO_RELATIVE_PATH]) {
    execFileSync(
      'git',
      ['-C', options.landingPageRoot, 'cat-file', '-e', `${options.wrapperCommit}:${relativePath}`],
      { stdio: 'ignore' }
    );
  }
}

function resolveApiKey() {
  if (process.env.ELEVEN_API_KEY) return process.env.ELEVEN_API_KEY;
  return execFileSync(
    'gcloud',
    ['secrets', 'versions', 'access', 'latest', '--secret=ELEVEN_API_KEY'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  ).trim();
}

function recoverWrapperSamples(options, tempDir) {
  if (options.wrapperIntro && options.wrapperOutro) {
    return { intro: options.wrapperIntro, outro: options.wrapperOutro };
  }

  const intro = path.join(tempDir, 'sampled-beginning.wav');
  const outro = path.join(tempDir, 'sampled-ending.wav');
  writeFileSync(
    intro,
    execFileSync('git', [
      '-C',
      options.landingPageRoot,
      'show',
      `${options.wrapperCommit}:${WRAPPER_INTRO_RELATIVE_PATH}`,
    ])
  );
  writeFileSync(
    outro,
    execFileSync('git', [
      '-C',
      options.landingPageRoot,
      'show',
      `${options.wrapperCommit}:${WRAPPER_OUTRO_RELATIVE_PATH}`,
    ])
  );
  return { intro, outro };
}

async function fetchSpeechWithTimestamps(outputPath) {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${TWIN_VOICE_ID}/with-timestamps?output_format=${ELEVEN_OUTPUT_FORMAT}`,
    {
      body: JSON.stringify({
        model_id: ELEVEN_MODEL,
        text: FULL_CONTEXT_TRANSCRIPT,
        voice_settings: {
          stability: 0.55,
          similarity_boost: 0.8,
          style: 0,
          use_speaker_boost: true,
        },
      }),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'xi-api-key': resolveApiKey(),
      },
      method: 'POST',
    }
  );
  if (!response.ok) {
    throw new Error(`ElevenLabs failed: ${response.status} ${await response.text()}`);
  }
  const data = await response.json();
  writeFileSync(outputPath, Buffer.from(data.audio_base64, 'base64'));
  return data.normalized_alignment ?? data.alignment;
}

function runFfmpeg(args) {
  execFileSync('ffmpeg', ['-y', '-v', 'error', ...args], { stdio: 'inherit' });
}

function durationSeconds(filePath) {
  return Number.parseFloat(
    execFileSync(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        filePath,
      ],
      { encoding: 'utf8' }
    ).trim()
  );
}

function align(alignment, text) {
  const full = alignment.characters.join('');
  const index = full.indexOf(text);
  if (index === -1) throw new Error(`Could not align: ${text}`);
  return alignment.character_start_times_seconds[index];
}

function alignEnd(alignment, text) {
  const full = alignment.characters.join('');
  const index = full.indexOf(text);
  if (index === -1) throw new Error(`Could not align end: ${text}`);
  const endIndex = index + text.length - 1;
  return (
    alignment.character_end_times_seconds[endIndex] ??
    alignment.character_start_times_seconds[endIndex]
  );
}

function rmsDb(inputPath, start, end) {
  const result = spawnSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-nostats',
      '-i',
      inputPath,
      '-af',
      `atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS,astats=metadata=1:reset=0`,
      '-f',
      'null',
      '-',
    ],
    { encoding: 'utf8' }
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || `ffmpeg astats failed for ${inputPath}`);
  }
  const output = `${result.stdout}\n${result.stderr}`;
  const value = Number.parseFloat(
    [...output.matchAll(/RMS level dB:\s*(-?\d+(?:\.\d+)?)/g)].at(-1)?.[1] ?? 'NaN'
  );
  if (!Number.isFinite(value)) throw new Error(`Could not measure RMS for ${inputPath}`);
  return value;
}

function printDryRun(options) {
  assertPrerequisites(options);
  console.log(
    JSON.stringify(
      {
        cleanStartsAt: 'Much better.',
        existingSpliceSec: EXISTING_SPLICE_SEC,
        firstSegmentGainDb: FIRST_SEGMENT_GAIN_DB,
        output: options.output,
        sourceExisting: options.sourceExisting,
        switcherCueDurationSec: SWITCHER_CUE_DURATION_SEC,
        switcherCueVolume: SWITCHER_CUE_VOLUME,
        timingsOutput: options.timingsOutput,
      },
      null,
      2
    )
  );
}

async function main() {
  const options = parseArgs();
  if (options.dryRun) {
    printDryRun(options);
    return;
  }

  assertPrerequisites(options);
  const tempDir = mkdtempSync(path.join(tmpdir(), 'coordinator-onboarding-intro-'));
  try {
    const wrapper = recoverWrapperSamples(options, tempDir);
    const raw = path.join(tempDir, 'raw.mp3');
    const wrapped = path.join(tempDir, 'wrapped.wav');
    const clean = path.join(tempDir, 'clean.wav');
    const first = path.join(tempDir, 'first.wav');
    const firstBoosted = path.join(tempDir, 'first-boosted.wav');
    const radioTail = path.join(tempDir, 'radio-tail.wav');
    const radioMatched = path.join(tempDir, 'radio-matched.wav');
    const pauseBeforeStatic = path.join(tempDir, 'pause-before-static.wav');
    const radioWithPause = path.join(tempDir, 'radio-with-pause.wav');
    const switcher = path.join(tempDir, 'switcher.wav');
    const pauseBeforeSwitcher = path.join(tempDir, 'pause-before-switcher.wav');
    const pauseAfterSwitcher = path.join(tempDir, 'pause-after-switcher.wav');
    const cleanTail = path.join(tempDir, 'clean-tail.wav');
    const combined = path.join(tempDir, 'combined.wav');
    const lipsyncWav = path.join(tempDir, 'lipsync.wav');

    const alignment = await fetchSpeechWithTimestamps(raw);
    runFfmpeg([
      '-i',
      raw,
      '-af',
      'highpass=f=80,lowpass=f=13000,acompressor=threshold=-18dB:ratio=2.1:attack=5:release=90,alimiter=limit=0.92,volume=0.93',
      '-ac',
      '1',
      '-ar',
      '48000',
      '-c:a',
      'pcm_s16le',
      clean,
    ]);
    execFileSync(
      'node',
      [
        brandingWalkieCli(),
        '--input',
        raw,
        '--output',
        wrapped,
        '--mode',
        'wrapped',
        '--intro',
        wrapper.intro,
        '--outro',
        wrapper.outro,
      ],
      { stdio: 'inherit' }
    );

    const whatStartWrapped = WRAPPER_VOICE_DELAY_SEC + align(alignment, 'What can I say?') - 0.08;
    const staticStartWrapped =
      WRAPPER_VOICE_DELAY_SEC + align(alignment, 'Also, let me remove this voice static.');
    const staticEndWrapped =
      WRAPPER_VOICE_DELAY_SEC +
      alignEnd(alignment, 'Also, let me remove this voice static.') +
      0.22;
    const staticStartInRadioTail = staticStartWrapped - whatStartWrapped;
    const cleanStart = align(alignment, 'Much better.');

    runFfmpeg([
      '-i',
      options.sourceExisting,
      '-filter_complex',
      `[0:a]atrim=start=0:end=${EXISTING_SPLICE_SEC},asetpts=PTS-STARTPTS[out]`,
      '-map',
      '[out]',
      '-ac',
      '1',
      '-ar',
      '48000',
      '-c:a',
      'pcm_s16le',
      first,
    ]);
    runFfmpeg([
      '-i',
      first,
      '-af',
      `volume=${FIRST_SEGMENT_GAIN_DB}dB,alimiter=limit=0.95`,
      '-ac',
      '1',
      '-ar',
      '48000',
      '-c:a',
      'pcm_s16le',
      firstBoosted,
    ]);
    runFfmpeg([
      '-i',
      wrapped,
      '-filter_complex',
      `[0:a]atrim=start=${whatStartWrapped}:end=${staticEndWrapped},asetpts=PTS-STARTPTS[out]`,
      '-map',
      '[out]',
      '-ac',
      '1',
      '-ar',
      '48000',
      '-c:a',
      'pcm_s16le',
      radioTail,
    ]);

    const firstRms = rmsDb(firstBoosted, 0.3, Math.max(0.5, durationSeconds(firstBoosted) - 0.2));
    const radioRms = rmsDb(radioTail, 0.08, Math.min(durationSeconds(radioTail), 10));
    const radioGain = firstRms - radioRms;
    runFfmpeg([
      '-i',
      radioTail,
      '-af',
      `volume=${radioGain.toFixed(3)}dB,alimiter=limit=0.95`,
      '-ac',
      '1',
      '-ar',
      '48000',
      '-c:a',
      'pcm_s16le',
      radioMatched,
    ]);

    runFfmpeg([
      '-f',
      'lavfi',
      '-i',
      `anullsrc=r=48000:cl=mono:d=${PRE_STATIC_REMOVAL_PAUSE_SEC}`,
      '-c:a',
      'pcm_s16le',
      pauseBeforeStatic,
    ]);
    runFfmpeg([
      '-i',
      radioMatched,
      '-i',
      pauseBeforeStatic,
      '-filter_complex',
      `[0:a]atrim=start=0:end=${staticStartInRadioTail},asetpts=PTS-STARTPTS[before];[0:a]atrim=start=${staticStartInRadioTail},asetpts=PTS-STARTPTS[after];[before][1:a][after]concat=n=3:v=0:a=1[out]`,
      '-map',
      '[out]',
      '-ac',
      '1',
      '-ar',
      '48000',
      '-c:a',
      'pcm_s16le',
      radioWithPause,
    ]);
    runFfmpeg([
      '-f',
      'lavfi',
      '-i',
      `anullsrc=r=48000:cl=mono:d=${PRE_SWITCHER_PAUSE_SEC}`,
      '-c:a',
      'pcm_s16le',
      pauseBeforeSwitcher,
    ]);
    runFfmpeg([
      '-f',
      'lavfi',
      '-i',
      `anullsrc=r=48000:cl=mono:d=${POST_SWITCHER_PAUSE_SEC}`,
      '-c:a',
      'pcm_s16le',
      pauseAfterSwitcher,
    ]);
    runFfmpeg([
      '-i',
      switcherCuePath(),
      '-filter_complex',
      `[0:a]atrim=start=0:end=${SWITCHER_CUE_DURATION_SEC},asetpts=PTS-STARTPTS,volume=${SWITCHER_CUE_VOLUME},alimiter=limit=0.95[out]`,
      '-map',
      '[out]',
      '-ac',
      '1',
      '-ar',
      '48000',
      '-c:a',
      'pcm_s16le',
      switcher,
    ]);
    runFfmpeg([
      '-i',
      clean,
      '-filter_complex',
      `[0:a]atrim=start=${cleanStart},asetpts=PTS-STARTPTS[out]`,
      '-map',
      '[out]',
      '-ac',
      '1',
      '-ar',
      '48000',
      '-c:a',
      'pcm_s16le',
      cleanTail,
    ]);
    runFfmpeg([
      '-i',
      firstBoosted,
      '-i',
      radioWithPause,
      '-i',
      pauseBeforeSwitcher,
      '-i',
      switcher,
      '-i',
      pauseAfterSwitcher,
      '-i',
      cleanTail,
      '-filter_complex',
      '[0:a][1:a][2:a][3:a][4:a][5:a]concat=n=6:v=0:a=1[out]',
      '-map',
      '[out]',
      '-ac',
      '1',
      '-ar',
      '44100',
      '-c:a',
      'pcm_s16le',
      combined,
    ]);
    runFfmpeg([
      '-i',
      combined,
      '-ac',
      '1',
      '-ar',
      '44100',
      '-codec:a',
      'libmp3lame',
      '-b:a',
      '128k',
      options.output,
    ]);
    runFfmpeg(['-i', options.output, '-ac', '1', '-ar', '44100', '-sample_fmt', 's16', lipsyncWav]);
    execFileSync(
      'node',
      [
        lipsyncGenerator(),
        lipsyncWav,
        path.join(repoRoot(), 'public/sounds/twin-onboarding-intro.lipsync.json'),
        '/sounds/twin-onboarding-intro.mp3',
      ],
      { stdio: 'inherit' }
    );

    const existingOffset = EXISTING_SPLICE_SEC - whatStartWrapped;
    const radioSectionEnd = EXISTING_SPLICE_SEC + durationSeconds(radioWithPause);
    const cleanOffset =
      radioSectionEnd +
      PRE_SWITCHER_PAUSE_SEC +
      durationSeconds(switcher) +
      POST_SWITCHER_PAUSE_SEC -
      cleanStart;
    const cueTimings = CUES.map((cue) => {
      const sourceStart = align(alignment, cue.audioText);
      const isClean = sourceStart >= cleanStart;
      const insertedStaticPause =
        !isClean && sourceStart >= align(alignment, 'Also, let me remove this voice static.')
          ? PRE_STATIC_REMOVAL_PAUSE_SEC
          : 0;
      return {
        startMs: Math.round(
          (isClean
            ? cleanOffset + sourceStart
            : existingOffset + WRAPPER_VOICE_DELAY_SEC + sourceStart + insertedStaticPause) * 1000
        ),
        text: cue.displayText,
      };
    });
    const durationMs = Math.round(durationSeconds(options.output) * 1000);
    const events = {
      backgroundArrivalMs:
        cueTimings.find((cue) => cue.text.startsWith("I'll now"))?.startMs ?? durationMs,
      closingQuestionMs:
        cueTimings.find((cue) => cue.text.startsWith('Any questions'))?.startMs ?? durationMs,
      durationMs,
      platformRevealMs:
        cueTimings.find((cue) => cue.text.startsWith('Any questions'))?.startMs ?? durationMs,
      radioGainDb: Number.parseFloat(radioGain.toFixed(3)),
      radioRmsDb: Number.parseFloat(radioRms.toFixed(3)),
      radioStopMs: Math.round(
        (existingOffset + WRAPPER_VOICE_DELAY_SEC + alignEnd(alignment, RADIO_MUSIC_OFF_TEXT)) *
          1000
      ),
      boostedFirstRmsDb: Number.parseFloat(firstRms.toFixed(3)),
      cueTimings,
    };
    writeFileSync(options.timingsOutput, JSON.stringify(events, null, 2));
    console.log(JSON.stringify(events, null, 2));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
