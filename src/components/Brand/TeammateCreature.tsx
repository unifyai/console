import { cn } from '@/lib/utils';
import {
  creatureShapes,
  roleColorVars,
  roleEyeVars,
  type BrandRole,
  type CreatureShape,
} from './shapes';

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

const CREATURE_CELL = 18;
const CREATURE_MARGIN = 12;
const SAD_MOUTH_ANCHOR_OFFSET = 8;
const FRUSTRATED_MOUTH_ANCHOR_OFFSET = 7;
const APOLOGETIC_MOUTH_ANCHOR_OFFSET = 7;

export function getCreatureMetrics(shape: CreatureShape) {
  const cells = creatureShapes[shape];
  const maxX = Math.max(...cells.map(([x]) => x));
  const maxY = Math.max(...cells.map(([, y]) => y));
  const gridWidth = (maxX + 1) * CREATURE_CELL;
  const gridHeight = (maxY + 1) * CREATURE_CELL;

  return {
    width: gridWidth + CREATURE_MARGIN * 2,
    height: gridHeight + CREATURE_MARGIN * 2,
    eyeY: CREATURE_MARGIN + CREATURE_CELL * 0.98,
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

function CreatureEye({
  cx,
  cy,
  dir = 'up',
  mood,
  side,
  stroke,
}: {
  cx: number;
  cy: number;
  dir?: CreatureEyes;
  mood: CreatureMood;
  side: 'left' | 'right';
  stroke: string;
}) {
  if (mood === 'frustrated') {
    if (dir === 'blink') {
      return <rect fill={stroke} height={4} rx={2} width={15} x={cx - 7.5} y={cy - 2} />;
    }

    if (dir === 'square') {
      const browD =
        side === 'left'
          ? `M ${cx - 8} ${cy - 8} L ${cx + 6} ${cy - 4}`
          : `M ${cx - 6} ${cy - 4} L ${cx + 8} ${cy - 8}`;

      return (
        <g>
          <rect fill={stroke} height={8} rx={2} width={8} x={cx - 4} y={cy - 2} />
          <path
            d={browD}
            fill="none"
            stroke={stroke}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={3.5}
          />
        </g>
      );
    }

    const inwardD =
      side === 'left'
        ? `M ${cx - 6} ${cy - 6} L ${cx + 6} ${cy} L ${cx - 6} ${cy + 6}`
        : `M ${cx + 6} ${cy - 6} L ${cx - 6} ${cy} L ${cx + 6} ${cy + 6}`;

    return (
      <path
        d={inwardD}
        fill="none"
        stroke={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={4.5}
      />
    );
  }

  if (mood === 'apologetic') {
    if (dir === 'blink') {
      return (
        <path
          d={`M ${cx - 9} ${cy + 1} Q ${cx} ${cy + 4} ${cx + 9} ${cy + 1}`}
          fill="none"
          stroke={stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={4}
        />
      );
    }

    const browD =
      side === 'left'
        ? `M ${cx - 12} ${cy - 3} Q ${cx - 4} ${cy - 4} ${cx + 3} ${cy - 11}`
        : `M ${cx - 3} ${cy - 11} Q ${cx + 4} ${cy - 4} ${cx + 12} ${cy - 3}`;
    const eye =
      dir === 'square' ? (
        <rect fill={stroke} height={6} rx={3} width={10} x={cx - 5} y={cy + 2.5} />
      ) : (
        <path
          d={`M ${cx - 7} ${cy + 4} Q ${cx} ${cy + 8} ${cx + 7} ${cy + 4}`}
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
          d={browD}
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
      return <rect fill={stroke} height={3} rx={1.5} width={15} x={cx - 7.5} y={cy + 2} />;
    }

    return (
      <path
        d={`M ${cx - 8} ${cy + 2} Q ${cx} ${cy + 4} ${cx + 8} ${cy + 2}`}
        fill="none"
        stroke={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={3.75}
      />
    );
  }

  if (dir === 'blink') {
    return <rect fill={stroke} height={4} rx={2} width={15} x={cx - 7.5} y={cy - 2} />;
  }

  if (dir === 'square') {
    return <rect fill={stroke} height={9} rx={2} width={9} x={cx - 4.5} y={cy - 4.5} />;
  }

  const d =
    dir === 'down'
      ? `M ${cx - 6} ${cy - 4} L ${cx} ${cy + 4} L ${cx + 6} ${cy - 4}`
      : `M ${cx - 6} ${cy + 4} L ${cx} ${cy - 4} L ${cx + 6} ${cy + 4}`;

  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={4.5}
      />
    </g>
  );
}

function CreatureMouth({
  cx,
  cy,
  fill,
  mood,
  shape,
}: {
  cx: number;
  cy: number;
  fill: string;
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
        topY + (mood === 'frustrated' ? FRUSTRATED_MOUTH_ANCHOR_OFFSET : SAD_MOUTH_ANCHOR_OFFSET);
      const moodTopDip = mood === 'frustrated' ? topDip + 1 : topDip;
      const moodBottomDip = mood === 'frustrated' ? bottomDip * 0.82 : bottomDip;
      return `M ${leftX} ${anchorY} Q ${cx} ${anchorY - moodTopDip} ${rightX} ${anchorY} Q ${cx} ${
        anchorY - moodBottomDip
      } ${leftX} ${anchorY} Z`;
    }

    if (mood === 'apologetic') {
      const anchorY = topY + APOLOGETIC_MOUTH_ANCHOR_OFFSET;
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
        fill={fill}
        style={{
          opacity: 'calc(0.78 + var(--martian-speech-level, 0) * 0.22)',
          transform: 'scaleY(calc(0.9 + var(--martian-speech-level, 0) * 0.12))',
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
      fill={fill}
      style={{
        opacity: 'calc(var(--martian-speech-level, 0) * 0.95)',
        transform:
          'scaleX(calc(0.72 + var(--martian-speech-level, 0) * 0.42)) scaleY(calc(0.35 + var(--martian-speech-level, 0) * 0.65))',
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
  const cells = creatureShapes[shape];
  const fill = roleColorVars[color];
  const eyeStroke = roleEyeVars[color];
  const cell = CREATURE_CELL;
  const halo = 5;
  const margin = CREATURE_MARGIN;
  const maxX = Math.max(...cells.map(([x]) => x));
  const maxY = Math.max(...cells.map(([, y]) => y));
  const gridWidth = (maxX + 1) * cell;
  const gridHeight = (maxY + 1) * cell;
  const { width, height, eyeY } = getCreatureMetrics(shape);
  const px = (n: number) => margin + n * cell;
  const leftEyeX = margin + gridWidth * 0.32;
  const rightEyeX = margin + gridWidth * 0.6;
  const mouthX = (leftEyeX + rightEyeX) / 2;
  const mouthY = eyeY + cell * 1.02;

  return (
    <svg
      aria-label={label}
      className={cn('block overflow-visible', className)}
      role="img"
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {cells.map(([x, y], index) => (
        <rect
          fill="var(--ink)"
          height={cell + halo * 2}
          key={`shadow-${index}`}
          opacity={0.07}
          rx={7}
          width={cell + halo * 2}
          x={px(x) - halo + 3}
          y={px(y) - halo + 4}
        />
      ))}
      {cells.map(([x, y], index) => (
        <rect
          fill="var(--cream-white)"
          height={cell + halo * 2}
          key={`halo-${index}`}
          rx={7}
          width={cell + halo * 2}
          x={px(x) - halo}
          y={px(y) - halo}
        />
      ))}
      {cells.map(([x, y], index) => (
        <rect key={`fill-${index}`} fill={fill} height={cell} width={cell} x={px(x)} y={px(y)} />
      ))}
      {cells
        .filter(([, y]) => y >= maxY - 1)
        .map(([x, y], index) => (
          <rect
            fill="var(--ink)"
            height={cell}
            key={`shade-${index}`}
            opacity={y === maxY ? 0.26 : 0.1}
            width={cell}
            x={px(x)}
            y={px(y)}
          />
        ))}
      <CreatureEye cx={leftEyeX} cy={eyeY} dir={eyes} mood={mood} side="left" stroke={eyeStroke} />
      <CreatureEye
        cx={rightEyeX}
        cy={eyeY}
        dir={eyes}
        mood={mood}
        side="right"
        stroke={eyeStroke}
      />
      <CreatureMouth cx={mouthX} cy={mouthY} fill={eyeStroke} mood={mood} shape={mouthShape} />
    </svg>
  );
}
