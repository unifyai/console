'use client';

import * as React from 'react';
import type { CreatureEyes } from '@/components/Brand/TeammateCreature';

const PAUSE_SPEECH_LEVEL = 0.12;
const BLINK_DURATION_MS = 110;
const EXPRESSION_SEQUENCE = [
  'up',
  'square',
  'up',
  'down',
] as const satisfies readonly CreatureEyes[];

function getSpeechStartEyes(restingEyes: CreatureEyes): CreatureEyes {
  return restingEyes === 'up' ? 'square' : 'up';
}

function nextDelay(minMs: number, maxMs: number): number {
  return minMs + Math.random() * (maxMs - minMs);
}

export function useDroidEyeExpression({
  baseEyes = 'up',
  isCallActive = false,
  isSpeaking,
  isUserSpeaking = false,
  speechLevel,
}: {
  baseEyes?: CreatureEyes;
  isCallActive?: boolean;
  isSpeaking: boolean;
  isUserSpeaking?: boolean;
  speechLevel: number;
}): CreatureEyes {
  const [settledEyes, setSettledEyes] = React.useState<CreatureEyes>(baseEyes);
  const [isBlinking, setIsBlinking] = React.useState(false);
  const expressionIndexRef = React.useRef(0);
  const blinkTimeoutRef = React.useRef<number | null>(null);
  const speechLevelRef = React.useRef(speechLevel);
  const restingEyes = isCallActive || isUserSpeaking ? 'square' : baseEyes;
  const lastRestingEyesRef = React.useRef<CreatureEyes>(restingEyes);
  speechLevelRef.current = speechLevel;

  React.useEffect(() => {
    if (!isSpeaking) {
      lastRestingEyesRef.current = restingEyes;
    }
  }, [isSpeaking, restingEyes]);

  React.useEffect(() => {
    if (!isSpeaking) {
      expressionIndexRef.current = 0;
      setSettledEyes(baseEyes);
      setIsBlinking(false);
      if (blinkTimeoutRef.current !== null) {
        window.clearTimeout(blinkTimeoutRef.current);
        blinkTimeoutRef.current = null;
      }
      return;
    }

    setSettledEyes(getSpeechStartEyes(lastRestingEyesRef.current));

    let animationFrame = 0;
    let nextBlinkAt = performance.now() + nextDelay(2_400, 4_600);
    let nextExpressionAt = performance.now() + nextDelay(1_400, 2_800);

    const triggerBlink = () => {
      if (blinkTimeoutRef.current !== null) return;

      setIsBlinking(true);
      blinkTimeoutRef.current = window.setTimeout(() => {
        setIsBlinking(false);
        blinkTimeoutRef.current = null;
      }, BLINK_DURATION_MS);
    };

    const tick = (timestamp: number) => {
      const isPause = speechLevelRef.current <= PAUSE_SPEECH_LEVEL;
      const blinkIsDue = timestamp >= nextBlinkAt;
      const blinkIsOverdue = timestamp >= nextBlinkAt + 1_800;

      if (blinkIsDue && (isPause || blinkIsOverdue)) {
        triggerBlink();
        nextBlinkAt = timestamp + nextDelay(2_800, 5_200);
      }

      if (isPause && timestamp >= nextExpressionAt) {
        expressionIndexRef.current = (expressionIndexRef.current + 1) % EXPRESSION_SEQUENCE.length;
        setSettledEyes(EXPRESSION_SEQUENCE[expressionIndexRef.current]);
        nextExpressionAt = timestamp + nextDelay(1_700, 3_400);
      }

      animationFrame = window.requestAnimationFrame(tick);
    };

    animationFrame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      if (blinkTimeoutRef.current !== null) {
        window.clearTimeout(blinkTimeoutRef.current);
        blinkTimeoutRef.current = null;
      }
      setIsBlinking(false);
    };
  }, [baseEyes, isSpeaking]);

  if (isBlinking) return 'blink';
  if (isSpeaking) return settledEyes;
  return restingEyes;
}
