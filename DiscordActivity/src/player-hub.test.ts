import { describe, expect, it, vi } from 'vitest';
import {
  buildLeaderboardShareMessage,
  PlayerHubService,
  type LeaderboardSnapshot,
} from './player-hub';

const leaderboard: LeaderboardSnapshot = {
  entries: [{ rank: 1, displayName: 'Wren Hunter', highScore: 2_500, highestLevel: 6 }],
  player: { rank: 4, displayName: 'Player', highScore: 1_500, highestLevel: 4 },
};

describe('PlayerHubService', () => {
  it('loads records and stores an explicit DM preference with Discord authentication', async () => {
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      if (input === '/api/preferences' && init?.method === 'PUT') {
        return new Response(String(init.body), { status: 200 });
      }
      if (input === '/api/preferences') {
        return new Response(JSON.stringify({ resultDmEnabled: false }), { status: 200 });
      }
      return new Response(JSON.stringify(leaderboard), { status: 200 });
    });
    const service = new PlayerHubService({ accessToken: 'access-token', fetcher });

    await expect(service.getPreferences()).resolves.toEqual({ resultDmEnabled: false });
    await expect(service.setResultDmEnabled(true)).resolves.toEqual({ resultDmEnabled: true });
    await expect(service.getLeaderboard()).resolves.toEqual(leaderboard);

    for (const [, request] of fetcher.mock.calls) {
      expect(new Headers(request?.headers).get('Authorization')).toBe('Bearer access-token');
    }
    expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toEqual({ resultDmEnabled: true });
  });

  it('rejects malformed leaderboard data', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      entries: [{ rank: 0, displayName: '', highScore: -1, highestLevel: 0 }],
      player: null,
    }), { status: 200 }));
    const service = new PlayerHubService({ accessToken: 'token', fetcher });

    await expect(service.getLeaderboard()).rejects.toThrow('invalid response');
  });

  it('does not call online services in browser mode', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const service = new PlayerHubService({ accessToken: null, fetcher });

    expect(service.available).toBe(false);
    await expect(service.getLeaderboard()).rejects.toThrow('inside Discord');
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('leaderboard sharing', () => {
  it('shares the top score and the current player rank', () => {
    expect(buildLeaderboardShareMessage(leaderboard)).toBe(
      "Snake Adventures Lifetime Top 10. The top score is 2,500. I'm ranked #4. Can you climb the leaderboard?",
    );
  });
});
