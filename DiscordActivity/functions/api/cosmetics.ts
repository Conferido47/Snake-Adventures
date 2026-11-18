import {
  isCosmeticId,
  isLaunchPremiumCosmeticId,
  type CosmeticId,
} from '../../shared/cosmetics';
import {
  configuredCosmetics,
  cosmeticResponseItems,
  fetchOwnedCosmeticIds,
  parseEquipRequest,
} from '../lib/cosmetics';
import { authenticateDiscordRequest } from '../lib/discord-auth';
import { errorResponse, HttpError, jsonResponse, readSmallJson } from '../lib/http';

interface EquipmentRow {
  cosmeticId: string;
}

const EQUIPMENT_SLOT = 'snake_skin';

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method !== 'GET' && request.method !== 'PUT') {
    return jsonResponse({ error: 'Method not allowed.' }, 405, { Allow: 'GET, PUT' });
  }

  try {
    let requested: CosmeticId | null = null;
    if (request.method === 'PUT') {
      requested = parseEquipRequest(await readSmallJson(request));
      if (!requested) {
        throw new HttpError(400, 'A valid cosmeticId is required.');
      }
    }
    if (!env.DB) {
      throw new Error('Player equipment storage is not configured.');
    }
    const user = await authenticateDiscordRequest(request, env.DISCORD_CLIENT_ID);
    const catalog = configuredCosmetics(env);
    const owned = await fetchOwnedCosmeticIds(env, user.id, catalog);

    let equippedSkinId = await readEquippedSkin(env.DB, user.id, owned);
    if (requested) {
      if (requested !== 'classic') {
        if (!isLaunchPremiumCosmeticId(requested)) {
          throw new HttpError(409, 'That skin is not available yet.');
        }
        const configured = catalog.find((item) => item.id === requested)?.skuId;
        if (!configured) {
          throw new HttpError(503, 'That skin is not configured for sale.');
        }
        if (!owned.has(requested)) {
          throw new HttpError(403, 'Purchase this skin before equipping it.');
        }
      }
      await writeEquippedSkin(env.DB, user.id, requested);
      equippedSkinId = requested;
    }

    return jsonResponse({
      equippedSkinId,
      items: cosmeticResponseItems(catalog, owned),
    });
  } catch (error: unknown) {
    return errorResponse(error, 'The Wardrobe service');
  }
};

async function readEquippedSkin(
  database: D1Database,
  userId: string,
  owned: ReadonlySet<CosmeticId>,
): Promise<CosmeticId> {
  const row = await database.prepare(
    `SELECT cosmetic_id AS cosmeticId
     FROM player_equipment
     WHERE discord_user_id = ?1 AND slot = ?2`,
  ).bind(userId, EQUIPMENT_SLOT).first<EquipmentRow>();
  if (!row || !isCosmeticId(row.cosmeticId)) {
    return 'classic';
  }
  return row.cosmeticId === 'classic' || owned.has(row.cosmeticId)
    ? row.cosmeticId
    : 'classic';
}

async function writeEquippedSkin(
  database: D1Database,
  userId: string,
  cosmeticId: CosmeticId,
): Promise<void> {
  await database.prepare(
    `INSERT INTO player_equipment (discord_user_id, slot, cosmetic_id, updated_at)
     VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)
     ON CONFLICT(discord_user_id, slot) DO UPDATE SET
       cosmetic_id = excluded.cosmetic_id,
       updated_at = CURRENT_TIMESTAMP`,
  ).bind(userId, EQUIPMENT_SLOT, cosmeticId).run();
}
