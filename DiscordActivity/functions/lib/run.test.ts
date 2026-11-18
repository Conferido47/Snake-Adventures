import { describe, expect, it } from 'vitest';
import {
  buildResultMessage,
  nextStreak,
  parseRunSubmission,
  utcDateParts,
  type DiscordPlayer,
  type PreviousStats,
  type StoredStats,
} from './run';

const previous: PreviousStats = {
  highScore: 500,
  highestLevel: 2,
  currentStreak: 3,
  longestStreak: 5,
  lastPlayDate: '2026-07-27',
  totalRuns: 8,
  lastSubmittedAt: 0,
};

describe('daily streak calculation', () => {
  it('starts at one and advances on the next UTC date', () => {
    expect(nextStreak(null, '2026-07-28', '2026-07-27')).toEqual({ current: 1, longest: 1 });
    expect(nextStreak(previous, '2026-07-28', '2026-07-27')).toEqual({ current: 4, longest: 5 });
  });

  it('does not advance twice in one day and resets after a gap', () => {
    expect(nextStreak(
      { ...previous, lastPlayDate: '2026-07-28' },
      '2026-07-28',
      '2026-07-27',
    )).toEqual({ current: 3, longest: 5 });
    expect(nextStreak(
      { ...previous, lastPlayDate: '2026-07-20' },
      '2026-07-28',
      '2026-07-27',
    )).toEqual({ current: 1, longest: 5 });
  });

  it('uses UTC calendar dates', () => {
    expect(utcDateParts(new Date('2026-07-28T00:00:00.000Z'))).toEqual({
      today: '2026-07-28',
      yesterday: '2026-07-27',
    });
  });
});

describe('run submission validation', () => {
  it('accepts a bounded run and rejects malformed values', () => {
    expect(parseRunSubmission({
      submissionId: '9df0f786-a5c5-4d57-b54a-7f4ee764c580',
      score: 750,
      level: 3,
      won: false,
      gameVersion: '1.0.0',
    })).not.toBeNull();
    expect(parseRunSubmission({
      submissionId: 'not-a-uuid',
      score: -1,
      level: 0,
      won: 'no',
      gameVersion: '',
    })).toBeNull();
  });
});

describe('private result message', () => {
  it('contains the run, records, rank, leaderboard link, and no allowed mentions', () => {
    const player: DiscordPlayer = {
      id: '123',
      displayName: 'Player *One*',
      avatarUrl: null,
    };
    const stats: StoredStats = {
      highScore: 750,
      highestLevel: 3,
      currentStreak: 4,
      longestStreak: 5,
      totalRuns: 9,
      isPersonalBest: true,
    };
    const payload = buildResultMessage(player, {
      submissionId: '9df0f786-a5c5-4d57-b54a-7f4ee764c580',
      score: 750,
      level: 3,
      won: false,
      gameVersion: '1.0.0',
    }, stats, 2, new Date('2026-07-28T12:00:00.000Z'), '1531515418492014836');

    expect(payload.allowed_mentions).toEqual({ parse: [] });
    expect(JSON.stringify(payload)).toContain('New Personal Best!');
    expect(JSON.stringify(payload)).toContain('Daily Streak');
    expect(JSON.stringify(payload)).toContain('4 days');
    expect(JSON.stringify(payload)).toContain('Global Rank');
    expect(JSON.stringify(payload)).toContain('#2');
    expect(payload.content).toContain('custom_id=leaderboard');
    const embed = (payload.embeds as Array<{ author: { name: string } }>)[0]!;
    expect(embed.author.name).toBe('Player *One*');
  });
});
