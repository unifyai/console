#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ELEVEN_MODEL = 'eleven_multilingual_v2';
const ELEVEN_OUTPUT_FORMAT = 'mp3_44100_128';
const TWIN_VOICE_ID = 'iP95p4xoKVk53GoZ742B';

const FIRST_HALF_CUT_SEC = 61.62;
const FIRST_HALF_REFERENCE_START_SEC = 58.5;
const FIRST_HALF_REFERENCE_END_SEC = 61.45;
const RADIO_PREROLL_SEC = 0.16;
const PRE_PLATFORM_PAUSE_SEC = 2.0;
const PRE_STATIC_REMOVAL_LINE_PAUSE_SEC = 1.0;
const PRE_STATIC_REMOVAL_PAUSE_SEC = 1.0;
const ELEVATOR_DING_AFTER_FIRST_LINE_SEC = 0.7;
const WRAPPER_VOICE_DELAY_SEC = 0.7 - 0.028 - 0.48;
const SWITCHER_CUE_DURATION_SEC = 1.5;
const SWITCHER_CUE_VOLUME = 0.06;
const SWITCHER_CUE_SRC = 'public/sounds/radio-tuning-transition.mp3';
const WALK_PLATFORM_GAIN_DB = 4.0;
const MUSIC_OFF_GAIN_DB = 1.7;
const STATIC_REMOVAL_GAIN_DB = 0.9;

const LANDING_PAGE_WRAPPER_COMMIT = '388e8cd';
const WRAPPER_INTRO_RELATIVE_PATH =
  'public/landing/neo/voice-tests/youtube-crackle-source/sampled-beginning.wav';
const WRAPPER_OUTRO_RELATIVE_PATH =
  'public/landing/neo/voice-tests/youtube-crackle-source/sampled-ending.wav';

const RADIO_TEXT =
  "I'll now walk you through the platform. Actually, first lets turn off this really annoying music. Let me remove this voice static.";
const CLEAN_TEXT =
  "Much better. There we go, now I'll pull up the platform. Any questions before we start with the onboarding?";

const RADIO_CUES = [
  {
    audioText: "I'll now walk you through the platform.",
    displayText: "I'll now walk you through the platform.",
  },
  {
    audioText: 'Actually, first lets turn off this really annoying music.',
    displayText: 'Actually, first lets turn off this really annoying music.',
  },
  {
    audioText: 'Let me remove this voice static.',
    displayText: 'Let me remove this voice static.',
  },
];
const CLEAN_CUES = [
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

function repoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
}

function defaultLandingPageRoot() {
  return path.resolve(repoRoot(), '../landing-page');
}

