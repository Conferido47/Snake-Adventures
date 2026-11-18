import { authenticateDiscordRequest } from '../lib/discord-auth';
import { errorResponse, jsonResponse } from '../lib/http';
import { readLeaderboard } from '../lib/leaderboard';

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed.' }, 405, { Allow: 'GET' });
  }

  try {
    if (!env.DB) {
      throw new Error('Leaderboard storage is not configured.');
    }
    const player = await authenticateDiscordRequest(request, env.DISCORD_CLIENT_ID);
    return jsonResponse(await readLeaderboard(env.DB, player.id));
  } catch (error: unknown) {
    return errorResponse(error, 'The leaderboard service');
  }
};
