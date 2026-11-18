import { errorResponse, HttpError, jsonResponse, readSmallJson } from '../lib/http';
import { namedPlayerId, parseNamedPlay } from '../lib/named-player';

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405, { Allow: 'POST' });
  try {
    const playerId = await namedPlayerId(request);
    if (!playerId) throw new HttpError(401, 'A player token is required.');
    const play = parseNamedPlay(await readSmallJson(request));
    if (!play) throw new HttpError(400, 'Enter a display name of 1–32 characters and valid play data.');
    const existing = await env.DB.prepare('SELECT platform FROM named_players WHERE player_id = ?1')
      .bind(playerId).first<{ platform: string }>();
    if (existing && existing.platform !== play.platform) throw new HttpError(409, 'This player belongs to another platform.');
    const statements = [
      env.DB.prepare(`INSERT INTO named_players (player_id, display_name, platform, game_version)
        VALUES (?1, ?2, ?3, ?4) ON CONFLICT(player_id) DO UPDATE SET
        display_name = excluded.display_name, game_version = excluded.game_version,
        updated_at = CURRENT_TIMESTAMP WHERE named_players.platform = excluded.platform`)
        .bind(playerId, play.displayName, play.platform, play.gameVersion),
      env.DB.prepare('INSERT INTO named_sessions (player_id, session_id) VALUES (?1, ?2) ON CONFLICT DO NOTHING')
        .bind(playerId, play.sessionId),
    ];
    if (play.run) statements.push(env.DB.prepare(`INSERT INTO named_runs
      (player_id, submission_id, score, level, won, game_version) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
      ON CONFLICT DO NOTHING`).bind(playerId, play.run.submissionId, play.run.score,
        play.run.level, play.run.won ? 1 : 0, play.gameVersion));
    await env.DB.batch(statements);
    return jsonResponse({ stored: true });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('named run cooldown')) {
      return jsonResponse({ error: 'Please wait a few seconds before submitting another run.' }, 429);
    }
    return errorResponse(error, 'Player reporting');
  }
};
