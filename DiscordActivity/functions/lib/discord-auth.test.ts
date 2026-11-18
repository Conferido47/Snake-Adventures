import { describe, expect, it, vi } from 'vitest';
import { authenticateDiscordRequest } from './discord-auth';

describe('authenticateDiscordRequest', () => {
  it('derives the player only from a validated Discord bearer token', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      application: { id: 'app' },
      scopes: ['identify'],
      user: {
        id: '123456789012345678',
        username: 'snake-player',
        global_name: 'Snake Player',
        avatar: null,
      },
    }), { status: 200 }));
    const request = new Request('https://example.com/api/cosmetics', {
      headers: { Authorization: 'Bearer access-token' },
    });

    const user = await authenticateDiscordRequest(request, 'app', fetcher);

    expect(user).toMatchObject({
      id: '123456789012345678',
      username: 'snake-player',
      displayName: 'Snake Player',
    });
    expect(fetcher).toHaveBeenCalledWith(
      'https://discord.com/api/v10/oauth2/@me',
      { headers: { Authorization: 'Bearer access-token' } },
    );
  });

  it('rejects missing tokens and identities for another application', async () => {
    await expect(authenticateDiscordRequest(
      new Request('https://example.com/api/cosmetics'),
      'app',
    )).rejects.toMatchObject({ status: 401 });

    const request = new Request('https://example.com/api/cosmetics', {
      headers: { Authorization: 'Bearer access-token' },
    });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      application: { id: 'other-app' },
      scopes: ['identify'],
      user: { id: '123', username: 'player' },
    }), { status: 200 }));
    await expect(authenticateDiscordRequest(request, 'app', fetcher))
      .rejects.toMatchObject({ status: 401 });
  });
});
