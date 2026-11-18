import { describe, expect, it } from 'vitest';
import { COSMETIC_PRODUCTS } from '../../shared/cosmetics';
import { getSnakeSkin, resolveSnakePalette, SNAKE_SKINS } from './skins';

describe('snake skins', () => {
  it('defines a renderable skin for every catalog product', () => {
    expect(Object.keys(SNAKE_SKINS).sort()).toEqual(
      COSMETIC_PRODUCTS.map((product) => product.id).sort(),
    );
    for (const product of COSMETIC_PRODUCTS) {
      const skin = getSnakeSkin(product.id);
      expect(skin.name).toBe(product.name);
      expect(skin.palette.head).toMatch(/^#[0-9a-f]{6}$/i);
      expect(skin.palette.body).toMatch(/^#[0-9a-f]{6}$/i);
      expect(skin.palette.eye).not.toBe(skin.palette.body);
    }
  });

  it('preserves normal palettes and applies readable gameplay-state tints', () => {
    const skin = getSnakeSkin('wrenbound');
    expect(resolveSnakePalette(skin, 'normal', false)).toBe(skin.palette);
    expect(resolveSnakePalette(skin, 'powered', false)).toMatchObject({
      head: '#ffdc46',
      body: '#f49b33',
    });
    expect(resolveSnakePalette(skin, 'recovery', false)).toMatchObject({
      head: '#65deff',
      body: '#309de0',
    });
    expect(resolveSnakePalette(skin, 'recovery', true)).toMatchObject({
      head: '#ffffff',
      body: '#d2f6ff',
    });
  });

  it('keeps the first drop separate from future previews', () => {
    expect(COSMETIC_PRODUCTS.filter((product) => product.release === 'launch').map((product) => product.id))
      .toEqual(['wrenbound', 'embercoil', 'phantom-royal', 'bone-serpent']);
    expect(COSMETIC_PRODUCTS.filter((product) => product.release === 'future').map((product) => product.id))
      .toEqual(['frostfang', 'neon-blurple']);
  });
});
