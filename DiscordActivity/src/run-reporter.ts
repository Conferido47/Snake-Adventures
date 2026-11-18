import type { RunSummary } from './game/contracts';

export interface StoredRunStats {
  highScore: number;
  highestLevel: number;
  currentStreak: number;
  longestStreak: number;
  totalRuns: number;
  isPersonalBest: boolean;
}

export interface RunSubmissionResult {
  stored: true;
  duplicate: boolean;
  dmStatus: 'sent' | 'disabled' | 'failed' | 'duplicate' | 'preferenceUnavailable';
  stats: StoredRunStats;
  rank: number | null;
}

export interface RunReporter {
  submit(summary: RunSummary): Promise<RunSubmissionResult>;
}

export function createRunReporter(
  accessToken: string,
  fetchImplementation: typeof fetch = fetch,
  createSubmissionId: () => string = () => crypto.randomUUID(),
): RunReporter {
  return {
    async submit(summary: RunSummary): Promise<RunSubmissionResult> {
      const response = await fetchImplementation('/api/run', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          submissionId: createSubmissionId(),
          score: summary.score,
          level: summary.level,
          won: summary.won,
          gameVersion: '1.0.1',
        }),
      });

      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = isErrorPayload(payload) ? payload.error : 'Score submission failed.';
        throw new Error(message);
      }
      if (!isRunSubmissionResult(payload)) {
        throw new Error('Score service returned an invalid response.');
      }
      return payload;
    },
  };
}

function isErrorPayload(value: unknown): value is { error: string } {
  return isRecord(value) && typeof value.error === 'string';
}

function isRunSubmissionResult(value: unknown): value is RunSubmissionResult {
  if (
    !isRecord(value) ||
    value.stored !== true ||
    typeof value.duplicate !== 'boolean' ||
    !isDmStatus(value.dmStatus) ||
    !(value.rank === null || (typeof value.rank === 'number' && Number.isInteger(value.rank) && value.rank > 0)) ||
    !isRecord(value.stats)
  ) {
    return false;
  }
  const stats = value.stats;
  return (
    typeof stats.highScore === 'number' &&
    typeof stats.highestLevel === 'number' &&
    typeof stats.currentStreak === 'number' &&
    typeof stats.longestStreak === 'number' &&
    typeof stats.totalRuns === 'number' &&
    typeof stats.isPersonalBest === 'boolean'
  );
}

function isDmStatus(value: unknown): value is RunSubmissionResult['dmStatus'] {
  return value === 'sent' ||
    value === 'disabled' ||
    value === 'failed' ||
    value === 'duplicate' ||
    value === 'preferenceUnavailable';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
