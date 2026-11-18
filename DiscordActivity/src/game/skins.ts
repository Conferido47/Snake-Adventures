import {
  COSMETIC_PRODUCTS,
  type CosmeticId,
  type CosmeticProduct,
} from '../../shared/cosmetics';
import type { Point, Rect } from './contracts';

export type SnakeVisualState = 'normal' | 'powered' | 'recovery';

export interface SnakePalette {
  head: string;
  body: string;
  accent: string;
  highlight: string;
  outline: string;
  eye: string;
}

type SnakePattern =
  | 'classic'
  | 'wrenbound'
  | 'embercoil'
  | 'phantomRoyal'
  | 'boneSerpent'
  | 'frostfang'
  | 'neonBlurple';

export type SnakeSkinDefinition = CosmeticProduct & {
  pattern: SnakePattern;
  palette: SnakePalette;
};

const PRODUCT_BY_ID = new Map(COSMETIC_PRODUCTS.map((product) => [product.id, product]));

export const SNAKE_SKINS: Readonly<Record<CosmeticId, SnakeSkinDefinition>> = {
  classic: createSkin('classic', 'classic', {
    head: '#aceb5d',
    body: '#66c35f',
    accent: '#398f77',
    highlight: '#d7ff8d',
    outline: '#2b6f45',
    eye: '#152b1f',
  }),
  wrenbound: createSkin('wrenbound', 'wrenbound', {
    head: '#bc843a',
    body: '#1a5e5b',
    accent: '#be3030',
    highlight: '#55b39e',
    outline: '#132f31',
    eye: '#ffd15b',
  }),
  embercoil: createSkin('embercoil', 'embercoil', {
    head: '#c94427',
    body: '#292126',
    accent: '#ff7a1a',
    highlight: '#ffc94f',
    outline: '#100e12',
    eye: '#ffe18a',
  }),
  'phantom-royal': createSkin('phantom-royal', 'phantomRoyal', {
    head: '#9e54d2',
    body: '#60358f',
    accent: '#ffd34c',
    highlight: '#d9a3ff',
    outline: '#2c1748',
    eye: '#f7efff',
  }),
  'bone-serpent': createSkin('bone-serpent', 'boneSerpent', {
    head: '#ddd6b9',
    body: '#bcb69e',
    accent: '#3b3a3d',
    highlight: '#f4efd9',
    outline: '#29282c',
    eye: '#d94538',
  }),
  frostfang: createSkin('frostfang', 'frostfang', {
    head: '#bdeef4',
    body: '#68bfd3',
    accent: '#e9fdff',
    highlight: '#d9faff',
    outline: '#28637f',
    eye: '#17334f',
  }),
  'neon-blurple': createSkin('neon-blurple', 'neonBlurple', {
    head: '#7c83ff',
    body: '#303a8f',
    accent: '#57f2cc',
    highlight: '#d09cff',
    outline: '#11172e',
    eye: '#f4ffff',
  }),
};

const POWERED_PALETTE: SnakePalette = {
  head: '#ffdc46',
  body: '#f49b33',
  accent: '#fff0a1',
  highlight: '#fff7cf',
  outline: '#8c491b',
  eye: '#38210f',
};

const RECOVERY_PALETTE: SnakePalette = {
  head: '#65deff',
  body: '#309de0',
  accent: '#d2f6ff',
  highlight: '#effcff',
  outline: '#17527a',
  eye: '#0b2b3a',
};

export function getSnakeSkin(id: CosmeticId): SnakeSkinDefinition {
  return SNAKE_SKINS[id];
}

export function resolveSnakePalette(
  skin: SnakeSkinDefinition,
  state: SnakeVisualState,
  flash: boolean,
): SnakePalette {
  const base = state === 'recovery'
    ? RECOVERY_PALETTE
    : state === 'powered'
      ? POWERED_PALETTE
      : skin.palette;
  if (!flash) {
    return base;
  }
  return {
    ...base,
    head: '#ffffff',
    body: state === 'recovery' ? '#d2f6ff' : '#ffeea6',
    highlight: '#ffffff',
  };
}

