import { describe, expect, it, vi } from 'vitest';
import { createRunReporter } from './run-reporter';

describe('createRunReporter', () => {
  it('submits one authenticated run with an idempotency key', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      stored: true,
      duplicate: false,
      dmStatus: 'sent',
      rank: 2,
      stats: {
        highScore: 750,
        highestLevel: 3,
        currentStreak: 4,
        longestStreak: 6,
        totalRuns: 12,
        isPersonalBest: true,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    const reporter = createRunReporter('access-token', fetchMock, () => 'run-id');

    const result = await reporter.submit({
      score: 750,
      level: 3,
      localHighScore: 750,
      won: false,
    });

    expect(result.stats.currentStreak).toBe(4);
    expect(result.dmStatus).toBe('sent');
    expect(result.rank).toBe(2);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, request] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/run');
    expect(request?.method).toBe('POST');
    expect(request?.headers).toEqual({
      Authorization: 'Bearer access-token',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(String(request?.body))).toEqual({
      submissionId: 'run-id',
      score: 750,
      level: 3,
      won: false,
      gameVersion: '1.0.0',
    });
  });

  it('rejects controlled API failures', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      error: 'Please wait before submitting another run.',
    }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    }));
    const reporter = createRunReporter('access-token', fetchMock, () => 'run-id');

    await expect(reporter.submit({
      score: 10,
      level: 1,
      localHighScore: 10,
      won: false,
    })).rejects.toThrow('Please wait before submitting another run.');
  });

  it('rejects malformed success payloads', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    const reporter = createRunReporter('access-token', fetchMock, () => 'run-id');

    await expect(reporter.submit({
      score: 10,
      level: 1,
      localHighScore: 10,
      won: false,
    })).rejects.toThrow('invalid response');
  });
});
