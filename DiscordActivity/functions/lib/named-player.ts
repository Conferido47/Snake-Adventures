import { parseRunSubmission, type RunSubmission } from './run';

export interface NamedPlay {
  displayName: string;
  platform: 'browser' | 'windows';
  gameVersion: string;
  sessionId: string;
  run: RunSubmission | null;
}

export function parseNamedPlay(value: unknown): NamedPlay | null {
  if (typeof value !== 'object' || value === null) return null;
  const input = value as Record<string, unknown>;
  if (typeof input.displayName !== 'string' ||
      (input.platform !== 'browser' && input.platform !== 'windows') ||
      typeof input.gameVersion !== 'string' || !/^[\w.+-]{1,32}$/.test(input.gameVersion) ||
      typeof input.sessionId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.sessionId)) return null;
  const displayName = input.displayName.trim().normalize('NFC');
  if (!displayName || displayName.length > 32 || /[\p{Cc}\p{Cf}<>]/u.test(displayName)) return null;
  const run = input.run === undefined ? null : parseRunSubmission(input.run);
  if (input.run !== undefined && (!run || run.gameVersion !== input.gameVersion)) return null;
  return { displayName, platform: input.platform, gameVersion: input.gameVersion, sessionId: input.sessionId, run };
}

export async function namedPlayerId(request: Request): Promise<string | null> {
  const token = request.headers.get('Authorization')?.match(/^Bearer ([0-9a-f]{64})$/)?.[1];
  if (!token) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
