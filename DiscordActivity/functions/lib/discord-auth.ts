import { HttpError } from './http';

interface OAuthIdentity {
  application?: { id?: string };
  scopes?: string[];
  user?: {
    id?: string;
    username?: string;
    global_name?: string | null;
    avatar?: string | null;
  };
}

export interface AuthenticatedDiscordUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
}

export async function authenticateDiscordRequest(
  request: Request,
  clientId: string,
  fetcher: typeof fetch = fetch,
): Promise<AuthenticatedDiscordUser> {
  const accessToken = bearerToken(request);
  const response = await fetcher('https://discord.com/api/v10/oauth2/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const identity = await response.json().catch(() => ({})) as OAuthIdentity;
  if (
    !response.ok ||
    identity.application?.id !== clientId ||
    !identity.scopes?.includes('identify') ||
    !identity.user?.id ||
    !identity.user.username
  ) {
    throw new HttpError(401, 'Discord authentication is invalid or expired.');
  }

  const id = identity.user.id;
  const username = identity.user.username;
  return {
    id,
    username,
    displayName: (identity.user.global_name || username).slice(0, 80),
    avatarUrl: identity.user.avatar
      ? `https://cdn.discordapp.com/avatars/${id}/${identity.user.avatar}.png?size=128`
      : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(id) >> 22n) % 6n)}.png`,
  };
}

function bearerToken(request: Request): string {
  const authorization = request.headers.get('Authorization') ?? '';
  const match = authorization.match(/^Bearer (\S+)$/);
  if (!match?.[1] || match[1].length > 2_048) {
    throw new HttpError(401, 'Discord authentication is required.');
  }
  return match[1];
}
