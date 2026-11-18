import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = resolve(projectRoot, 'src');

const glyphRows = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  6: ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  ':': ['00000', '00100', '00100', '00000', '00100', '00100', '00000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '00100', '00100'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '<': ['00010', '00100', '01000', '10000', '01000', '00100', '00010'],
  '>': ['01000', '00100', '00010', '00001', '00010', '00100', '01000'],
  '?': ['01110', '10001', '00001', '00010', '00100', '00000', '00100'],
  '=': ['00000', '11111', '00000', '11111', '00000', '00000', '00000'],
};

const glyphOrder = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:-+/.!<>?=';

function emptyTile() {
  return Array.from({ length: 8 }, () => Array(8).fill(0));
}

function tileFromGlyph(glyph) {
  const tile = emptyTile();
  glyphRows[glyph].forEach((row, y) => {
    [...row].forEach((pixel, x) => {
      if (pixel === '1') tile[y][x + 1] = 3;
    });
  });
  return tile;
}

function tileFromStrings(rows) {
  if (rows.length !== 8 || rows.some((row) => row.length !== 8)) {
    throw new Error('Tiles must contain eight rows of eight pixels.');
  }
  return rows.map((row) => [...row].map(Number));
}

function rotateClockwise(tile) {
  return tile.map((_, y) => tile.map((row) => row[y]).reverse());
}

function rotateCounterClockwise(tile) {
  return rotateClockwise(rotateClockwise(rotateClockwise(tile)));
}

function rotate180(tile) {
  return rotateClockwise(rotateClockwise(tile));
}

function encodeTile(tile) {
  return tile.flatMap((row) => {
    let low = 0;
    let high = 0;
    row.forEach((pixel, x) => {
      const bit = 1 << (7 - x);
      if (pixel & 1) low |= bit;
      if (pixel & 2) high |= bit;
    });
    return [low, high];
  });
}

function drawRect(canvas, x, y, width, height, color) {
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) {
      if (py >= 0 && py < canvas.length && px >= 0 && px < canvas[0].length) {
        canvas[py][px] = color;
      }
    }
  }
}

function createBossTiles() {
  const canvas = Array.from({ length: 24 }, () => Array(24).fill(0));
  drawRect(canvas, 5, 7, 14, 14, 1);
  drawRect(canvas, 7, 8, 10, 12, 2);
  drawRect(canvas, 8, 3, 8, 6, 1);
  drawRect(canvas, 9, 4, 6, 5, 2);
  drawRect(canvas, 5, 2, 3, 6, 3);
  drawRect(canvas, 16, 2, 3, 6, 3);
  drawRect(canvas, 10, 1, 4, 4, 3);
  drawRect(canvas, 9, 6, 2, 2, 3);
  drawRect(canvas, 13, 6, 2, 2, 3);
  drawRect(canvas, 5, 14, 14, 3, 3);
  drawRect(canvas, 2, 10, 4, 3, 2);
  drawRect(canvas, 18, 10, 4, 3, 2);
  drawRect(canvas, 3, 20, 4, 3, 2);
  drawRect(canvas, 10, 20, 4, 4, 3);
  drawRect(canvas, 17, 20, 4, 3, 2);

  const tiles = [];
  for (let tileY = 0; tileY < 3; tileY += 1) {
    for (let tileX = 0; tileX < 3; tileX += 1) {
      tiles.push(canvas
        .slice(tileY * 8, tileY * 8 + 8)
        .map((row) => row.slice(tileX * 8, tileX * 8 + 8)));
    }
  }
  return tiles;
}

const blank = emptyTile();
const heart = tileFromStrings([
  '00000000',
  '01101100',
  '13313310',
  '13333310',
  '01333100',
  '00131000',
  '00010000',
  '00000000',
]);

const commonTiles = [blank, ...[...glyphOrder].map(tileFromGlyph), heart];
if (commonTiles.length !== 48) throw new Error(`Expected 48 font tiles, got ${commonTiles.length}.`);