export function drawSnakePiece(
  context: CanvasRenderingContext2D,
  bounds: Rect,
  skin: SnakeSkinDefinition,
  options: {
    index: number;
    isHead: boolean;
    direction: Point;
    state: SnakeVisualState;
    flash: boolean;
  },
): void {
  const palette = resolveSnakePalette(skin, options.state, options.flash);
  context.save();
  context.translate(bounds.x, bounds.y);
  context.scale(bounds.width / 18, bounds.height / 18);

  if (options.isHead) {
    context.translate(9, 9);
    context.rotate(directionAngle(options.direction));
    context.translate(-9, -9);
    drawHead(context, skin.pattern, palette);
  } else {
    drawBody(context, skin.pattern, palette, options.index);
  }

  context.restore();
}

export function drawSnakePreview(canvas: HTMLCanvasElement, skinId: CosmeticId): void {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }
  const logicalWidth = 320;
  const logicalHeight = 136;
  const ratio = Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(logicalWidth * ratio);
  canvas.height = Math.round(logicalHeight * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, logicalWidth, logicalHeight);

  const gradient = context.createLinearGradient(0, 0, logicalWidth, logicalHeight);
  gradient.addColorStop(0, '#101d23');
  gradient.addColorStop(1, '#1e1830');
  context.fillStyle = gradient;
  context.fillRect(0, 0, logicalWidth, logicalHeight);
  for (let y = 0; y < logicalHeight; y += 24) {
    for (let x = 0; x < logicalWidth; x += 24) {
      context.fillStyle = (x / 24 + y / 24) % 2 === 0
        ? 'rgb(112 224 201 / 0.045)'
        : 'rgb(255 255 255 / 0.018)';
      context.fillRect(x, y, 24, 24);
    }
  }

  const skin = getSnakeSkin(skinId);
  const size = 36;
  const startX = 43;
  const y = 50;
  for (let index = 6; index >= 0; index -= 1) {
    drawSnakePiece(
      context,
      { x: startX + (6 - index) * 34, y, width: size, height: size },
      skin,
      {
        index,
        isHead: index === 0,
        direction: { x: 1, y: 0 },
        state: 'normal',
        flash: false,
      },
    );
  }
}

function createSkin(
  id: CosmeticId,
  pattern: SnakePattern,
  palette: SnakePalette,
): SnakeSkinDefinition {
  const product = PRODUCT_BY_ID.get(id);
  if (!product) {
    throw new Error(`Missing cosmetic product ${id}.`);
  }
  return { ...product, pattern, palette };
}

function drawBody(
  context: CanvasRenderingContext2D,
  pattern: SnakePattern,
  palette: SnakePalette,
  index: number,
): void {
  fillRect(context, palette.outline, 0, 0, 18, 18);
  fillRect(context, palette.body, 1, 1, 16, 16);
  fillRect(context, palette.highlight, 2, 2, 13, 2);

  switch (pattern) {
    case 'classic':
      fillRect(context, palette.accent, 2, 5, 3, 10);
      break;
    case 'wrenbound':
      fillRect(context, palette.accent, 1, 7, 16, 4);
      fillRect(context, palette.highlight, index % 2 === 0 ? 12 : 3, 3, 3, 3);
      break;
    case 'embercoil':
      fillRect(context, palette.accent, 7, 3, 3, 5);
      fillRect(context, palette.accent, 9, 7, 4, 3);
      fillRect(context, palette.highlight, 11, 9, 2, 5);
      fillRect(context, palette.accent, 5, 13, 7, 2);
      break;
    case 'phantomRoyal':
      fillRect(context, palette.accent, 1, index % 2 === 0 ? 5 : 11, 16, 3);
      fillRect(context, palette.highlight, 7, 6, 4, 6);
      break;
    case 'boneSerpent':
      fillRect(context, palette.accent, 7, 1, 4, 16);
      fillRect(context, palette.highlight, 3, 5, 12, 3);
      fillRect(context, palette.highlight, 3, 11, 12, 3);
      break;
    case 'frostfang':
      fillRect(context, palette.accent, 3, 3, 5, 2);
      fillRect(context, palette.accent, 7, 5, 2, 5);
      fillRect(context, palette.outline, 9, 9, 5, 2);
      fillRect(context, palette.accent, 13, 10, 2, 5);
      break;
    case 'neonBlurple':
      fillRect(context, palette.accent, 2, 8, 14, 2);
      fillRect(context, palette.accent, index % 2 === 0 ? 4 : 12, 4, 2, 10);
      fillRect(context, palette.highlight, index % 2 === 0 ? 12 : 4, 12, 3, 3);
      break;
  }
}

