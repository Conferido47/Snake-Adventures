import {
  COSMETIC_PRODUCTS,
  isCosmeticId,
  isLaunchPremiumCosmeticId,
  type CosmeticId,
  type LaunchPremiumCosmeticId,
} from '../../shared/cosmetics';
import { HttpError } from './http';

export interface ConfiguredCosmetic {
  id: LaunchPremiumCosmeticId;
  skuId: string | null;
}

interface DiscordEntitlement {
  application_id?: string;
  user_id?: string;
  sku_id?: string;
  deleted?: boolean;
  consumed?: boolean | null;
  type?: number;
  starts_at?: string | null;
  ends_at?: string | null;
}

const SKU_ENVIRONMENT_KEYS: Record<LaunchPremiumCosmeticId, keyof Env> = {
  wrenbound: 'DISCORD_SKU_WRENBOUND',
  embercoil: 'DISCORD_SKU_EMBERCOIL',
  'phantom-royal': 'DISCORD_SKU_PHANTOM_ROYAL',
  'bone-serpent': 'DISCORD_SKU_BONE_SERPENT',
};

export function configuredCosmetics(env: Env): ConfiguredCosmetic[] {
  const catalog = Object.entries(SKU_ENVIRONMENT_KEYS).map(([id, key]) => ({
    id: id as LaunchPremiumCosmeticId,
    skuId: validSnowflake(env[key]) ? env[key] : null,
  }));
  const seen = new Set<string>();
  for (const item of catalog) {
    if (item.skuId && seen.has(item.skuId)) {
      throw new Error('Each cosmetic must use a unique Discord SKU ID.');
    }
    if (item.skuId) {
      seen.add(item.skuId);
    }
  }
  return catalog;
}

export function parseEquipRequest(value: unknown): CosmeticId | null {
  return typeof value === 'object' &&
      value !== null &&
      'cosmeticId' in value &&
      isCosmeticId(value.cosmeticId)
    ? value.cosmeticId
    : null;
}

export async function fetchOwnedCosmeticIds(
  env: Env,
  userId: string,
  catalog: readonly ConfiguredCosmetic[],
  fetcher: typeof fetch = fetch,
  now = new Date(),
): Promise<Set<CosmeticId>> {
  const configured = catalog.filter(
    (item): item is ConfiguredCosmetic & { skuId: string } => item.skuId !== null,
  );
  if (configured.length === 0) {
    return new Set();
  }
  if (isCreatorUser(env.DISCORD_CREATOR_USER_IDS, userId)) {
    return new Set(configured.map((item) => item.id));
  }
  if (!env.DISCORD_BOT_TOKEN) {
    throw new HttpError(503, 'Wardrobe ownership verification is not configured.');
  }

  const url = new URL(`https://discord.com/api/v10/applications/${env.DISCORD_CLIENT_ID}/entitlements`);
  url.searchParams.set('user_id', userId);
  url.searchParams.set('sku_ids', configured.map((item) => item.skuId).join(','));
  url.searchParams.set('exclude_ended', 'true');
  url.searchParams.set('exclude_deleted', 'true');
  url.searchParams.set('limit', '100');
  const response = await fetcher(url, {
    headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
  });
  if (!response.ok) {
    throw new HttpError(503, 'Discord purchase verification is temporarily unavailable.');
  }
  const entitlements: unknown = await response.json().catch(() => null);
  return ownedCosmeticIdsFromEntitlements(
    entitlements,
    env.DISCORD_CLIENT_ID,
    userId,
    configured,
    now,
    env.ALLOW_DISCORD_TEST_ENTITLEMENTS === 'true',
  );
}

export function ownedCosmeticIdsFromEntitlements(
  value: unknown,
  applicationId: string,
  userId: string,
  catalog: ReadonlyArray<ConfiguredCosmetic & { skuId: string }>,
  now = new Date(),
  allowTestEntitlements = false,
): Set<CosmeticId> {
  if (!Array.isArray(value)) {
    throw new Error('Discord returned malformed entitlement data.');
  }
  const bySku = new Map(catalog.map((item) => [item.skuId, item.id]));
  const owned = new Set<CosmeticId>();
  for (const candidate of value) {
    if (typeof candidate !== 'object' || candidate === null) {
      continue;
    }
    const entitlement = candidate as DiscordEntitlement;
    const cosmeticId = entitlement.sku_id ? bySku.get(entitlement.sku_id) : undefined;
    if (
      !cosmeticId ||
      entitlement.application_id !== applicationId ||
      entitlement.user_id !== userId ||
      entitlement.deleted === true ||
      entitlement.consumed === true ||
      !isAcceptedEntitlementType(entitlement.type, allowTestEntitlements) ||
      !isActiveAt(entitlement.starts_at, entitlement.ends_at, now)
    ) {
      continue;
    }
    owned.add(cosmeticId);
  }
  return owned;
}

function isAcceptedEntitlementType(type: number | undefined, allowTestEntitlements: boolean): boolean {
  if (type === 4) {
    return allowTestEntitlements;
  }
  return type === 1 || type === 3 || type === 5 || type === 6 || type === 7;
}

export function cosmeticResponseItems(
  catalog: readonly ConfiguredCosmetic[],
  owned: ReadonlySet<CosmeticId>,
): Array<{ id: CosmeticId; skuId: string | null; owned: boolean }> {
  const skuById = new Map(catalog.map((item) => [item.id, item.skuId]));
  return COSMETIC_PRODUCTS.map((product) => ({
    id: product.id,
    skuId: isLaunchPremiumCosmeticId(product.id) ? skuById.get(product.id) ?? null : null,
    owned: product.id === 'classic' || owned.has(product.id),
  }));
}

function validSnowflake(value: unknown): value is string {
  return typeof value === 'string' && /^\d{16,22}$/.test(value);
}

function isCreatorUser(value: unknown, userId: string): boolean {
  return typeof value === 'string' && value
    .split(/[\s,]+/)
    .some((candidate) => validSnowflake(candidate) && candidate === userId);
}

function isActiveAt(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  now: Date,
): boolean {
  const nowMilliseconds = now.getTime();
  const starts = startsAt ? Date.parse(startsAt) : Number.NEGATIVE_INFINITY;
  const ends = endsAt ? Date.parse(endsAt) : Number.POSITIVE_INFINITY;
  return Number.isFinite(nowMilliseconds) &&
    !Number.isNaN(starts) &&
    !Number.isNaN(ends) &&
    starts <= nowMilliseconds &&
    ends > nowMilliseconds;
}