commonTiles.push(
  tileFromStrings(['00000000', '00000000', '00000000', '00010000', '00000000', '00000000', '00000000', '00000000']),
  tileFromStrings(['00000000', '00000000', '00000000', '00000000', '00000000', '00000000', '00000010', '00000000']),
  blank,
  blank,
  blank,
  blank,
  blank,
  blank,
  tileFromStrings(['00010000', '00121000', '01222100', '12222210', '12232210', '01222100', '00111000', '00010000']),
  tileFromStrings(['00030000', '00323000', '03222300', '32222230', '32332330', '03222300', '00333000', '00030000']),
  tileFromStrings(['00011000', '00122100', '01233210', '01222210', '00133100', '00122100', '01200210', '00000000']),
  tileFromStrings(['00011000', '00133100', '01322310', '01333310', '00122100', '00133100', '01300310', '00000000']),
  ...createBossTiles(),
  tileFromStrings(['00000000', '30000003', '03300330', '00333300', '00333300', '03300330', '30000003', '00000000']),
  tileFromStrings(['00033000', '00333300', '03033030', '30033003', '30033003', '03033030', '00333300', '00033000']),
  tileFromStrings(['00000000', '10000001', '01100110', '00111100', '00111100', '01100110', '10000001', '00000000']),
  tileFromStrings(['00011000', '00111100', '01011010', '10011001', '10011001', '01011010', '00111100', '00011000']),
  tileFromStrings(['00030000', '00303000', '03030300', '30303030', '03030300', '00303000', '00030000', '00000000']),
  tileFromStrings(['00000000', '00030000', '00333000', '03333300', '00333000', '00030000', '00000000', '00000000']),
);

const skinDefinitions = [
  {
    name: 'CLASSIC',
    bodyA: ['01111110', '12222221', '12333221', '12222221', '12222221', '12322221', '12222221', '01111110'],
    bodyB: ['01111110', '12222221', '12223321', '12222221', '12222221', '12223221', '12222221', '01111110'],
    head: ['00111100', '01222210', '12332221', '12222331', '12222221', '12222331', '01222210', '00111100'],
  },
  {
    name: 'WRENBOUND',
    bodyA: ['01111110', '12222221', '12222221', '13333331', '13333331', '12222221', '12223321', '01111110'],
    bodyB: ['01111110', '12222221', '12332221', '13333331', '13333331', '12222221', '12222221', '01111110'],
    head: ['00111100', '01222210', '12333221', '12222331', '13333331', '13333331', '01222210', '00111100'],
  },
  {
    name: 'EMBERCOIL',
    bodyA: ['01111110', '12222221', '12233221', '12223321', '12332221', '12222321', '12222221', '01111110'],
    bodyB: ['01111110', '12223221', '12232321', '12322221', '12223221', '12232321', '12222221', '01111110'],
    head: ['00111100', '01223210', '12332221', '12232331', '12223221', '12322331', '01222210', '00111100'],
  },
  {
    name: 'PHANTOM ROYAL',
    bodyA: ['01111110', '12222221', '13333331', '12222221', '12222221', '13333331', '12222221', '01111110'],
    bodyB: ['01111110', '12333321', '13222231', '13222231', '13222231', '13222231', '12333321', '01111110'],
    head: ['00133100', '01333310', '12332221', '12222331', '12222221', '12222331', '01222210', '00111100'],
  },
  {
    name: 'BONE SERPENT',
    bodyA: ['01111110', '12233221', '12233221', '13333331', '12233221', '12233221', '12233221', '01111110'],
    bodyB: ['01111110', '12322321', '12233221', '13333331', '12233221', '12322321', '12233221', '01111110'],
    head: ['00111100', '01333310', '13333331', '13322331', '13333331', '13322331', '01333310', '00111100'],
  },
  {
    name: 'FROSTFANG',
    bodyA: ['01111110', '12332221', '12233221', '12223321', '12322221', '12223221', '12222321', '01111110'],
    bodyB: ['01111110', '12222321', '12223221', '12332221', '12223321', '12233221', '12322221', '01111110'],
    head: ['00313300', '01333210', '12332221', '12222331', '12332221', '12222331', '01222210', '00111100'],
  },
  {
    name: 'NEON BLURPLE',
    bodyA: ['01111110', '12222221', '12233221', '13333331', '12233221', '12233221', '12233221', '01111110'],
    bodyB: ['01111110', '12233221', '12233221', '12233221', '13333331', '12233221', '12233221', '01111110'],
    head: ['00111100', '01233210', '12333321', '13333331', '12333321', '12233331', '01233210', '00111100'],
  },
];

