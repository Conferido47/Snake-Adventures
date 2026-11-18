import { errorResponse, HttpError, jsonResponse, readSmallJson } from '../lib/http';

interface TokenExchangeResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405, { Allow: 'POST' });
  }

  try {
    const body = await readSmallJson(request);
    if (!isCodePayload(body)) {
      throw new HttpError(400, 'A Discord authorization code is required.');
    }
    if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
      throw new Error('Discord OAuth is not configured.');
    }

    const response = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: body.code,
      }),
    });
    const token = await response.json().catch(() => ({})) as TokenExchangeResponse;
    if (!response.ok || !token.access_token) {
      const status = response.status === 429 ? 429 : 502;
      const message = token.error === 'invalid_client'
        ? 'Discord rejected the configured client secret.'
        : token.error === 'invalid_grant'
          ? 'Discord rejected or expired the authorization code.'
          : 'Discord did not accept the authorization code.';
      throw new HttpError(status, message);
    }

    return jsonResponse({
      accessToken: token.access_token,
      expiresIn: token.expires_in ?? null,
      scope: token.scope ?? 'identify',
      tokenType: token.token_type ?? 'Bearer',
    });
  } catch (error: unknown) {
    return errorResponse(error);
  }
};

function isCodePayload(value: unknown): value is { code: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof value.code === 'string' &&
    value.code.length > 0 &&
    value.code.length <= 512
  );
}
