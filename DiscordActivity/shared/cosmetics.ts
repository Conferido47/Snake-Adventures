export const COSMETIC_PRODUCTS = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'The original bright-green Snake Adventures look.',
    release: 'free',
  },
  {
    id: 'wrenbound',
    name: 'Wrenbound',
    description: 'A teal hunter cloak, red sash, and bronze mask inspired by Wren.',
    release: 'launch',
  },
  {
    id: 'embercoil',
    name: 'Embercoil',
    description: 'Obsidian scales split by bright, furnace-hot cracks.',
    release: 'launch',
  },
  {
    id: 'phantom-royal',
    name: 'Phantom Royal',
    description: 'Violet spirit scales with gold rings and a spectral crown.',
    release: 'launch',
  },
  {
    id: 'bone-serpent',
    name: 'Bone Serpent',
    description: 'Ivory vertebrae, charcoal joints, and a watchful skull.',
    release: 'launch',
  },
  {
    id: 'frostfang',
    name: 'Frostfang',
    description: 'Cracked cyan ice with frozen white edges and a sharp crest.',
    release: 'future',
  },
  {
    id: 'neon-blurple',
    name: 'Neon Blurple',
    description: 'Midnight panels crossed by blurple and cyan circuitry.',
    release: 'future',
  },
] as const;

export type CosmeticProduct = (typeof COSMETIC_PRODUCTS)[number];
export type CosmeticId = CosmeticProduct['id'];
export type CosmeticRelease = CosmeticProduct['release'];

export const LAUNCH_PREMIUM_COSMETIC_IDS = [
  'wrenbound',
  'embercoil',
  'phantom-royal',
  'bone-serpent',
] as const satisfies readonly CosmeticId[];
export type LaunchPremiumCosmeticId = (typeof LAUNCH_PREMIUM_COSMETIC_IDS)[number];

export function isCosmeticId(value: unknown): value is CosmeticId {
  return typeof value === 'string' && COSMETIC_PRODUCTS.some((product) => product.id === value);
}

export function isLaunchPremiumCosmeticId(
  value: CosmeticId,
): value is LaunchPremiumCosmeticId {
  return LAUNCH_PREMIUM_COSMETIC_IDS.some((id) => id === value);
}
