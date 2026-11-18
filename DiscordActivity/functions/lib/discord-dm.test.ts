import { describe, expect, it, vi } from 'vitest';
import { sendDiscordDm } from './discord-dm';

const userId = '123456789012345678';
const channelId = '223456789012345678';

describe('Discord result DMs', () => {
  it('opens a private channel and sends the supplied message as the bot', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: channelId }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: '323456789012345678' }), { status: 200 }));
    const message = { allowed_mentions: { parse: [] }, embeds: [{ title: 'Run Complete' }] };

    await expect(sendDiscordDm('bot-token', userId, message, fetcher)).resolves.toBe(true);

    expect(fetcher).toHaveBeenCalledTimes(2);
    const [channelUrl, channelRequest] = fetcher.mock.calls[0]!;
    expect(channelUrl).toBe('https://discord.com/api/v10/users/@me/channels');
    expect(JSON.parse(String(channelRequest?.body))).toEqual({ recipient_id: userId });
    const headers = new Headers(channelRequest?.headers);
    expect(headers.get('Authorization')).toBe('Bot bot-token');
    expect(headers.get('User-Agent')).toBe(
      'DiscordBot (https://snake-adventures-discord.pages.dev, 1.0.0)',
    );
    expect(channelRequest?.signal).toBeInstanceOf(AbortSignal);
    const [messageUrl, messageRequest] = fetcher.mock.calls[1]!;
    expect(messageUrl).toBe(`https://discord.com/api/v10/channels/${channelId}/messages`);
    expect(JSON.parse(String(messageRequest?.body))).toEqual(message);
  });

  it('treats blocked or unavailable DMs as a non-fatal delivery failure', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      code: 50007,
      message: 'Cannot send messages to this user',
    }), { status: 403 }));

    await expect(sendDiscordDm('bot-token', userId, {}, fetcher)).resolves.toBe(false);

    expect(fetcher).toHaveBeenCalledOnce();
    expect(warning).toHaveBeenCalled();
    warning.mockRestore();
  });

  it('honors a bounded Discord rate-limit retry', async () => {
    const delay = vi.fn(async () => undefined);
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('{}', {
        status: 429,
        headers: { 'Retry-After': '0.25' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: channelId }), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));

    await expect(sendDiscordDm('bot-token', userId, {}, fetcher, delay)).resolves.toBe(true);

    expect(delay).toHaveBeenCalledWith(250);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('does not retry before a longer Discord rate limit expires', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const delay = vi.fn(async () => undefined);
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', {
      status: 429,
      headers: { 'Retry-After': '65' },
    }));

    await expect(sendDiscordDm('bot-token', userId, {}, fetcher, delay)).resolves.toBe(false);

    expect(delay).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledOnce();
    warning.mockRestore();
  });
});
