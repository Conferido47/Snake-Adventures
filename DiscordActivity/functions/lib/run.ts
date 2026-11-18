export interface RunSubmission {
  submissionId: string;
  score: number;
  level: number;
  won: boolean;
  gameVersion: string;
}

export interface DiscordPlayer {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface StoredStats {
  highScore: number;
  highestLevel: number;
  currentStreak: number;
  longestStreak: number;
  totalRuns: number;
  isPersonalBest: boolean;
}

export interface PreviousStats {
  highScore: number;
  highestLevel: number;
  currentStreak: number;
  longestStreak: number;
  lastPlayDate: string;
  totalRuns: number;
  lastSubmittedAt: number;
}

const SUBMISSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseRunSubmission(value: unknown): RunSubmission | null {
  if (!isRecord(value)) {
    return null;
  }
  const { submissionId, score, level, won, gameVersion } = value;
  if (
    typeof submissionId !== 'string' ||
    !SUBMISSION_ID_PATTERN.test(submissionId) ||
    typeof score !== 'number' ||
    !Number.isInteger(score) ||
    typeof level !== 'number' ||
    !Number.isInteger(level) ||
    typeof won !== 'boolean' ||
    typeof gameVersion !== 'string'
  ) {
    return null;
  }
  if (score < 0 || score > 10_000_000 || level < 1 || level > 1_000) {
    return null;
  }
  if (gameVersion.length < 1 || gameVersion.length > 32) {
    return null;
  }
  return { submissionId, score, level, won, gameVersion };
}

export function utcDateParts(now: Date): { today: string; yesterday: string } {
  const today = now.toISOString().slice(0, 10);
  const yesterdayDate = new Date(now);
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
  return { today, yesterday: yesterdayDate.toISOString().slice(0, 10) };
}

export function nextStreak(
  previous: PreviousStats | null,
  today: string,
  yesterday: string,
): { current: number; longest: number } {
  if (!previous) {
    return { current: 1, longest: 1 };
  }
  const current = previous.lastPlayDate === today
    ? previous.currentStreak
    : previous.lastPlayDate === yesterday
      ? previous.currentStreak + 1
      : 1;
  return { current, longest: Math.max(previous.longestStreak, current) };
}

export function buildResultMessage(
  player: DiscordPlayer,
  run: RunSubmission,
  stats: StoredStats,
  rank: number | null,
  now: Date,
  applicationId: string,
): Record<string, unknown> {
  const title = stats.isPersonalBest ? 'New Personal Best!' : 'Run Complete';
  const result = run.won ? 'You cleared the board.' : 'Your adventure ended.';
  return {
    allowed_mentions: { parse: [] },
    content: `View the lifetime leaderboard: https://discord.com/activities/${applicationId}?custom_id=leaderboard`,
    embeds: [{
      title,
      url: `https://discord.com/activities/${applicationId}?custom_id=leaderboard`,
      description: result,
      color: 0x7ee0be,
      author: {
        name: truncate(player.displayName, 80),
        ...(player.avatarUrl ? { icon_url: player.avatarUrl } : {}),
      },
      fields: [
        { name: 'Score', value: run.score.toLocaleString('en-US'), inline: true },
        { name: 'Personal Best', value: stats.highScore.toLocaleString('en-US'), inline: true },
        { name: 'Level', value: String(run.level), inline: true },
        { name: 'Highest Level', value: String(stats.highestLevel), inline: true },
        { name: 'Daily Streak', value: `${stats.currentStreak} day${stats.currentStreak === 1 ? '' : 's'}`, inline: true },
        { name: 'Completed Runs', value: stats.totalRuns.toLocaleString('en-US'), inline: true },
        { name: 'Global Rank', value: rank === null ? 'Unranked' : `#${rank}`, inline: true },
      ],
      footer: {
        text: `Longest streak: ${stats.longestStreak} day${stats.longestStreak === 1 ? '' : 's'} | Streaks use UTC`,
      },
      timestamp: now.toISOString(),
    }],
  };
}

function truncate(value: string, maximumLength: number): string {
  return value.slice(0, maximumLength);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
