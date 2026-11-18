import { jsonResponse } from '../lib/http';

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed.' }, 405, { Allow: 'GET' });
  }

  try {
    await env.DB.prepare(
      'SELECT result_dm_enabled FROM player_preferences LIMIT 1',
    ).first<{ result_dm_enabled: number }>();
    return jsonResponse({
      status: 'ok',
      database: true,
      discordOAuth: Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET),
      discordBot: Boolean(env.DISCORD_BOT_TOKEN),
    });
  } catch {
    return jsonResponse({
      status: 'degraded',
      database: false,
      discordOAuth: Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET),
      discordBot: Boolean(env.DISCORD_BOT_TOKEN),
    }, 503);
  }
};
