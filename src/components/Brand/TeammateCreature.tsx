import { cn } from '@/lib/utils';
import {
  creatureShapes,
  roleColorVars,
  roleEyeVars,
  type BrandRole,
  type CreatureShape,
} from './shapes';

type EyeDirection = 'up' | 'down';

type TeammateCreatureProps = {
  className?: string;
  color?: BrandRole;
  eyes?: EyeDirection;
  label?: string;
  shape?: CreatureShape;
};

function CreatureEye({
  cx,
  cy,
  dir = 'up',
  stroke,
}: {
  cx: number;
  cy: number;
  dir?: EyeDirection;
  stroke: string;
}) {
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

export function TeammateCreature({
  className,
  color = 'green',
  eyes = 'up',
  label = 'Unify teammate',
  shape = 'clawd',
}: TeammateCreatureProps) {
  const cells = creatureShapes[shape];
  const fill = roleColorVars[color];
  const eyeStroke = roleEyeVars[color];
  const cell = 18;
  const halo = 5;
  const margin = 12;
  const maxX = Math.max(...cells.map(([x]) => x));
  const maxY = Math.max(...cells.map(([, y]) => y));
  const gridWidth = (maxX + 1) * cell;
  const gridHeight = (maxY + 1) * cell;
  const width = gridWidth + margin * 2;
  const height = gridHeight + margin * 2;
  const px = (n: number) => margin + n * cell;
  const leftEyeX = margin + gridWidth * 0.32;
  const rightEyeX = margin + gridWidth * 0.6;
  const eyeY = margin + cell * 0.98;

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
      <CreatureEye cx={leftEyeX} cy={eyeY} dir={eyes} stroke={eyeStroke} />
      <CreatureEye cx={rightEyeX} cy={eyeY} dir={eyes} stroke={eyeStroke} />
    </svg>
  );
}
