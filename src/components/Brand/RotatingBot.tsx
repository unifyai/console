'use client';

import { useEffect, useRef, useState } from 'react';

function shade(hex: string, pct: number) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const t = pct < 0 ? 0 : 255;
  const p = Math.abs(pct);
  r = Math.round((t - r) * p + r);
  g = Math.round((t - g) * p + g);
  b = Math.round((t - b) * p + b);
  return '#' + (0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

const RB_SCREEN = '#0e2027';
const RB_GLOW = '#79efdd';

export const RB_FORM = {
  tower: { S: 66, Hh: 132, ant: 'rod' },
  console: { S: 104, Hh: 66, ant: 'none' },
  unit: { S: 80, Hh: 100, ant: 'ball' },
  sprout: { S: 66, Hh: 82, ant: 'bigball' },
  wide: { S: 110, Hh: 60, ant: 'twin' },
} as const;

export type FormName = keyof typeof RB_FORM;
type Point3 = [number, number, number];
type Point2 = [number, number, number];
export type BotEyeStyle = 'up' | 'down' | 'square';
export type BotAntennaStyle = 'none' | 'rod' | 'ball' | 'bigball' | 'twin';
export type BotView = {
  yaw: number;
  tilt: number;
};
type BotStamp = {
  label: string;
  peel?: 'tl' | 'tr' | 'bl' | 'br';
  tilt?: number;
};

const DEFAULT_REST_VIEW: BotView = { yaw: 45, tilt: 30 };
const DEFAULT_ACTIVE_VIEW: BotView = { yaw: 0, tilt: 7 };

function resolveView(view: Partial<BotView> | undefined, fallback: BotView) {
  return {
    yaw: view?.yaw ?? fallback.yaw,
    tilt: view?.tilt ?? fallback.tilt,
  };
}

function lerpView(from: BotView, to: BotView, p: number) {
  return {
    yaw: from.yaw * (1 - p) + to.yaw * p,
    tilt: from.tilt * (1 - p) + to.tilt * p,
  };
}

function interpolateView(
  p: number,
  restView?: Partial<BotView>,
  activeView?: Partial<BotView>,
  intermediateView?: Partial<BotView>
) {
  const rest = resolveView(restView, DEFAULT_REST_VIEW);
  const active = resolveView(activeView, DEFAULT_ACTIVE_VIEW);
  const intermediate = intermediateView
    ? resolveView(intermediateView, DEFAULT_REST_VIEW)
    : undefined;

  if (!intermediate) return lerpView(rest, active, p);

  const firstDistance =
    Math.abs(rest.yaw - intermediate.yaw) + Math.abs(rest.tilt - intermediate.tilt);
  const secondDistance =
    Math.abs(intermediate.yaw - active.yaw) + Math.abs(intermediate.tilt - active.tilt);
  const split = firstDistance / Math.max(firstDistance + secondDistance, 1);

  if (p <= split) return lerpView(rest, intermediate, split === 0 ? 1 : p / split);
  return lerpView(intermediate, active, split === 1 ? 1 : (p - split) / (1 - split));
}

function rbProjector(
  p: number,
  restView?: Partial<BotView>,
  activeView?: Partial<BotView>,
  intermediateView?: Partial<BotView>
) {
  const view = interpolateView(p, restView, activeView, intermediateView);
  const a = (view.yaw * Math.PI) / 180;
  const t = (view.tilt * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const ct = Math.cos(t);
  const st = Math.sin(t);

  return (x: number, y: number, z: number): Point2 => {
    const x1 = x * ca + z * sa;
    const z1 = -x * sa + z * ca;
    const y2 = y * ct - z1 * st;
    const z2 = y * st + z1 * ct;
    return [x1, -y2, z2];
  };
}

function rbNormalZ(
  p: number,
  nx: number,
  ny: number,
  nz: number,
  restView?: Partial<BotView>,
  activeView?: Partial<BotView>,
  intermediateView?: Partial<BotView>
) {
  const view = interpolateView(p, restView, activeView, intermediateView);
  const a = (view.yaw * Math.PI) / 180;
  const t = (view.tilt * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const ct = Math.cos(t);
  const st = Math.sin(t);
  const nz1 = -nx * sa + nz * ca;
  return ny * st + nz1 * ct;
}

function rbFaces(S: number, Hh: number) {
  const h = S / 2;
  const FBL: Point3 = [-h, 0, h];
  const FBR: Point3 = [h, 0, h];
  const FTR: Point3 = [h, Hh, h];
  const FTL: Point3 = [-h, Hh, h];
  const BBR: Point3 = [h, 0, -h];
  const BBL: Point3 = [-h, 0, -h];
  const BTL: Point3 = [-h, Hh, -h];
  const BTR: Point3 = [h, Hh, -h];

  return [
    { id: 'back', n: [0, 0, -1], cs: [BBR, BBL, BTL, BTR] },
    { id: 'left', n: [-1, 0, 0], cs: [BBL, FBL, FTL, BTL] },
    { id: 'right', n: [1, 0, 0], cs: [FBR, BBR, BTR, FTR] },
    { id: 'top', n: [0, 1, 0], cs: [FTL, FTR, BTR, BTL] },
    { id: 'front', n: [0, 0, 1], cs: [FBL, FBR, FTR, FTL] },
  ] as const;
}

function formViewBox(
  form: FormName,
  restView?: Partial<BotView>,
  activeView?: Partial<BotView>,
  intermediateView?: Partial<BotView>,
  antenna?: BotAntennaStyle
) {
  const { S, Hh, ant } = RB_FORM[form] || RB_FORM.unit;
  const resolvedAntenna = antenna ?? ant;
  const antLen =
    resolvedAntenna === 'none'
      ? 0
      : resolvedAntenna === 'rod'
        ? 50
        : resolvedAntenna === 'twin'
          ? 30
          : 34;
  const pts: [number, number][] = [];
  const corners: Point3[] = [
    [-S / 2, 0, S / 2],
    [S / 2, 0, S / 2],
    [S / 2, Hh, S / 2],
    [-S / 2, Hh, S / 2],
    [-S / 2, 0, -S / 2],
    [S / 2, 0, -S / 2],
    [S / 2, Hh, -S / 2],
    [-S / 2, Hh, -S / 2],
    [0, Hh + antLen, 0],
    [-26, Hh + antLen, 0],
    [26, Hh + antLen, 0],
  ];

  [0, 0.25, 0.5, 0.75, 1].forEach((p) => {
    const pr = rbProjector(p, restView, activeView, intermediateView);
    corners.forEach((c) => {
      const q = pr(c[0], c[1], c[2]);
      pts.push([q[0], q[1]]);
    });
  });

  const xs = pts.map((q) => q[0]);
  const ys = pts.map((q) => q[1]);
  const pad = 12;
  const minX = Math.min(...xs) - pad;
  const maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad;
  const maxY = Math.max(...ys) + pad * 1.6;
  return { minX, minY, w: maxX - minX, h: maxY - minY };
}

export function getRotatingBotViewBox(
  form: FormName,
  restView?: Partial<BotView>,
  activeView?: Partial<BotView>,
  intermediateView?: Partial<BotView>,
  antenna?: BotAntennaStyle
) {
  return formViewBox(form, restView, activeView, intermediateView, antenna);
}

export function getRotatingBotEyePoints(
  form: FormName,
  restView?: Partial<BotView>,
  activeView?: Partial<BotView>,
  intermediateView?: Partial<BotView>
) {
  const { S, Hh } = RB_FORM[form] || RB_FORM.unit;
  const project = rbProjector(1, restView, activeView, intermediateView);
  const eyeY = Hh * 0.6;
  const eyeZ = S / 2;

  return [0.38, 0.62].map(
    (u) => project(-S / 2 + S * u, eyeY, eyeZ).slice(0, 2) as [number, number]
  );
}

export function getRotatingBotBodyCenter(
  form: FormName,
  restView?: Partial<BotView>,
  activeView?: Partial<BotView>,
  intermediateView?: Partial<BotView>
) {
  const { Hh } = RB_FORM[form] || RB_FORM.unit;
  const project = rbProjector(0, restView, activeView, intermediateView);

  return project(0, Hh / 2, 0).slice(0, 2) as [number, number];
}

export function getRotatingBotAnchorRatios(
  form: FormName,
  restView?: Partial<BotView>,
  activeView?: Partial<BotView>,
  intermediateView?: Partial<BotView>
) {
  const shape = RB_FORM[form] || RB_FORM.unit;
  const vb = formViewBox(form, restView, activeView, intermediateView);
  const project = rbProjector(0, restView, activeView, intermediateView);
  const frontEdgeMidpoint = project(0, 0, shape.S / 2);
  const bottomCenter = {
    x: vb.minX + vb.w / 2,
    y: vb.minY + vb.h,
  };

  return {
    x: -((frontEdgeMidpoint[0] - bottomCenter.x) / vb.w),
    y: -((frontEdgeMidpoint[1] - bottomCenter.y) / vb.w),
  };
}

const RB_EYE_CORE_STROKE = 4.2;
const RB_EYE_GLOW_STROKE = 9;
const RB_EYE_REFERENCE_FORM: FormName = 'wide';
const RB_EYE_NORMALIZATION_VIEWPORT = 160;
const RB_SQUARE_EYE_HALF_WORLD = RB_FORM.wide.S * 0.034;
const RB_CHEVRON_EYE_HALF_WIDTH_WORLD = RB_FORM.wide.S * 0.056;
const RB_CHEVRON_EYE_HALF_HEIGHT_WORLD = RB_FORM.wide.Hh * 0.052;

function rbPreviewScaleForForm(
  form: FormName,
  restView?: Partial<BotView>,
  activeView?: Partial<BotView>,
  intermediateView?: Partial<BotView>
) {
  const vb = formViewBox(form, restView, activeView, intermediateView);
  return Math.min(RB_EYE_NORMALIZATION_VIEWPORT / vb.w, RB_EYE_NORMALIZATION_VIEWPORT / vb.h);
}

function rbEyeRenderScale(
  form: FormName,
  restView?: Partial<BotView>,
  activeView?: Partial<BotView>,
  intermediateView?: Partial<BotView>
) {
  const formScale = rbPreviewScaleForForm(form, restView, activeView, intermediateView);
  const referenceScale = rbPreviewScaleForForm(
    RB_EYE_REFERENCE_FORM,
    restView,
    activeView,
    intermediateView
  );
  return referenceScale / Math.max(formScale, 0.001);
}

function rbEyeStrokeScale(
  form: FormName,
  restView?: Partial<BotView>,
  activeView?: Partial<BotView>,
  intermediateView?: Partial<BotView>
) {
  return rbEyeRenderScale(form, restView, activeView, intermediateView);
}

function rbBotElements(
  accent: string,
  form: FormName,
  eyeDir: BotEyeStyle,
  p: number,
  stamp?: BotStamp,
  restView?: Partial<BotView>,
  activeView?: Partial<BotView>,
  intermediateView?: Partial<BotView>,
  antenna?: BotAntennaStyle
) {
  const { S, Hh, ant } = RB_FORM[form] || RB_FORM.unit;
  const resolvedAntenna = antenna ?? ant;
  const pr = rbProjector(p, restView, activeView, intermediateView);
  const P = (v: Point3) => pr(v[0], v[1], v[2]);
  const xy = (q: Point2) => `${q[0].toFixed(2)},${q[1].toFixed(2)}`;
  const fmt = (value: number) => value.toFixed(3);

  const tone = {
    top: shade(accent, 0.27),
    front: shade(accent, 0.07),
    right: shade(accent, -0.18),
    left: shade(accent, 0.0),
    back: shade(accent, -0.34),
  };
  const line = shade(accent, -0.64);
  const accLite = shade(accent, 0.34);
  const dark = shade(accent, -0.46);
  const eyeStrokeScale = rbEyeStrokeScale(form, restView, activeView, intermediateView);
  const eyeGlowStroke = RB_EYE_GLOW_STROKE * eyeStrokeScale;
  const eyeCoreStroke = RB_EYE_CORE_STROKE * eyeStrokeScale;

  const fp = (cs: readonly Point3[], u: number, v: number) => {
    const c0 = cs[0];
    const c1 = cs[1];
    const c3 = cs[3];
    return P([
      c0[0] + u * (c1[0] - c0[0]) + v * (c3[0] - c0[0]),
      c0[1] + u * (c1[1] - c0[1]) + v * (c3[1] - c0[1]),
      c0[2] + u * (c1[2] - c0[2]) + v * (c3[2] - c0[2]),
    ]);
  };
  const stampLabel = stamp?.label.trim().toUpperCase();
  const stampInk = '#3e3542';
  const stampBorder = '#6f6570';
  const stampPaper = '#fff7e8';
  const makePlaneStamp = (cs: readonly Point3[], key: string, centerU: number, centerV: number) => {
    if (!stamp || !stampLabel) return null;

    const origin = fp(cs, 0, 1);
    const u1 = fp(cs, 1, 1);
    const v1 = fp(cs, 0, 0);
    const ux = u1[0] - origin[0];
    const uy = u1[1] - origin[1];
    const vx = v1[0] - origin[0];
    const vy = v1[1] - origin[1];
    const planeX = Math.max(0.001, Math.hypot(ux, uy));
    const planeY = Math.max(0.001, Math.hypot(vx, vy));
    const textYScale = planeX / planeY;
    const labelLength = stampLabel.length;
    const width = 0.92;
    const height = (width * planeX) / (3 * planeY);
    const letterSpacing = labelLength > 8 ? 0.012 : 0.016;
    const widthLimitedSize = Math.max(
      0.01,
      (width * 0.84 - letterSpacing * (labelLength - 1)) / (labelLength * 0.62)
    );
    const heightLimitedSize = (height * 0.68) / textYScale;
    const fontSize = Math.min(0.22, widthLimitedSize, heightLimitedSize);
    const peel = (() => {
      if (!stamp.peel) return null;

      const left = -width / 2;
      const right = width / 2;
      const top = -height / 2;
      const bottom = height / 2;
      const size = Math.min(width * 0.16, height * 0.48);

      switch (stamp.peel) {
        case 'tl':
          return {
            crease: [
              [left + size, top],
              [left, top + size],
            ],
            points: [
              [left, top],
              [left + size, top],
              [left, top + size],
            ],
          };
        case 'tr':
          return {
            crease: [
              [right - size, top],
              [right, top + size],
            ],
            points: [
              [right, top],
              [right - size, top],
              [right, top + size],
            ],
          };
        case 'bl':
          return {
            crease: [
              [left + size, bottom],
              [left, bottom - size],
            ],
            points: [
              [left, bottom],
              [left + size, bottom],
              [left, bottom - size],
            ],
          };
        case 'br':
          return {
            crease: [
              [right - size, bottom],
              [right, bottom - size],
            ],
            points: [
              [right, bottom],
              [right - size, bottom],
              [right, bottom - size],
            ],
          };
      }
    })();
    const localPoints = (pts: number[][]) => pts.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join(' ');

    return (
      <g key={key} opacity="1" pointerEvents="none">
        <g
          transform={`matrix(${fmt(ux)} ${fmt(uy)} ${fmt(vx)} ${fmt(vy)} ${fmt(origin[0])} ${fmt(origin[1])})`}
        >
          <g transform={`translate(${centerU} ${centerV}) rotate(${stamp.tilt ?? 0})`}>
            <rect
              fill={stampPaper}
              height={height}
              opacity="1"
              rx="0.035"
              stroke={stampBorder}
              strokeWidth="0.014"
              width={width}
              x={-width / 2}
              y={-height / 2}
            />
            <rect
              fill="none"
              height={height - 0.032}
              opacity="0.68"
              rx="0.026"
              stroke="#d8d0c4"
              strokeWidth="0.006"
              width={width - 0.032}
              x={-width / 2 + 0.016}
              y={-height / 2 + 0.016}
            />
            {peel ? (
              <g>
                <polygon
                  fill="#d8d0c4"
                  opacity="0.95"
                  points={localPoints(peel.points)}
                  stroke={stampBorder}
                  strokeLinejoin="round"
                  strokeWidth="0.008"
                />
                <line
                  opacity="0.72"
                  stroke="#8b8088"
                  strokeLinecap="round"
                  strokeWidth="0.007"
                  x1={peel.crease[0][0]}
                  x2={peel.crease[1][0]}
                  y1={peel.crease[0][1]}
                  y2={peel.crease[1][1]}
                />
              </g>
            ) : null}
            <g transform={`scale(1 ${fmt(textYScale)})`}>
              <text
                dominantBaseline="middle"
                fill={stampInk}
                fontFamily="var(--font-roboto-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
                fontSize={fontSize}
                fontWeight="800"
                letterSpacing={letterSpacing}
                textAnchor="middle"
                y="0.006"
              >
                {stampLabel}
              </text>
            </g>
          </g>
        </g>
      </g>
    );
  };

  const items: { depth: number; els: React.ReactNode[] }[] = [];
  const base = P([0, 0, 0]);
  items.push({
    depth: -1e9,
    els: [
      <ellipse
        key="shadow"
        cx={base[0]}
        cy={base[1]}
        rx={S * 0.52}
        ry={S * 0.2}
        fill="#0a1410"
        opacity="0.2"
      />,
    ],
  });

  rbFaces(S, Hh).forEach((f) => {
    if (rbNormalZ(p, f.n[0], f.n[1], f.n[2], restView, activeView, intermediateView) <= 0.001)
      return;
    const pcs = f.cs.map(P);
    const depth = pcs.reduce((s, q) => s + q[2], 0) / pcs.length;
    const els = [
      <polygon
        key={`f-${f.id}`}
        points={pcs.map(xy).join(' ')}
        fill={tone[f.id]}
        stroke={line}
        strokeLinejoin="round"
        strokeWidth="2.6"
      />,
    ];

    if (f.id === 'front') {
      const st = [
        fp(f.cs, 0.04, 0.9),
        fp(f.cs, 0.96, 0.9),
        fp(f.cs, 0.96, 0.98),
        fp(f.cs, 0.04, 0.98),
      ];
      els.push(<polygon key="stripe" points={st.map(xy).join(' ')} fill={accLite} />);

      const sc = [
        fp(f.cs, 0.16, 0.3),
        fp(f.cs, 0.84, 0.3),
        fp(f.cs, 0.84, 0.84),
        fp(f.cs, 0.16, 0.84),
      ];
      els.push(
        <polygon
          key="screen"
          points={sc.map(xy).join(' ')}
          fill={RB_SCREEN}
          stroke={line}
          strokeLinejoin="round"
          strokeWidth="2.2"
        />
      );
      els.push(
        <polygon key="screenglow" points={sc.map(xy).join(' ')} fill={RB_GLOW} opacity="0.09" />
      );

      [0.42, 0.54, 0.66].forEach((v, i) => {
        const a = fp(f.cs, 0.19, v);
        const b = fp(f.cs, 0.81, v);
        els.push(
          <line
            key={`sl-${i}`}
            x1={a[0]}
            y1={a[1]}
            x2={b[0]}
            y2={b[1]}
            stroke={RB_GLOW}
            strokeWidth="1"
            opacity="0.16"
          />
        );
      });

      const eyeRenderScale = rbEyeRenderScale(form, restView, activeView, intermediateView);
      const ew = (RB_CHEVRON_EYE_HALF_WIDTH_WORLD * eyeRenderScale) / S;
      const eh = (RB_CHEVRON_EYE_HALF_HEIGHT_WORLD * eyeRenderScale) / Hh;
      const v0 = 0.6;
      const squareEye = (uc: number, scale = 1) => {
        const halfWorld = RB_SQUARE_EYE_HALF_WORLD * eyeRenderScale * scale;
        const uHalf = halfWorld / S;
        const vHalf = halfWorld / Hh;

        return [
          fp(f.cs, uc - uHalf, v0 - vHalf),
          fp(f.cs, uc + uHalf, v0 - vHalf),
          fp(f.cs, uc + uHalf, v0 + vHalf),
          fp(f.cs, uc - uHalf, v0 + vHalf),
        ]
          .map(xy)
          .join(' ');
      };
      const chev = (uc: number) => {
        const lo = eyeDir === 'down' ? v0 + eh : v0 - eh;
        const mi = eyeDir === 'down' ? v0 - eh : v0 + eh;
        const a = fp(f.cs, uc - ew, lo);
        const m = fp(f.cs, uc, mi);
        const c = fp(f.cs, uc + ew, lo);
        return `M ${a[0].toFixed(2)} ${a[1].toFixed(2)} L ${m[0].toFixed(2)} ${m[1].toFixed(2)} L ${c[0].toFixed(2)} ${c[1].toFixed(2)}`;
      };

      [0.38, 0.62].forEach((uc, i) => {
        if (eyeDir === 'square') {
          els.push(
            <polygon key={`eg-${i}`} points={squareEye(uc, 1.6)} fill={RB_GLOW} opacity="0.22" />
          );
          els.push(
            <polygon key={`ec-${i}`} points={squareEye(uc)} fill={RB_GLOW} opacity="0.94" />
          );
          return;
        }

        els.push(
          <path
            key={`eg-${i}`}
            d={chev(uc)}
            fill="none"
            stroke={RB_GLOW}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={eyeGlowStroke}
            opacity="0.26"
          />
        );
        els.push(
          <path
            key={`ec-${i}`}
            d={chev(uc)}
            fill="none"
            stroke={RB_GLOW}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={eyeCoreStroke}
          />
        );
      });
    } else if (f.id === 'right') {
      [0.24, 0.36, 0.48].forEach((v, i) => {
        const a = fp(f.cs, 0.55, v);
        const b = fp(f.cs, 0.85, v);
        els.push(
          <line
            key={`vt-${i}`}
            x1={a[0]}
            y1={a[1]}
            x2={b[0]}
            y2={b[1]}
            stroke={line}
            strokeLinecap="round"
            strokeWidth="2.2"
            opacity="0.5"
          />
        );
      });

      [0.28, 0.46, 0.64].forEach((u, i) => {
        const q = fp(f.cs, u, 0.74);
        els.push(
          <circle
            key={`bt-${i}`}
            cx={q[0]}
            cy={q[1]}
            r="3"
            fill={i === 1 ? RB_GLOW : dark}
            stroke={line}
            strokeWidth="1.2"
          />
        );
      });
    } else if (f.id === 'left') {
      const a = fp(f.cs, 0.5, 0.08);
      const b = fp(f.cs, 0.5, 0.92);
      els.push(
        <line
          key="lpanel"
          x1={a[0]}
          y1={a[1]}
          x2={b[0]}
          y2={b[1]}
          stroke={line}
          strokeWidth="1.5"
          opacity="0.4"
        />
      );
      const planeStamp = makePlaneStamp(f.cs, 'stamp', 0.5, 0.58);
      if (planeStamp) els.push(planeStamp);
    }

    items.push({ depth, els });
  });

  if (resolvedAntenna !== 'none') {
    const topC: Point3 = [0, Hh, 0];
    if (resolvedAntenna === 'twin') {
      [-22, 22].forEach((dx, i) => {
        const baseP = P([dx * 0.6, Hh, 0]);
        const tipP = P([dx, Hh + 28, 0]);
        items.push({
          depth: tipP[2],
          els: [
            <line
              key={`tw-${i}`}
              x1={baseP[0]}
              y1={baseP[1]}
              x2={tipP[0]}
              y2={tipP[1]}
              stroke={line}
              strokeLinecap="round"
              strokeWidth="3"
            />,
            <circle
              key={`twg-${i}`}
              cx={tipP[0]}
              cy={tipP[1]}
              r="8"
              fill={RB_GLOW}
              opacity="0.3"
            />,
            <circle
              key={`twb-${i}`}
              cx={tipP[0]}
              cy={tipP[1]}
              r="5"
              fill={RB_GLOW}
              stroke={line}
              strokeWidth="2"
            />,
          ],
        });
      });
    } else {
      const rodLen = resolvedAntenna === 'rod' ? 50 : resolvedAntenna === 'bigball' ? 30 : 32;
      const ballR = resolvedAntenna === 'bigball' ? 9 : 6;
      const baseP = P(topC);
      const tipP = P([0, Hh + rodLen, 0]);
      items.push({
        depth: tipP[2],
        els: [
          <line
            key="ar"
            x1={baseP[0]}
            y1={baseP[1]}
            x2={tipP[0]}
            y2={tipP[1]}
            stroke={line}
            strokeLinecap="round"
            strokeWidth="3.2"
          />,
          <circle key="ag" cx={tipP[0]} cy={tipP[1]} r={ballR + 4} fill={RB_GLOW} opacity="0.28" />,
          <circle
            key="ab"
            cx={tipP[0]}
            cy={tipP[1]}
            r={ballR}
            fill={RB_GLOW}
            stroke={line}
            strokeWidth="2.2"
          />,
        ],
      });
    }
  }

  items.sort((m, n) => m.depth - n.depth);
  return items.flatMap((it) => it.els);
}

type RotatingBotProps = {
  accent?: string;
  form?: FormName;
  eyeDir?: BotEyeStyle;
  antenna?: BotAntennaStyle;
  active?: boolean;
  fixed?: number;
  className?: string;
  stamp?: BotStamp;
  restView?: Partial<BotView>;
  activeView?: Partial<BotView>;
  intermediateView?: Partial<BotView>;
  turnRate?: number;
};

export function RotatingBot({
  accent = '#2f9d97',
  form = 'unit',
  eyeDir = 'up',
  antenna,
  active,
  fixed,
  className,
  stamp,
  restView,
  activeView,
  intermediateView,
  turnRate = 0.2,
}: RotatingBotProps) {
  const controlled = active !== undefined;
  const [p, setP] = useState(0);
  const pref = useRef(0);
  const target = useRef(0);
  const raf = useRef(0);

  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const tick = () => {
    const d = target.current - pref.current;
    if (Math.abs(d) < 0.004) {
      pref.current = target.current;
      setP(pref.current);
      raf.current = 0;
      return;
    }

    pref.current += d * Math.min(Math.max(turnRate, 0.01), 1);
    setP(pref.current);
    raf.current = requestAnimationFrame(tick);
  };

  const goTo = (t: number) => {
    target.current = t;
    if (reduced) {
      if (raf.current) {
        cancelAnimationFrame(raf.current);
        raf.current = 0;
      }
      pref.current = t;
      setP(t);
      return;
    }

    if (!raf.current) raf.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    if (controlled) goTo(active ? 1 : 0);
    // goTo closes over refs plus the current reduced-motion media query; rerunning on
    // every render would restart the turn animation while hover state is unchanged.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, controlled]);

  useEffect(
    () => () => {
      if (raf.current) {
        cancelAnimationFrame(raf.current);
        raf.current = 0;
      }
    },
    []
  );

  const vb = formViewBox(form, restView, activeView, intermediateView, antenna);
  const pose = fixed !== undefined ? fixed : p;
  const handlers =
    controlled || fixed !== undefined
      ? {}
      : {
          onPointerEnter: () => goTo(1),
          onPointerLeave: () => goTo(0),
          onFocus: () => goTo(1),
          onBlur: () => goTo(0),
        };

  return (
    <svg
      aria-label="Droid teammate"
      className={['creature-svg', 'bot', className].filter(Boolean).join(' ')}
      role="img"
      style={{ overflow: 'visible' }}
      viewBox={`${vb.minX.toFixed(2)} ${vb.minY.toFixed(2)} ${vb.w.toFixed(2)} ${vb.h.toFixed(2)}`}
      {...handlers}
    >
      {rbBotElements(
        accent,
        form,
        eyeDir,
        pose,
        stamp,
        restView,
        activeView,
        intermediateView,
        antenna
      )}
    </svg>
  );
}
