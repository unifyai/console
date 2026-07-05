export const MIN_FLOATING_WIDTH = 200;
export const MIN_FLOATING_HEIGHT = 160;

export const CALL_DEFAULT_FLOATING_WIDTH = 240;
export const CALL_DEFAULT_FLOATING_HEIGHT = 280;

export const CHAT_DEFAULT_FLOATING_WIDTH = 380;
export const CHAT_DEFAULT_FLOATING_HEIGHT = 520;

export type FloatingPoint = { x: number; y: number };
export type FloatingSize = { width: number; height: number };

export type FloatingGeometry = {
  pos: FloatingPoint;
  size: FloatingSize;
};

export const EMPTY_FLOATING_GEOMETRY: FloatingGeometry = {
  pos: { x: 0, y: 0 },
  size: { width: 0, height: 0 },
};

export type FloatingGeometryPreset = 'call' | 'chat';

const PRESET_DEFAULTS: Record<FloatingGeometryPreset, FloatingSize> = {
  call: { width: CALL_DEFAULT_FLOATING_WIDTH, height: CALL_DEFAULT_FLOATING_HEIGHT },
  chat: { width: CHAT_DEFAULT_FLOATING_WIDTH, height: CHAT_DEFAULT_FLOATING_HEIGHT },
};

export function getDefaultFloatingGeometry(
  preset: FloatingGeometryPreset = 'call'
): FloatingGeometry {
  if (typeof window === 'undefined') return EMPTY_FLOATING_GEOMETRY;

  const defaults = PRESET_DEFAULTS[preset];
  const width = Math.min(defaults.width, Math.max(MIN_FLOATING_WIDTH, window.innerWidth - 32));
  const height = Math.min(defaults.height, Math.max(MIN_FLOATING_HEIGHT, window.innerHeight - 32));
  return {
    pos: {
      x: Math.max(16, window.innerWidth - width - 16),
      y: Math.max(16, window.innerHeight - height - 16),
    },
    size: { width, height },
  };
}
