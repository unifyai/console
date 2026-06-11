import { cn } from '@/lib/utils';
import { roleColorVars, type BrandRole, type CreatureShape } from './shapes';

export type CreatureEyes = 'up' | 'down' | 'square' | 'blink';
export type CreatureMood = 'happy' | 'sad' | 'frustrated' | 'apologetic' | 'bored';
export type CreatureMouthShape =
  | 'amplitude'
  | 'closed'
  | 'pinched'
  | 'wide'
  | 'open'
  | 'round'
  | 'narrow';

type DroidForm = {
  bodyWidth: number;
  bodyHeight: number;
  bodyY: number;
  antenna: 'none' | 'rod' | 'ball' | 'twin' | 'bigball';
  footInset: number;
};

const DROID_VIEWBOX = 128;
const DROID_SAD_MOUTH_ANCHOR_OFFSET = 8;
const DROID_FRUSTRATED_MOUTH_ANCHOR_OFFSET = 7;
const DROID_APOLOGETIC_MOUTH_ANCHOR_OFFSET = 7;
const DROID_FORMS: Record<CreatureShape, DroidForm> = {
  clawd: { bodyWidth: 72, bodyHeight: 82, bodyY: 28, antenna: 'ball', footInset: 15 },
  notch: { bodyWidth: 78, bodyHeight: 74, bodyY: 34, antenna: 'none', footInset: 18 },
  runner: { bodyWidth: 66, bodyHeight: 88, bodyY: 24, antenna: 'rod', footInset: 12 },
  wide: { bodyWidth: 92, bodyHeight: 62, bodyY: 42, antenna: 'twin', footInset: 22 },
  tall: { bodyWidth: 60, bodyHeight: 94, bodyY: 18, antenna: 'rod', footInset: 12 },
  sprout: { bodyWidth: 66, bodyHeight: 78, bodyY: 32, antenna: 'bigball', footInset: 14 },
  hopper: { bodyWidth: 72, bodyHeight: 76, bodyY: 34, antenna: 'ball', footInset: 20 },
  pebble: { bodyWidth: 80, bodyHeight: 70, bodyY: 36, antenna: 'none', footInset: 19 },
};

export function getCreatureMetrics(shape: CreatureShape) {
  const form = DROID_FORMS[shape];

  return {
    width: DROID_VIEWBOX,
    height: DROID_VIEWBOX,
    eyeY: form.bodyY + form.bodyHeight * 0.36,
  };
}

type TeammateCreatureProps = {
  className?: string;
  color?: BrandRole;
  eyes?: CreatureEyes;
  label?: string;
  mood?: CreatureMood;
  mouthShape?: CreatureMouthShape;
  shape?: CreatureShape;
};

