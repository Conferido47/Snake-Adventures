import { DiscordSDK } from '@discord/embedded-app-sdk';

export interface DiscordSession {
  accessToken: string;
  user: {
    id: string;
    username: string;
    globalName: string | null;
    avatar: string | null;
  };
}

export type ActivityRuntime = {
  kind: 'browser';
  sdk: null;
  instanceId: string | null;
  session: null;
  authenticationError: null;
} | {
  kind: 'discord';
  sdk: DiscordSDK;
  instanceId: string;
  session: DiscordSession | null;
  authenticationError: string | null;
};

function hasDiscordLaunchParameters(): boolean {
  const parameters = new URLSearchParams(window.location.search);
  return (
    window.self !== window.top &&
    parameters.has('frame_id') &&
    parameters.has('instance_id') &&
    parameters.has('platform')
  );
}

export async function connectDiscord(): Promise<ActivityRuntime> {
  if (!hasDiscordLaunchParameters()) {
    return {
      kind: 'browser',
      sdk: null,
      instanceId: null,
      session: null,
      authenticationError: null,
    };
  }

  const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error('VITE_DISCORD_CLIENT_ID is required when running inside Discord.');
  }

  const sdk = new DiscordSDK(clientId, { disableConsoleLogOverride: true });
  await withTimeout(sdk.ready(), 10_000, 'Discord did not complete the Activity handshake.');

  let session: DiscordSession | null = null;
  let authenticationError: string | null = null;
  try {
    session = await authenticateActivity(sdk, clientId);
  } catch (error: unknown) {
    authenticationError = error instanceof Error
      ? error.message
      : 'Discord authentication failed.';
  }

  return {
    kind: 'discord',
    sdk,
    instanceId: sdk.instanceId,
    session,
    authenticationError,
  };
}

async function authenticateActivity(
  sdk: DiscordSDK,
  clientId: string,
): Promise<DiscordSession> {
  const { code } = await runDiscordCommand('authorization', () => sdk.commands.authorize({
    client_id: clientId,
    response_type: 'code',
    state: '',
    prompt: 'none',
    scope: ['identify', 'rpc.activities.write'],
  }));
  const tokenResponse = await fetch('/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const tokenPayload: unknown = await tokenResponse.json().catch(() => null);
  if (!tokenResponse.ok) {
    const reason = isErrorPayload(tokenPayload)
      ? tokenPayload.error
      : 'Discord authentication is unavailable.';
    throw new Error(reason);
  }
  if (!isAccessTokenPayload(tokenPayload)) {
    throw new Error('The online service returned an invalid access token.');
  }

  const authentication = await runDiscordCommand('authentication', () => (
    sdk.commands.authenticate({ access_token: tokenPayload.accessToken })
  ));
  if (!authentication?.user) {
    throw new Error('Discord did not return an authenticated player.');
  }

  return {
    accessToken: tokenPayload.accessToken,
    user: {
      id: authentication.user.id,
      username: authentication.user.username,
      globalName: authentication.user.global_name ?? null,
      avatar: authentication.user.avatar ?? null,
    },
  };
}

async function runDiscordCommand<T>(stage: string, command: () => Promise<T>): Promise<T> {
  try {
    return await command();
  } catch (error: unknown) {
    const detail = discordErrorDetail(error);
    throw new Error(`Discord ${stage} failed${detail ? `: ${detail}` : ''}.`);
  }
}

function discordErrorDetail(error: unknown): string | null {
  const message = error instanceof Error
    ? error.message
    : readErrorProperty(error, 'message');
  const code = readErrorProperty(error, 'code');

  if (message && code) {
    return `${message} (code ${code})`;
  }
  return message ?? (code ? `code ${code}` : null);
}

function readErrorProperty(error: unknown, property: 'code' | 'message'): string | null {
  if (typeof error !== 'object' || error === null || !(property in error)) {
    return null;
  }
  const value = (error as Record<string, unknown>)[property];
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).slice(0, 160)
    : null;
}

function isAccessTokenPayload(value: unknown): value is { accessToken: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'accessToken' in value &&
    typeof value.accessToken === 'string' &&
    value.accessToken.length > 0
  );
}

function isErrorPayload(value: unknown): value is { error: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof value.error === 'string'
  );
}

async function withTimeout<T>(promise: Promise<T>, milliseconds: number, message: string): Promise<T> {
  let timeout: number | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = window.setTimeout(() => reject(new Error(message)), milliseconds);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout !== undefined) {
      window.clearTimeout(timeout);
    }
  }
}
