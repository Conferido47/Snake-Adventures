import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { namedPlayerId, parseNamedPlay } from './named-player';

const sessionId = '93dd9d9c-558f-4f1e-b6cf-9ad396533bb3';
const play = { displayName: '  Player One  ', platform: 'browser', gameVersion: '1.0.1', sessionId };

describe('named player validation', () => {
  it('normalizes names while rejecting malformed names, platforms, sessions, and runs', () => {
    expect(parseNamedPlay(play)?.displayName).toBe('Player One');
    expect(parseNamedPlay({ ...play, displayName: 'Jose\u0301' })?.displayName).toBe('José');
    for (const displayName of ['', '   ', 'a'.repeat(33), '<script>', 'hidden\u202ename', 'a\nb']) {
      expect(parseNamedPlay({ ...play, displayName })).toBeNull();
    }
    expect(parseNamedPlay({ ...play, platform: 'discord' })).toBeNull();
    expect(parseNamedPlay({ ...play, sessionId: 'not-a-uuid' })).toBeNull();
    expect(parseNamedPlay({ ...play, run: { submissionId: sessionId, score: -1, level: 1, won: false, gameVersion: '1.0.1' } })).toBeNull();
    expect(parseNamedPlay({ ...play, run: { submissionId: sessionId, score: 10, level: 1, won: false, gameVersion: '1.0.0' } })).toBeNull();
  });

  it('derives a stable private identity without accepting the publicly visible hash as a token', async () => {
    const token = 'ab'.repeat(32);
    const request = new Request('https://game.test/api/play', { headers: { Authorization: `Bearer ${token}` } });
    const id = await namedPlayerId(request);
    expect(id).toMatch(/^[a-f0-9]{64}$/);
    expect(id).not.toBe(token);
    expect(await namedPlayerId(request)).toBe(id);
    expect(await namedPlayerId(new Request(request, { headers: { Authorization: `Bearer ${id}` } }))).not.toBe(id);
    expect(await namedPlayerId(new Request('https://game.test'))).toBeNull();
  });
});

describe('named player database migration', () => {
  it('deduplicates visits and runs, updates stats atomically, and preserves Discord records in admin views', () => {
    const db = new DatabaseSync(':memory:');
    try {
      db.exec(readFileSync(new URL('../../migrations/0001_create_score_tables.sql', import.meta.url), 'utf8'));
      db.exec(readFileSync(new URL('../../migrations/0004_named_players.sql', import.meta.url), 'utf8'));
      db.exec(`INSERT INTO player_stats (discord_user_id, display_name, last_play_date) VALUES ('123', 'Discord player', '2026-11-18');
        INSERT INTO named_players (player_id, display_name, platform, game_version) VALUES ('local', 'Browser player', 'browser', '1.0.1');
        INSERT INTO named_sessions (player_id, session_id) VALUES ('local', 'visit') ON CONFLICT DO NOTHING;
        INSERT INTO named_sessions (player_id, session_id) VALUES ('local', 'visit') ON CONFLICT DO NOTHING;
        INSERT INTO named_runs (player_id, submission_id, score, level, won, game_version) VALUES ('local', 'run', 250, 2, 0, '1.0.1') ON CONFLICT DO NOTHING;
        INSERT INTO named_runs (player_id, submission_id, score, level, won, game_version) VALUES ('local', 'run', 250, 2, 0, '1.0.1') ON CONFLICT DO NOTHING;`);
      expect(db.prepare('SELECT total_sessions, total_runs, high_score, highest_level FROM named_players').get())
        .toEqual({ total_sessions: 1, total_runs: 1, high_score: 250, highest_level: 2 });
      expect(db.prepare('SELECT platform FROM all_player_stats ORDER BY platform').all())
        .toEqual([{ platform: 'browser' }, { platform: 'discord' }]);
      expect(db.prepare('SELECT COUNT(*) AS count FROM all_run_submissions').get()).toEqual({ count: 1 });
      expect(() => db.exec(`INSERT INTO named_runs (player_id, submission_id, score, level, won, game_version)
        VALUES ('local', 'too-fast', 100, 1, 0, '1.0.1')`)).toThrow('named run cooldown');
      db.exec("DELETE FROM named_players WHERE player_id = 'local'");
      expect(db.prepare('SELECT COUNT(*) AS count FROM named_runs').get()).toEqual({ count: 0 });
      expect(db.prepare('SELECT COUNT(*) AS count FROM named_sessions').get()).toEqual({ count: 0 });
    } finally { db.close(); }
  });
});
