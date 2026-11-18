import { describe, expect, it, vi } from 'vitest';
import {
  cosmeticResponseItems,
  fetchOwnedCosmeticIds,
  ownedCosmeticIdsFromEntitlements,
  parseEquipRequest,
  type ConfiguredCosmetic,
} from './cosmetics';

const catalog = [
  { id: 'wrenbound', skuId: '123456789012345678' },
  { id: 'embercoil', skuId: '223456789012345678' },
] as const satisfies ReadonlyArray<ConfiguredCosmetic & { skuId: string }>;

describe('cosmetic entitlement verification', () => {
  it('accepts only active entitlements for the authenticated app and user', () => {
    const owned = ownedCosmeticIdsFromEntitlements([
      {
        application_id: 'app',
        user_id: 'user',
        sku_id: catalog[0].skuId,
        deleted: false,
        type: 1,
      },
      {
        application_id: 'wrong-app',
        user_id: 'user',
        sku_id: catalog[1].skuId,
        type: 1,
      },
      {
        application_id: 'app',
        user_id: 'other-user',
        sku_id: catalog[1].skuId,
        type: 1,
      },
      {
        application_id: 'app',
        user_id: 'user',
        sku_id: catalog[1].skuId,
        ends_at: '2026-07-27T00:00:00.000Z',
        type: 1,
      },
    ], 'app', 'user', catalog, new Date('2026-07-28T00:00:00.000Z'));

    expect([...owned]).toEqual(['wrenbound']);
  });

  it('gates Application Test Mode and rejects consumed entitlements', () => {
    const entitlements = [
      {
        application_id: 'app',
        user_id: 'user',
        sku_id: catalog[0].skuId,
        type: 4,
      },
      {
        application_id: 'app',
        user_id: 'user',
        sku_id: catalog[1].skuId,
        type: 1,
        consumed: true,
      },
    ];

    expect([...ownedCosmeticIdsFromEntitlements(entitlements, 'app', 'user', catalog)])
      .toEqual([]);
    expect([...ownedCosmeticIdsFromEntitlements(
      entitlements,
      'app',
      'user',
      catalog,
      new Date(),
      true,
    )]).toEqual(['wrenbound']);
  });

  it('accepts bounded equip IDs and rejects arbitrary values', () => {
    expect(parseEquipRequest({ cosmeticId: 'bone-serpent' })).toBe('bone-serpent');
    expect(parseEquipRequest({ cosmeticId: 'admin-rainbow' })).toBeNull();
    expect(parseEquipRequest(null)).toBeNull();
  });

  it('returns public SKU mappings without treating them as ownership', () => {
    const items = cosmeticResponseItems(catalog, new Set(['wrenbound']));
    expect(items.find((item) => item.id === 'classic')).toMatchObject({ owned: true, skuId: null });
    expect(items.find((item) => item.id === 'wrenbound')).toMatchObject({
      owned: true,
      skuId: catalog[0].skuId,
    });
    expect(items.find((item) => item.id === 'embercoil')).toMatchObject({ owned: false });
    expect(items.find((item) => item.id === 'frostfang')).toMatchObject({ skuId: null, owned: false });
  });

  it('grants every configured launch skin only to an allowlisted creator', async () => {
    const creatorId = '323456789012345678';
    const fetcher = vi.fn<typeof fetch>();
    const env = {
      DB: {} as D1Database,
      DISCORD_CLIENT_ID: 'app',
      DISCORD_CLIENT_SECRET: '',
      DISCORD_CREATOR_USER_IDS: `123456789012345678, ${creatorId}`,
    } satisfies Env;

    const owned = await fetchOwnedCosmeticIds(env, creatorId, catalog, fetcher);

    expect([...owned]).toEqual(['wrenbound', 'embercoil']);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
