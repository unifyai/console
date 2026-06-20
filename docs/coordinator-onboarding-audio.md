# Coordinator Onboarding Audio

Console owns the Coordinator onboarding intro as a product asset:

- `public/sounds/twin-onboarding-intro.mp3`
- `public/sounds/twin-onboarding-intro.lipsync.json`
- `src/utils/assistants/coordinator-onboarding-intro.ts`
- `src/components/Pages/Assistants/Coordinator/CoordinatorOnboardingCallIntro.tsx`

The walkie-talkie treatment is not Console-owned. It lives in the branding
submodule and must be invoked through:

```bash
npm --prefix branding run audio:walkie -- ...
```

## Rule

Never recreate the walkie effect in Console. Do not add local `anoisesrc`, hiss,
static beds, carrier beds, copied FFmpeg filter chains, or ad hoc `amix` wrapper
logic. If a segment needs to sound like the existing radio/walkie audio, use the
full wrapped treatment from branding.

Use clean voice only for an intentional story beat where the audio is meant to
stop sounding like the walkie/radio treatment.

## Regeneration

Use the Console-owned generator:

```bash
npm run audio:coordinator-onboarding
```

Useful dry run:

```bash
npm run audio:coordinator-onboarding -- --dry-run
```

The script:

- preserves the first half of the current intro through the configured cut
  point,
- generates replacement speech through ElevenLabs,
- delegates radio/walkie treatment to `branding` via `npm run audio:walkie`,
- regenerates `public/sounds/twin-onboarding-intro.lipsync.json`, and
- prints timing constants for the React cue list.

## Partial Replacement

When replacing only part of an existing clip:

1. Preserve the existing adjacent audio.
2. Generate the replacement with the same treatment as the preserved audio.
3. Measure loudness on both sides of the splice before finalizing.

Example check:

```bash
ffmpeg -hide_banner -nostats -i public/sounds/twin-onboarding-intro.mp3 \
  -af "atrim=start=58.5:end=61.45,asetpts=PTS-STARTPTS,astats=metadata=1:reset=0" \
  -f null - 2>&1 | rg "RMS level dB|Peak level dB"
```

Repeat for the new segment. A large RMS difference at the splice means the
replacement does not match and should not be shipped.

## Ownership

Keep generated Coordinator intro media in Console. Do not move it into
`branding`. Branding owns the reusable audio treatment, docs, and tooling only.