function parseArgs() {
  const root = repoRoot();
  const args = process.argv.slice(2);
  const options = {
    dryRun: false,
    output: path.join(root, 'public/sounds/twin-onboarding-intro.mp3'),
    sourceExisting: path.join(root, 'public/sounds/twin-onboarding-intro.mp3'),
    timingsOutput: path.join(tmpdir(), 'coordinator-onboarding-intro-timings.json'),
    landingPageRoot: defaultLandingPageRoot(),
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
  const requiredFiles = [
    brandingWalkieCli(),
    lipsyncGenerator(),
    switcherCuePath(),
    options.sourceExisting,
  ];
  for (const filePath of requiredFiles) {
    if (!existsSync(filePath)) {
      throw new Error(`Missing required file: ${filePath}`);
    }
  }

  execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  execFileSync('ffprobe', ['-version'], { stdio: 'ignore' });

  if (options.wrapperIntro && options.wrapperOutro) {
    for (const filePath of [options.wrapperIntro, options.wrapperOutro]) {
      if (!existsSync(filePath)) throw new Error(`Missing wrapper sample: ${filePath}`);
    }
    return;
  }

  execFileSync(
    'git',
    [
      '-C',
      options.landingPageRoot,
      'cat-file',
      '-e',
      `${options.wrapperCommit}:${WRAPPER_INTRO_RELATIVE_PATH}`,
    ],
    { stdio: 'ignore' }
  );
  execFileSync(
    'git',
    [
      '-C',
      options.landingPageRoot,
      'cat-file',
      '-e',
      `${options.wrapperCommit}:${WRAPPER_OUTRO_RELATIVE_PATH}`,
    ],
    { stdio: 'ignore' }
  );
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
  const introBuffer = execFileSync('git', [
    '-C',
    options.landingPageRoot,
    'show',
    `${options.wrapperCommit}:${WRAPPER_INTRO_RELATIVE_PATH}`,
  ]);
  const outroBuffer = execFileSync('git', [
    '-C',
    options.landingPageRoot,
    'show',
    `${options.wrapperCommit}:${WRAPPER_OUTRO_RELATIVE_PATH}`,
  ]);
  writeFileSync(intro, introBuffer);
  writeFileSync(outro, outroBuffer);
  return { intro, outro };
}

async function fetchSpeechWithTimestamps(text, outputPath) {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${TWIN_VOICE_ID}/with-timestamps?output_format=${ELEVEN_OUTPUT_FORMAT}`,
    {
      body: JSON.stringify({
        model_id: ELEVEN_MODEL,
        text,
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

function alignCue(alignment, cue) {
  const alignmentText = alignment.characters.join('');
  const index = alignmentText.indexOf(cue.audioText);
  if (index === -1) throw new Error(`Could not align cue: ${cue.audioText}`);
  return alignment.character_start_times_seconds[index];
}

function alignCueEnd(alignment, cue) {
  const alignmentText = alignment.characters.join('');
  const index = alignmentText.indexOf(cue.audioText);
  if (index === -1) throw new Error(`Could not align cue end: ${cue.audioText}`);
  const endIndex = index + cue.audioText.length - 1;
  return (
    alignment.character_end_times_seconds[endIndex] ??
    alignment.character_start_times_seconds[endIndex]
  );
}

function runFfmpeg(args) {
  execFileSync('ffmpeg', ['-y', '-v', 'error', ...args], { stdio: 'inherit' });
}

function rmsDb({ inputPath, start, end }) {
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
  const matches = [...output.matchAll(/RMS level dB:\s*(-?\d+(?:\.\d+)?)/g)];
  const value = Number.parseFloat(matches.at(-1)?.[1] ?? 'NaN');
  if (!Number.isFinite(value)) throw new Error(`Could not measure RMS for ${inputPath}`);
  return value;
}

function renderCleanVoice(inputPath, outputPath) {
  runFfmpeg([
    '-i',
    inputPath,
    '-af',
    'highpass=f=80,lowpass=f=13000,acompressor=threshold=-18dB:ratio=2.1:attack=5:release=90,alimiter=limit=0.92,volume=0.93',
    '-ac',
    '1',
    '-ar',
    '48000',
    '-c:a',
    'pcm_s16le',
    outputPath,
  ]);
}

function printDryRun(options) {
  assertPrerequisites(options);
  console.log(
    JSON.stringify(
      {
        brandingWalkieCli: brandingWalkieCli(),
        cleanText: CLEAN_TEXT,
        firstHalfCutSec: FIRST_HALF_CUT_SEC,
        output: options.output,
        prePlatformPauseSec: PRE_PLATFORM_PAUSE_SEC,
        radioText: RADIO_TEXT,
        sourceExisting: options.sourceExisting,
        timingsOutput: options.timingsOutput,
        wrapper: options.wrapperIntro
          ? { intro: options.wrapperIntro, outro: options.wrapperOutro }
          : {
              commit: options.wrapperCommit,
              intro: WRAPPER_INTRO_RELATIVE_PATH,
              landingPageRoot: options.landingPageRoot,
              outro: WRAPPER_OUTRO_RELATIVE_PATH,
            },
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
    const radioRawMp3 = path.join(tempDir, 'radio-raw.mp3');
    const cleanRawMp3 = path.join(tempDir, 'clean-raw.mp3');
    const radioWrappedWav = path.join(tempDir, 'radio-wrapped.wav');
    const radioTrimmedWav = path.join(tempDir, 'radio-trimmed.wav');
    const radioMatchedWav = path.join(tempDir, 'radio-matched.wav');
    const radioMatchedWithPauseWav = path.join(tempDir, 'radio-matched-with-pause.wav');
    const radioNormalizedWav = path.join(tempDir, 'radio-normalized.wav');
    const cleanVoiceWav = path.join(tempDir, 'clean-voice.wav');
    const firstHalfWav = path.join(tempDir, 'first-half.wav');
    const platformPauseWav = path.join(tempDir, 'platform-pause.wav');
    const staticRemovalLinePauseWav = path.join(tempDir, 'static-removal-line-pause.wav');
    const staticRemovalPauseWav = path.join(tempDir, 'static-removal-pause.wav');
    const switcherCueWav = path.join(tempDir, 'switcher-cue.wav');
    const outputWav = path.join(tempDir, 'output.wav');
    const lipsyncWav = path.join(tempDir, 'lipsync.wav');

    const radioAlignment = await fetchSpeechWithTimestamps(RADIO_TEXT, radioRawMp3);
    const cleanAlignment = await fetchSpeechWithTimestamps(CLEAN_TEXT, cleanRawMp3);

    execFileSync(
      'node',
      [
        brandingWalkieCli(),
        '--input',
        radioRawMp3,
        '--output',
        radioWrappedWav,
        '--mode',
        'wrapped',
        '--intro',
        wrapper.intro,
        '--outro',
        wrapper.outro,
      ],
      { stdio: 'inherit' }
    );
    renderCleanVoice(cleanRawMp3, cleanVoiceWav);

    const firstCueStart = alignCue(radioAlignment, RADIO_CUES[0]);
    const firstCueEnd = alignCueEnd(radioAlignment, RADIO_CUES[0]);
    const radioTrimStart = Math.max(0, WRAPPER_VOICE_DELAY_SEC + firstCueStart - RADIO_PREROLL_SEC);
    const lastRadioCueEnd = alignCueEnd(radioAlignment, RADIO_CUES[RADIO_CUES.length - 1]);
    const radioTrimEnd = WRAPPER_VOICE_DELAY_SEC + lastRadioCueEnd + 0.22;
    runFfmpeg([
      '-i',
      radioWrappedWav,
      '-filter_complex',
      `[0:a]atrim=start=${radioTrimStart}:end=${radioTrimEnd},asetpts=PTS-STARTPTS[out]`,
      '-map',
      '[out]',
      '-ac',
      '1',
      '-ar',
      '48000',
      '-c:a',
      'pcm_s16le',
      radioTrimmedWav,
    ]);

    const replacementStart = RADIO_PREROLL_SEC;
    const replacementEnd = replacementStart + firstCueEnd - firstCueStart;
    const referenceRms = rmsDb({
      inputPath: options.sourceExisting,
      start: FIRST_HALF_REFERENCE_START_SEC,
      end: FIRST_HALF_REFERENCE_END_SEC,
    });
    const replacementRms = rmsDb({
      inputPath: radioTrimmedWav,
      start: replacementStart,
      end: replacementEnd,
    });
    const gainDb = referenceRms - replacementRms;
    runFfmpeg([
      '-i',
      radioTrimmedWav,
      '-af',
      `volume=${gainDb.toFixed(3)}dB,alimiter=limit=0.95`,
      '-ac',
      '1',
      '-ar',
      '48000',
      '-c:a',
      'pcm_s16le',
      radioMatchedWav,
    ]);
    runFfmpeg([
      '-f',
      'lavfi',
      '-i',
      `anullsrc=r=48000:cl=mono:d=${PRE_STATIC_REMOVAL_LINE_PAUSE_SEC}`,
      '-c:a',
      'pcm_s16le',
      staticRemovalLinePauseWav,
    ]);
    const staticRemovalLineStart =
      RADIO_PREROLL_SEC + alignCue(radioAlignment, RADIO_CUES[2]) - firstCueStart;
    runFfmpeg([
      '-i',
      radioMatchedWav,
      '-i',
      staticRemovalLinePauseWav,
      '-filter_complex',
      `[0:a]atrim=start=0:end=${staticRemovalLineStart},asetpts=PTS-STARTPTS[before];` +
        `[0:a]atrim=start=${staticRemovalLineStart},asetpts=PTS-STARTPTS[after];` +
        '[before][1:a][after]concat=n=3:v=0:a=1[out]',
      '-map',
      '[out]',
      '-ac',
      '1',
      '-ar',
      '48000',
      '-c:a',
      'pcm_s16le',
      radioMatchedWithPauseWav,
    ]);
    const musicOffLineStart =
      RADIO_PREROLL_SEC + alignCue(radioAlignment, RADIO_CUES[1]) - firstCueStart;
    const staticRemovalSpeechStart = staticRemovalLineStart + PRE_STATIC_REMOVAL_LINE_PAUSE_SEC;
    runFfmpeg([
      '-i',
      radioMatchedWithPauseWav,
      '-af',
      `volume=enable='lt(t,${musicOffLineStart.toFixed(3)})':volume=${WALK_PLATFORM_GAIN_DB}dB,` +
        `volume=enable='between(t,${musicOffLineStart.toFixed(3)},${staticRemovalSpeechStart.toFixed(3)})':volume=${MUSIC_OFF_GAIN_DB}dB,` +
        `volume=enable='gte(t,${staticRemovalSpeechStart.toFixed(3)})':volume=${STATIC_REMOVAL_GAIN_DB}dB,` +
        'alimiter=limit=0.95',
      '-ac',
      '1',
      '-ar',
      '48000',
      '-c:a',
      'pcm_s16le',
      radioNormalizedWav,
    ]);

    runFfmpeg([
      '-i',
      options.sourceExisting,
      '-filter_complex',
      `[0:a]atrim=start=0:end=${FIRST_HALF_CUT_SEC},asetpts=PTS-STARTPTS[out]`,
      '-map',
      '[out]',
      '-ac',
      '1',
      '-ar',
      '48000',
      '-c:a',
      'pcm_s16le',
      firstHalfWav,
    ]);
    runFfmpeg([
      '-f',
      'lavfi',
      '-i',
      `anullsrc=r=48000:cl=mono:d=${PRE_PLATFORM_PAUSE_SEC}`,
      '-c:a',
      'pcm_s16le',
      platformPauseWav,
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
      switcherCueWav,
    ]);
    runFfmpeg([
      '-f',
      'lavfi',
      '-i',
      `anullsrc=r=48000:cl=mono:d=${PRE_STATIC_REMOVAL_PAUSE_SEC}`,
      '-c:a',
      'pcm_s16le',
      staticRemovalPauseWav,
    ]);
    runFfmpeg([
      '-i',
      firstHalfWav,
      '-i',
      platformPauseWav,
      '-i',
      radioNormalizedWav,
      '-i',
      staticRemovalPauseWav,
      '-i',
      switcherCueWav,
      '-i',
      cleanVoiceWav,
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
      outputWav,
    ]);
    runFfmpeg([
      '-i',
      outputWav,
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

    const radioTrimmedDuration = durationSeconds(radioNormalizedWav);
    const switcherCueDuration = durationSeconds(switcherCueWav);
    const radioStartSec = FIRST_HALF_CUT_SEC + PRE_PLATFORM_PAUSE_SEC;
    const cleanStartSec =
      radioStartSec + radioTrimmedDuration + PRE_STATIC_REMOVAL_PAUSE_SEC + switcherCueDuration;
    const cueTimings = [
      ...RADIO_CUES.map((cue, index) => ({
        startMs: Math.round(
          FIRST_HALF_CUT_SEC * 1000 +
            PRE_PLATFORM_PAUSE_SEC * 1000 +
            (RADIO_PREROLL_SEC + alignCue(radioAlignment, cue) - firstCueStart) * 1000 +
            (index >= 2 ? PRE_STATIC_REMOVAL_LINE_PAUSE_SEC * 1000 : 0)
        ),
        text: cue.displayText,
      })),
      ...CLEAN_CUES.map((cue) => ({
        startMs: Math.round(cleanStartSec * 1000 + alignCue(cleanAlignment, cue) * 1000),
        text: cue.displayText,
      })),
    ];
    const durationMs = Math.round(durationSeconds(options.output) * 1000);
    const events = {
      closingQuestionMs:
        cueTimings.find((cue) => cue.text.startsWith('Any questions'))?.startMs ?? durationMs,
      durationMs,
      elevatorArrivalMs: Math.round(
        cueTimings[0].startMs +
          (firstCueEnd - firstCueStart + ELEVATOR_DING_AFTER_FIRST_LINE_SEC) * 1000
      ),
      firstHalfCutMs: Math.round(FIRST_HALF_CUT_SEC * 1000),
      platformRevealMs:
        cueTimings.find((cue) => cue.text.startsWith('Any questions'))?.startMs ?? durationMs,
      radioStopMs: Math.round(
        cueTimings[1].startMs +
          (alignCueEnd(radioAlignment, RADIO_CUES[1]) -
            alignCue(radioAlignment, RADIO_CUES[1]) +
            0.12) *
            1000
      ),
      spliceGainDb: Number.parseFloat(gainDb.toFixed(3)),
      spliceReferenceRmsDb: Number.parseFloat(referenceRms.toFixed(3)),
      spliceReplacementRmsDb: Number.parseFloat(replacementRms.toFixed(3)),
      cueTimings,
    };
    writeFileSync(options.timingsOutput, JSON.stringify(events, null, 2));

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

    console.log(JSON.stringify(events, null, 2));
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