const skinTiles = skinDefinitions.map((skin) => {
  const headRight = tileFromStrings(skin.head);
  return [
    tileFromStrings(skin.bodyA),
    tileFromStrings(skin.bodyB),
    headRight,
    rotate180(headRight),
    rotateCounterClockwise(headRight),
    rotateClockwise(headRight),
  ];
});

const commonConstants = [
  ['TILE_BLANK', 0], ['TILE_FONT_A', 1], ['TILE_FONT_0', 27],
  ['TILE_COLON', 37], ['TILE_DASH', 38], ['TILE_PLUS', 39], ['TILE_SLASH', 40],
  ['TILE_DOT', 41], ['TILE_BANG', 42], ['TILE_LEFT', 43], ['TILE_RIGHT', 44],
  ['TILE_QUESTION', 45], ['TILE_EQUAL', 46], ['TILE_LIFE', 47],
  ['TILE_FLOOR_A', 48], ['TILE_FLOOR_B', 49],
  ['TILE_SNAKE_BODY_A', 50], ['TILE_SNAKE_BODY_B', 51],
  ['TILE_SNAKE_HEAD_RIGHT', 52], ['TILE_SNAKE_HEAD_LEFT', 53],
  ['TILE_SNAKE_HEAD_UP', 54], ['TILE_SNAKE_HEAD_DOWN', 55],
  ['TILE_FRUIT', 56], ['TILE_PHANTOM', 57], ['TILE_WREN', 58], ['TILE_WREN_VULNERABLE', 59],
  ['TILE_BOSS_TOP_LEFT', 60], ['TILE_BOSS_TOP', 61], ['TILE_BOSS_TOP_RIGHT', 62],
  ['TILE_BOSS_LEFT', 63], ['TILE_BOSS_CENTER', 64], ['TILE_BOSS_RIGHT', 65],
  ['TILE_BOSS_BOTTOM_LEFT', 66], ['TILE_BOSS_BOTTOM', 67], ['TILE_BOSS_BOTTOM_RIGHT', 68],
  ['TILE_SLASH_HORIZONTAL', 69], ['TILE_SLASH_VERTICAL', 70],
  ['TILE_WARNING_HORIZONTAL', 71], ['TILE_WARNING_VERTICAL', 72],
  ['TILE_SPARKLE', 73], ['TILE_GLOW', 74],
];

if (commonTiles.length !== 75) throw new Error(`Expected 75 common tiles, got ${commonTiles.length}.`);

function formatBytes(bytes, indent = '    ') {
  const lines = [];
  for (let index = 0; index < bytes.length; index += 16) {
    lines.push(`${indent}${bytes.slice(index, index + 16).map((value) => `0x${value.toString(16).padStart(2, '0')}`).join(', ')},`);
  }
  return lines.join('\n');
}

const commonBytes = commonTiles.flatMap(encodeTile);
const skinBytes = skinTiles.map((tiles) => tiles.flatMap(encodeTile));

