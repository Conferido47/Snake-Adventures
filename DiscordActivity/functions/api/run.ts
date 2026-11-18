import { errorResponse, HttpError, jsonResponse, readSmallJson } from '../lib/http';
import { authenticateDiscordRequest } from '../lib/discord-auth';
import {
  buildResultMessage,
  nextStreak,
  parseRunSubmission,
  utcDateParts,
  type PreviousStats,
  type StoredStats,
} from '../lib/run';
import { sendDiscordDm } from '../lib/discord-dm';
import { readPlayerRank } from '../lib/leaderboard';
import { readPlayerPreferences } from '../lib/preferences';

interface StatsRow {
  highScore: number;
  highestLevel: number;
  currentStreak: number;
  longestStreak: number;
  totalRuns: number;
}

const SUBMISSION_COOLDOWN_SECONDS = 5;

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405, { Allow: 'POST' });
  }

  try {
    const run = parseRunSubmission(await readSmallJson(request));
    if (!run) {
      throw new HttpError(400, 'Run data is invalid.');
    }
    const player = await authenticateDiscordRequest(request, env.DISCORD_CLIENT_ID);
    if (!env.DB) {
      throw new Error('Score storage is not configured.');
    }
    const existingOwner = await submissionOwner(env.DB, run.submissionId);
    if (existingOwner === player.id) {
      return duplicateRunResponse(env.DB, player.id);
    }
    if (existingOwner !== null) {
      throw new HttpError(409, 'This run identifier has already been used.');
    }

    const previous = await fetchPreviousStats(env.DB, player.id);
    const now = new Date();
    const nowSeconds = Math.floor(now.getTime() / 1_000);
    if (previous && nowSeconds - previous.lastSubmittedAt < SUBMISSION_COOLDOWN_SECONDS) {
      throw new HttpError(429, 'Please wait a few seconds before submitting another run.');
    }

    const insertRun = env.DB.prepare(
      `INSERT INTO run_submissions
       (submission_id, discord_user_id, score, level, won, game_version)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    ).bind(
      run.submissionId,
      player.id,
      run.score,
      run.level,
      run.won ? 1 : 0,
      run.gameVersion,
    );

    const { today, yesterday } = utcDateParts(now);
    const streak = nextStreak(previous, today, yesterday);
    const isPersonalBest = !previous || run.score > previous.highScore;
    const updateStats = env.DB.prepare(
      `INSERT INTO player_stats (
         discord_user_id, display_name, avatar_url, high_score, highest_level,
         current_streak, longest_streak, last_play_date, total_runs,
         last_posted_at, updated_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 1, ?9, CURRENT_TIMESTAMP)
       ON CONFLICT(discord_user_id) DO UPDATE SET
         display_name = excluded.display_name,
         avatar_url = excluded.avatar_url,
         high_score = MAX(player_stats.high_score, excluded.high_score),
         highest_level = MAX(player_stats.highest_level, excluded.highest_level),
         current_streak = excluded.current_streak,
         longest_streak = MAX(player_stats.longest_streak, excluded.longest_streak),
         last_play_date = excluded.last_play_date,
         total_runs = player_stats.total_runs + 1,
         last_posted_at = excluded.last_posted_at,
         updated_at = CURRENT_TIMESTAMP
       RETURNING
         high_score AS highScore,
         highest_level AS highestLevel,
         current_streak AS currentStreak,
         longest_streak AS longestStreak,
         total_runs AS totalRuns`,
    ).bind(
      player.id,
      player.displayName,
      player.avatarUrl,
      run.score,
      run.level,
      streak.current,
      streak.longest,
      today,
      nowSeconds,
    );
    let statsResult: D1Result<StatsRow> | undefined;
    try {
      const results = await env.DB.batch<StatsRow>([insertRun, updateStats]);
      statsResult = results[1];
    } catch (error: unknown) {
      // The database trigger serializes the cooldown; this recheck handles a concurrent idempotent replay.
      const concurrentOwner = await submissionOwner(env.DB, run.submissionId);
      if (concurrentOwner === player.id) {
        return duplicateRunResponse(env.DB, player.id);
      }
      if (concurrentOwner !== null) {
        throw new HttpError(409, 'This run identifier has already been used.');
      }
      if (isRunCooldownError(error)) {
        throw new HttpError(429, 'Please wait a few seconds before submitting another run.');
      }
      throw error;
    }
    const row = statsResult?.results[0];
    if (!row) {
      throw new Error('D1 did not return updated player statistics.');
    }

    const stats: StoredStats = { ...row, isPersonalBest };
    const rank = await readRankSafely(env.DB, player.id);
    const dmEnabled = await readDmPreferenceSafely(env.DB, player.id);
    let dmStatus: 'sent' | 'disabled' | 'failed' | 'preferenceUnavailable' = 'disabled';
    if (dmEnabled === null) {
      dmStatus = 'preferenceUnavailable';
    } else if (dmEnabled) {
      const sent = env.DISCORD_BOT_TOKEN
        ? await sendDiscordDm(
            env.DISCORD_BOT_TOKEN,
            player.id,
            buildResultMessage(player, run, stats, rank, now, env.DISCORD_CLIENT_ID),
          )
        : false;
      dmStatus = sent ? 'sent' : 'failed';
    }
    return jsonResponse({ stored: true, duplicate: false, dmStatus, stats, rank });
  } catch (error: unknown) {
    return errorResponse(error, 'The score service');
  }
};

async function fetchPreviousStats(database: D1Database, userId: string): Promise<PreviousStats | null> {
  return database.prepare(
    `SELECT
       high_score AS highScore,
       highest_level AS highestLevel,
       current_streak AS currentStreak,
       longest_streak AS longestStreak,
       last_play_date AS lastPlayDate,
       total_runs AS totalRuns,
       last_posted_at AS lastSubmittedAt
     FROM player_stats WHERE discord_user_id = ?1`,
  ).bind(userId).first<PreviousStats>();
}

async function submissionOwner(database: D1Database, submissionId: string): Promise<string | null> {
  const row = await database.prepare(
    `SELECT discord_user_id AS discordUserId
     FROM run_submissions
     WHERE submission_id = ?1`,
  ).bind(submissionId).first<{ discordUserId: string }>();
  return row?.discordUserId ?? null;
}

async function duplicateRunResponse(database: D1Database, userId: string): Promise<Response> {
  const stats = await fetchStoredStats(database, userId);
  if (!stats) {
    throw new HttpError(409, 'This run has already been submitted.');
  }
  return jsonResponse({
    stored: true,
    duplicate: true,
    dmStatus: 'duplicate',
    stats: { ...stats, isPersonalBest: false },
    rank: await readRankSafely(database, userId),
  });
}

async function fetchStoredStats(database: D1Database, userId: string): Promise<Omit<StoredStats, 'isPersonalBest'> | null> {
  return database.prepare(
    `SELECT
       high_score AS highScore,
       highest_level AS highestLevel,
       current_streak AS currentStreak,
       longest_streak AS longestStreak,
       total_runs AS totalRuns
     FROM player_stats WHERE discord_user_id = ?1`,
  ).bind(userId).first<Omit<StoredStats, 'isPersonalBest'>>();
}

async function readRankSafely(database: D1Database, userId: string): Promise<number | null> {
  try {
    return await readPlayerRank(database, userId);
  } catch (error: unknown) {
    console.warn(JSON.stringify({
      message: 'Player rank could not be read after storing a run',
      error: error instanceof Error ? error.message : String(error),
    }));
    return null;
  }
}

async function readDmPreferenceSafely(database: D1Database, userId: string): Promise<boolean | null> {
  try {
    return (await readPlayerPreferences(database, userId)).resultDmEnabled;
  } catch (error: unknown) {
    console.warn(JSON.stringify({
      message: 'Result DM preference could not be read after storing a run',
      error: error instanceof Error ? error.message : String(error),
    }));
    return null;
  }
}

function isRunCooldownError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('run submission cooldown');
}
