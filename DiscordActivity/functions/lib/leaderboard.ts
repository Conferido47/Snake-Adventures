export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  highScore: number;
  highestLevel: number;
}

interface RankedPlayerRow extends LeaderboardEntry {
  discordUserId: string;
  position: number;
}

interface RankRow {
  rank: number;
}

export interface LeaderboardSnapshot {
  entries: LeaderboardEntry[];
  player: LeaderboardEntry | null;
}

export async function readLeaderboard(
  database: D1Database,
  userId: string,
): Promise<LeaderboardSnapshot> {
  const result = await database.prepare(
    `WITH ranked AS (
       SELECT
         discord_user_id AS discordUserId,
         display_name AS displayName,
         high_score AS highScore,
         highest_level AS highestLevel,
         RANK() OVER (ORDER BY high_score DESC, highest_level DESC) AS rank,
         ROW_NUMBER() OVER (
           ORDER BY high_score DESC, highest_level DESC, created_at ASC, discord_user_id ASC
         ) AS position
       FROM player_stats
     )
     SELECT discordUserId, displayName, highScore, highestLevel, rank, position
     FROM ranked
     WHERE position <= 10 OR discordUserId = ?1
     ORDER BY position ASC`,
  ).bind(userId).all<RankedPlayerRow>();

  const entries = result.results
    .filter((row) => row.position <= 10)
    .map(publicEntry);
  const playerRow = result.results.find((row) => row.discordUserId === userId);
  return {
    entries,
    player: playerRow ? publicEntry(playerRow) : null,
  };
}

export async function readPlayerRank(
  database: D1Database,
  userId: string,
): Promise<number | null> {
  const row = await database.prepare(
    `SELECT rank FROM (
       SELECT
         discord_user_id,
         RANK() OVER (ORDER BY high_score DESC, highest_level DESC) AS rank
       FROM player_stats
     )
     WHERE discord_user_id = ?1`,
  ).bind(userId).first<RankRow>();
  return row?.rank ?? null;
}

function publicEntry(row: RankedPlayerRow): LeaderboardEntry {
  return {
    rank: row.rank,
    displayName: row.displayName,
    highScore: row.highScore,
    highestLevel: row.highestLevel,
  };
}