const header = `#ifndef SNAKE_ADVENTURES_ASSETS_H\n#define SNAKE_ADVENTURES_ASSETS_H\n\n#include <gb/cgb.h>\n#include <stdint.h>\n\n#define SKIN_COUNT 7u\n#define SNAKE_TILE_COUNT 6u\n#define COMMON_TILE_COUNT ${commonTiles.length}u\n\n${commonConstants.map(([name, value]) => `#define ${name} ${value}u`).join('\n')}\n\nextern const uint8_t common_tiles[COMMON_TILE_COUNT * 16u];\nextern const uint8_t snake_skin_tiles[SKIN_COUNT][SNAKE_TILE_COUNT * 16u];\nextern const palette_color_t skin_palettes[SKIN_COUNT][4];\nextern const palette_color_t powered_palette[4];\nextern const palette_color_t recovery_palette[4];\nextern const palette_color_t world_palettes[7][4];\nextern const char skin_names[SKIN_COUNT][14];\n\n#endif\n`;

const source = `#pragma bank 1\n\n#include "assets.h"\n\nconst uint8_t common_tiles[COMMON_TILE_COUNT * 16u] = {\n${formatBytes(commonBytes)}\n};\n\nconst uint8_t snake_skin_tiles[SKIN_COUNT][SNAKE_TILE_COUNT * 16u] = {\n${skinBytes.map((bytes) => `  {\n${formatBytes(bytes)}\n  },`).join('\n')}\n};\n\nconst palette_color_t skin_palettes[SKIN_COUNT][4] = {\n  { RGBHTML(0x101b20), RGBHTML(0x2b6f45), RGBHTML(0x66c35f), RGBHTML(0xd7ff8d) },\n  { RGBHTML(0x101b20), RGBHTML(0x132f31), RGBHTML(0x1a5e5b), RGBHTML(0xbc843a) },\n  { RGBHTML(0x101b20), RGBHTML(0x100e12), RGBHTML(0xc94427), RGBHTML(0xffc94f) },\n  { RGBHTML(0x101b20), RGBHTML(0x2c1748), RGBHTML(0x60358f), RGBHTML(0xffd34c) },\n  { RGBHTML(0x101b20), RGBHTML(0x29282c), RGBHTML(0xbcb69e), RGBHTML(0xf4efd9) },\n  { RGBHTML(0x101b20), RGBHTML(0x28637f), RGBHTML(0x68bfd3), RGBHTML(0xe9fdff) },\n  { RGBHTML(0x101b20), RGBHTML(0x11172e), RGBHTML(0x303a8f), RGBHTML(0x57f2cc) },\n};\n\nconst palette_color_t powered_palette[4] = {\n  RGBHTML(0x101b20), RGBHTML(0x8c491b), RGBHTML(0xf49b33), RGBHTML(0xfff0a1),\n};\n\nconst palette_color_t recovery_palette[4] = {\n  RGBHTML(0x101b20), RGBHTML(0x17527a), RGBHTML(0x309de0), RGBHTML(0xd2f6ff),\n};\n\nconst palette_color_t world_palettes[7][4] = {\n  { RGBHTML(0x101b20), RGBHTML(0x314047), RGBHTML(0x55b39e), RGBHTML(0xf4f1d5) },\n  { RGBHTML(0x101b20), RGBHTML(0x17262c), RGBHTML(0x26383e), RGBHTML(0x344b50) },\n  { RGBHTML(0x101b20), RGBHTML(0x5e251f), RGBHTML(0xd84a35), RGBHTML(0xffd07a) },\n  { RGBHTML(0x101b20), RGBHTML(0x4b236f), RGBHTML(0xa357cf), RGBHTML(0xffd34c) },\n  { RGBHTML(0x101b20), RGBHTML(0x1a5e5b), RGBHTML(0xbc843a), RGBHTML(0xffd15b) },\n  { RGBHTML(0x101b20), RGBHTML(0x2c1748), RGBHTML(0x66506f), RGBHTML(0xd6b45a) },\n  { RGBHTML(0x101b20), RGBHTML(0x773248), RGBHTML(0xe65b72), RGBHTML(0xffd0dc) },\n};\n\nconst char skin_names[SKIN_COUNT][14] = {\n${skinDefinitions.map((skin) => `  "${skin.name}",`).join('\n')}\n};\n`;

writeFileSync(resolve(sourceRoot, 'assets.h'), header);
writeFileSync(resolve(sourceRoot, 'assets.c'), source);
