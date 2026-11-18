export interface PlayerPreferences {
  resultDmEnabled: boolean;
}

interface PreferenceRow {
  resultDmEnabled: number;
}

export function parsePlayerPreferences(value: unknown): PlayerPreferences | null {
  return typeof value === 'object' &&
      value !== null &&
      'resultDmEnabled' in value &&
      typeof value.resultDmEnabled === 'boolean'
    ? { resultDmEnabled: value.resultDmEnabled }
    : null;
}

export async function readPlayerPreferences(
  database: D1Database,
  userId: string,
): Promise<PlayerPreferences> {
  const row = await database.prepare(
    `SELECT result_dm_enabled AS resultDmEnabled
     FROM player_preferences
     WHERE discord_user_id = ?1`,
  ).bind(userId).first<PreferenceRow>();
  return { resultDmEnabled: row?.resultDmEnabled === 1 };
}

export async function writePlayerPreferences(
  database: D1Database,
  userId: string,
  preferences: PlayerPreferences,
): Promise<void> {
  await database.prepare(
    `INSERT INTO player_preferences (discord_user_id, result_dm_enabled)
     VALUES (?1, ?2)
     ON CONFLICT(discord_user_id) DO UPDATE SET
       result_dm_enabled = excluded.result_dm_enabled,
       updated_at = CURRENT_TIMESTAMP`,
  ).bind(userId, preferences.resultDmEnabled ? 1 : 0).run();
}
