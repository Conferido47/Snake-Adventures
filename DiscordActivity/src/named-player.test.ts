import { afterEach, describe, expect, it, vi } from 'vitest';
import { NamedPlayerReporter } from './named-player';

afterEach(() => vi.useRealTimers());

describe('NamedPlayerReporter', () => {
  it('reuses the player/session identity and retries runs without duplicating their identifiers', async () => {
    vi.useFakeTimers();
    const send = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('{"stored":true}'))
      .mockRejectedValueOnce(new TypeError('Connection lost'))
      .mockResolvedValueOnce(new Response('{"stored":true}'));
    const reporter = new NamedPlayerReporter({ displayName: 'Player', token: 'ab'.repeat(32) }, send);
    await reporter.report();
    const submission = reporter.report({ score: 100, level: 2, won: false, localHighScore: 100 });
    await vi.runAllTimersAsync();
    await submission;
    const visit = JSON.parse(String(send.mock.calls[0]![1]!.body));
    const run = JSON.parse(String(send.mock.calls[1]![1]!.body));
    expect(visit.platform).toBe('browser');
    expect(visit.displayName).toBe('Player');
    expect(visit.run).toBeUndefined();
    expect(run.sessionId).toBe(visit.sessionId);
    expect(run.run.score).toBe(100);
    expect(send.mock.calls[1]![1]!.body).toBe(send.mock.calls[2]![1]!.body);
  });
});