function DroidEye({
  cx,
  cy,
  dir = 'up',
  mood,
}: {
  cx: number;
  cy: number;
  dir?: CreatureEyes;
  mood: CreatureMood;
}) {
  const stroke = 'var(--droid-glow)';

  if (mood === 'frustrated') {
    if (dir === 'blink') {
      return <rect fill={stroke} height={4} rx={2} width={16} x={cx - 8} y={cy - 2} />;
    }

    if (dir === 'square') {
      return (
        <g>
          <rect fill={stroke} height={10} rx={2.5} width={10} x={cx - 5} y={cy - 2} />
          <path
            d={`M ${cx - 8} ${cy - 9} L ${cx + 8} ${cy - 5}`}
            fill="none"
            stroke={stroke}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={3}
          />
        </g>
      );
    }

    return (
      <path
        d={`M ${cx - 7} ${cy - 5} L ${cx + 7} ${cy} L ${cx - 7} ${cy + 5}`}
        fill="none"
        stroke={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={4}
      />
    );
  }

  if (mood === 'apologetic') {
    if (dir === 'blink') {
      return (
        <path
          d={`M ${cx - 9} ${cy + 2} Q ${cx} ${cy + 5} ${cx + 9} ${cy + 2}`}
          fill="none"
          stroke={stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={4}
        />
      );
    }

    const eye =
      dir === 'square' ? (
        <rect fill={stroke} height={7} rx={3.5} width={11} x={cx - 5.5} y={cy + 2} />
      ) : (
        <path
          d={`M ${cx - 8} ${cy + 3} Q ${cx} ${cy + 7} ${cx + 8} ${cy + 3}`}
          fill="none"
          stroke={stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={3.5}
        />
      );

    return (
      <g>
        <path
          d={`M ${cx - 11} ${cy - 4} Q ${cx} ${cy - 9} ${cx + 11} ${cy - 4}`}
          fill="none"
          stroke={stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={3.25}
        />
        {eye}
      </g>
    );
  }

  if (mood === 'bored') {
    if (dir === 'blink') {
      return <rect fill={stroke} height={3} rx={1.5} width={16} x={cx - 8} y={cy + 2} />;
    }

    return (
      <path
        d={`M ${cx - 9} ${cy + 2} Q ${cx} ${cy + 4} ${cx + 9} ${cy + 2}`}
        fill="none"
        stroke={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={3.75}
      />
    );
  }

  if (dir === 'blink') {
    return <rect fill={stroke} height={4} rx={2} width={16} x={cx - 8} y={cy - 2} />;
  }

  if (dir === 'square') {
    return <rect fill={stroke} height={10} rx={2.5} width={10} x={cx - 5} y={cy - 5} />;
  }

  const d =
    dir === 'down'
      ? `M ${cx - 7} ${cy - 5} L ${cx} ${cy + 5} L ${cx + 7} ${cy - 5}`
      : `M ${cx - 7} ${cy + 5} L ${cx} ${cy - 5} L ${cx + 7} ${cy + 5}`;

  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={4}
      />
    </g>
  );
}

function DroidMouth({
  cx,
  cy,
  mood,
  shape,
}: {
  cx: number;
  cy: number;
  mood: CreatureMood;
  shape: CreatureMouthShape;
}) {
  const getMouthPath = (
    leftX: number,
    rightX: number,
    topY: number,
    topDip: number,
    bottomDip: number
  ) => {
    if (mood === 'sad' || mood === 'frustrated') {
      const anchorY =
        topY +
        (mood === 'frustrated'
          ? DROID_FRUSTRATED_MOUTH_ANCHOR_OFFSET
          : DROID_SAD_MOUTH_ANCHOR_OFFSET);
      const moodTopDip = mood === 'frustrated' ? topDip + 1 : topDip;
      const moodBottomDip = mood === 'frustrated' ? bottomDip * 0.82 : bottomDip;
      return `M ${leftX} ${anchorY} Q ${cx} ${anchorY - moodTopDip} ${rightX} ${anchorY} Q ${cx} ${
        anchorY - moodBottomDip
      } ${leftX} ${anchorY} Z`;
    }

    if (mood === 'apologetic') {
      const anchorY = topY + DROID_APOLOGETIC_MOUTH_ANCHOR_OFFSET;
      const width = rightX - leftX;
      const apologeticLeftX = cx - width * 0.42;
      const apologeticRightX = cx + width * 0.42;
      const apologeticTopDip = Math.max(2, topDip * 0.58);
      const apologeticBottomDip = Math.max(6, bottomDip * 0.5);
      return `M ${apologeticLeftX} ${anchorY} Q ${cx} ${anchorY - apologeticTopDip} ${apologeticRightX} ${anchorY} Q ${cx} ${
        anchorY - apologeticBottomDip
      } ${apologeticLeftX} ${anchorY} Z`;
    }

    if (mood === 'bored') {
      const anchorY = topY + 6;
      const width = rightX - leftX;
      const boredLeftX = cx - width * 0.38;
      const boredRightX = cx + width * 0.38;
      return `M ${boredLeftX} ${anchorY} Q ${cx} ${anchorY + 2} ${boredRightX} ${anchorY} Q ${cx} ${
        anchorY + 1
      } ${boredLeftX} ${anchorY} Z`;
    }

    return `M ${leftX} ${topY} Q ${cx} ${topY + topDip} ${rightX} ${topY} Q ${cx} ${
      topY + bottomDip
    } ${leftX} ${topY} Z`;
  };

  if (shape !== 'amplitude') {
    const mouthByShape = {
      closed: { width: 24, topDip: 2, bottomDip: 8 },
      pinched: { width: 22, topDip: 2, bottomDip: 15 },
      narrow: { width: 26, topDip: 3, bottomDip: 17 },
      round: { width: 24, topDip: 3, bottomDip: 19 },
      wide: { width: 34, topDip: 3, bottomDip: 16 },
      open: { width: 30, topDip: 4, bottomDip: 22 },
    } satisfies Record<Exclude<CreatureMouthShape, 'amplitude'>, Record<string, number>>;
    const mouth = mouthByShape[shape];
    const leftX = cx - mouth.width / 2;
    const rightX = cx + mouth.width / 2;
    const topY = cy + 1;

    return (
      <path
        d={getMouthPath(leftX, rightX, topY, mouth.topDip, mouth.bottomDip)}
        fill="var(--droid-glow)"
        style={{
          opacity: 'calc(0.78 + var(--droid-speech-level, 0) * 0.22)',
          transform: 'scaleY(calc(0.9 + var(--droid-speech-level, 0) * 0.12))',
          transformBox: 'fill-box',
          transformOrigin: mood === 'happy' ? 'center top' : 'center bottom',
        }}
      />
    );
  }

  const width = 21;
  const topDip = 3;
  const bottomDip = 9;
  const leftX = cx - width / 2;
  const rightX = cx + width / 2;

  return (
    <path
      d={getMouthPath(leftX, rightX, cy, topDip, bottomDip)}
      fill="var(--droid-glow)"
      style={{
        opacity: 'calc(var(--droid-speech-level, 0) * 0.95)',
        transform:
          'scaleX(calc(0.72 + var(--droid-speech-level, 0) * 0.42)) scaleY(calc(0.35 + var(--droid-speech-level, 0) * 0.65))',
        transformBox: 'fill-box',
        transformOrigin: mood === 'happy' ? 'center' : 'center bottom',
      }}
    />
  );
}

export function TeammateCreature({
  className,
  color = 'green',
  eyes = 'up',
  label = 'Unify teammate',
  mood = 'happy',
  mouthShape = 'amplitude',
  shape = 'clawd',
}: TeammateCreatureProps) {
  const form = DROID_FORMS[shape];
  const fill = roleColorVars[color];
  const { bodyWidth, bodyHeight, bodyY, footInset, antenna } = form;
  const bodyX = (DROID_VIEWBOX - bodyWidth) / 2;
  const screenX = bodyX + bodyWidth * 0.2;
  const screenY = bodyY + bodyHeight * 0.22;
  const screenWidth = bodyWidth * 0.6;
  const screenHeight = bodyHeight * 0.32;
  const eyeY = screenY + screenHeight * 0.42;
  const leftEyeX = screenX + screenWidth * 0.33;
  const rightEyeX = screenX + screenWidth * 0.67;
  const mouthX = (leftEyeX + rightEyeX) / 2;
  const mouthY = screenY + screenHeight * 0.72;
  const footY = bodyY + bodyHeight - 2;
  const footWidth = (bodyWidth - footInset * 2) / 2 - 4;

  return (
    <svg
      aria-label={label}
      className={cn('block overflow-visible', className)}
      role="img"
      viewBox={`0 0 ${DROID_VIEWBOX} ${DROID_VIEWBOX}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <ellipse cx="64" cy="114" fill="var(--ink)" opacity="0.1" rx={bodyWidth * 0.45} ry="8" />

      {antenna === 'rod' && (
        <g stroke={fill} strokeLinecap="round" strokeWidth="4">
          <path d={`M 64 ${bodyY - 3} L 64 ${bodyY - 19}`} />
          <circle cx="64" cy={bodyY - 22} fill={fill} r="5" stroke="none" />
        </g>
      )}
      {antenna === 'ball' && (
        <g stroke={fill} strokeLinecap="round" strokeWidth="4">
          <path d={`M 64 ${bodyY - 3} L 64 ${bodyY - 14}`} />
          <circle cx="64" cy={bodyY - 18} fill="var(--cream-white)" r="7" />
          <circle cx="64" cy={bodyY - 18} fill={fill} r="4" stroke="none" />
        </g>
      )}
      {antenna === 'bigball' && (
        <g stroke={fill} strokeLinecap="round" strokeWidth="4">
          <path d={`M 64 ${bodyY - 3} L 64 ${bodyY - 15}`} />
          <circle cx="64" cy={bodyY - 21} fill="var(--cream-white)" r="10" />
          <circle cx="64" cy={bodyY - 21} fill={fill} r="6" stroke="none" />
        </g>
      )}
      {antenna === 'twin' && (
        <g stroke={fill} strokeLinecap="round" strokeWidth="4">
          <path
            d={`M ${bodyX + bodyWidth * 0.35} ${bodyY - 2} L ${bodyX + bodyWidth * 0.22} ${bodyY - 15}`}
          />
          <path
            d={`M ${bodyX + bodyWidth * 0.65} ${bodyY - 2} L ${bodyX + bodyWidth * 0.78} ${bodyY - 15}`}
          />
          <circle cx={bodyX + bodyWidth * 0.2} cy={bodyY - 17} fill={fill} r="4" stroke="none" />
          <circle cx={bodyX + bodyWidth * 0.8} cy={bodyY - 17} fill={fill} r="4" stroke="none" />
        </g>
      )}

      <rect
        fill={fill}
        height={bodyHeight}
        rx="16"
        stroke="var(--cream-white)"
        strokeWidth="7"
        width={bodyWidth}
        x={bodyX}
        y={bodyY}
      />
      <rect
        fill="var(--ink)"
        height={bodyHeight * 0.42}
        opacity="0.14"
        rx="14"
        width={bodyWidth}
        x={bodyX}
        y={bodyY + bodyHeight * 0.58}
      />
      <rect
        fill="var(--cream-white)"
        height={screenHeight + 12}
        opacity="0.92"
        rx="13"
        width={screenWidth + 12}
        x={screenX - 6}
        y={screenY - 6}
      />
      <rect
        fill="var(--droid-screen)"
        height={screenHeight}
        rx="9"
        width={screenWidth}
        x={screenX}
        y={screenY}
      />
      <DroidEye cx={leftEyeX} cy={eyeY} dir={eyes} mood={mood} />
      <DroidEye cx={rightEyeX} cy={eyeY} dir={eyes} mood={mood} />
      <DroidMouth cx={mouthX} cy={mouthY} mood={mood} shape={mouthShape} />
      <rect
        fill="var(--cream-white)"
        height="5"
        opacity="0.42"
        rx="2.5"
        width={bodyWidth * 0.36}
        x={bodyX + bodyWidth * 0.32}
        y={bodyY + bodyHeight * 0.72}
      />
      <rect fill={fill} height="11" rx="5" width={footWidth} x={bodyX + footInset} y={footY} />
      <rect
        fill={fill}
        height="11"
        rx="5"
        width={footWidth}
        x={bodyX + bodyWidth - footInset - footWidth}
        y={footY}
      />
    </svg>
  );
}