function drawHead(
  context: CanvasRenderingContext2D,
  pattern: SnakePattern,
  palette: SnakePalette,
): void {
  fillRect(context, palette.outline, 0, 0, 18, 18);
  fillRect(context, palette.head, 1, 1, 16, 16);
  fillRect(context, palette.highlight, 2, 2, 12, 2);

  switch (pattern) {
    case 'classic':
      fillRect(context, palette.accent, 2, 5, 3, 10);
      break;
    case 'wrenbound':
      fillRect(context, palette.body, 1, 1, 6, 16);
      fillRect(context, palette.accent, 2, 12, 14, 4);
      fillRect(context, palette.highlight, 8, 3, 7, 3);
      break;
    case 'embercoil':
      fillRect(context, palette.accent, 7, 1, 3, 6);
      fillRect(context, palette.highlight, 9, 6, 5, 2);
      fillRect(context, palette.accent, 12, 8, 2, 6);
      break;
    case 'phantomRoyal':
      fillRect(context, palette.accent, 10, 2, 3, 14);
      fillRect(context, palette.accent, 13, 2, 4, 3);
      fillRect(context, palette.accent, 13, 7, 5, 4);
      fillRect(context, palette.accent, 13, 13, 4, 3);
      fillRect(context, palette.highlight, 4, 6, 5, 7);
      break;
    case 'boneSerpent':
      fillRect(context, palette.accent, 10, 3, 5, 5);
      fillRect(context, palette.accent, 10, 10, 5, 5);
      fillRect(context, palette.accent, 14, 7, 3, 4);
      fillRect(context, palette.accent, 7, 8, 2, 3);
      fillRect(context, palette.highlight, 3, 3, 5, 3);
      break;
    case 'frostfang':
      fillRect(context, palette.accent, 2, 0, 4, 5);
      fillRect(context, palette.accent, 7, 2, 3, 4);
      fillRect(context, palette.outline, 11, 4, 4, 2);
      fillRect(context, palette.accent, 13, 6, 2, 6);
      break;
    case 'neonBlurple':
      fillRect(context, palette.accent, 2, 8, 14, 2);
      fillRect(context, palette.accent, 8, 2, 2, 14);
      fillRect(context, palette.highlight, 12, 12, 3, 3);
      break;
  }

  fillRect(context, palette.eye, 12, 4, 3, 3);
  fillRect(context, palette.eye, 12, 11, 3, 3);
  fillRect(context, '#ffffff', 13, 4, 1, 1);
  fillRect(context, '#ffffff', 13, 11, 1, 1);
}

function directionAngle(direction: Point): number {
  if (direction.x < 0) {
    return Math.PI;
  }
  if (direction.y > 0) {
    return Math.PI / 2;
  }
  if (direction.y < 0) {
    return -Math.PI / 2;
  }
  return 0;
}

function fillRect(
  context: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  context.fillStyle = color;
  context.fillRect(x, y, width, height);
}
