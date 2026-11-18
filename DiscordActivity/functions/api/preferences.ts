import { authenticateDiscordRequest } from '../lib/discord-auth';
import { errorResponse, HttpError, jsonResponse, readSmallJson } from '../lib/http';
import {
  parsePlayerPreferences,
  readPlayerPreferences,
  writePlayerPreferences,
} from '../lib/preferences';

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method !== 'GET' && request.method !== 'PUT') {
    return jsonResponse({ error: 'Method not allowed.' }, 405, { Allow: 'GET, PUT' });
  }

  try {
    if (!env.DB) {
      throw new Error('Player preferences storage is not configured.');
    }
    const player = await authenticateDiscordRequest(request, env.DISCORD_CLIENT_ID);
    if (request.method === 'PUT') {
      const preferences = parsePlayerPreferences(await readSmallJson(request));
      if (!preferences) {
        throw new HttpError(400, 'A valid resultDmEnabled preference is required.');
      }
      await writePlayerPreferences(env.DB, player.id, preferences);
      return jsonResponse(preferences);
    }
    return jsonResponse(await readPlayerPreferences(env.DB, player.id));
  } catch (error: unknown) {
    return errorResponse(error, 'The player preferences service');
  }
};
