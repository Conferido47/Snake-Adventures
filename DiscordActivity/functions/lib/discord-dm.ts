const DISCORD_API = 'https://discord.com/api/v10';
const USER_AGENT = 'DiscordBot (https://snake-adventures-discord.pages.dev, 1.0.0)';
const REQUEST_TIMEOUT_MS = 4_000;
const MAX_RATE_LIMIT_WAIT_MS = 2_000;

interface DiscordChannel {
  id?: string;
}

export async function sendDiscordDm(
  botToken: string,
  userId: string,
  message: Record<string, unknown>,
  fetcher: typeof fetch = fetch,
  delay: (milliseconds: number) => Promise<void> = sleep,
): Promise<boolean> {
  const headers = {
    Authorization: `Bot ${botToken}`,
    'Content-Type': 'application/json',
    'User-Agent': USER_AGENT,
  };

  const channelResponse = await requestDiscord(
    `${DISCORD_API}/users/@me/channels`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ recipient_id: userId }),
    },
    fetcher,
    delay,
  );
  if (!channelResponse?.ok) {
    logDeliveryFailure('create_dm', channelResponse?.status);
    return false;
  }

  const channel = await channelResponse.json().catch(() => null) as DiscordChannel | null;
  if (!channel?.id || !/^\d{16,22}$/.test(channel.id)) {
    logDeliveryFailure('invalid_dm_channel');
    return false;
  }

  const messageResponse = await requestDiscord(
    `${DISCORD_API}/channels/${channel.id}/messages`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(message),
    },
    fetcher,
    delay,
  );
  if (!messageResponse?.ok) {
    logDeliveryFailure('send_message', messageResponse?.status);
    return false;
  }
  return true;
}

async function requestDiscord(
  url: string,
  init: RequestInit,
  fetcher: typeof fetch,
  delay: (milliseconds: number) => Promise<void>,
): Promise<Response | null> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: Response;
    try {
      response = await fetcher(url, {
        ...init,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error: unknown) {
      console.warn(JSON.stringify({
        message: 'Discord DM request failed',
        error: error instanceof Error ? error.message : String(error),
      }));
      return null;
    }
    if (response.status !== 429 || attempt > 0) {
      return response;
    }

    const retryAfterSeconds = Number(response.headers.get('Retry-After') ?? 1);
    const wait = Number.isFinite(retryAfterSeconds)
      ? Math.max(250, retryAfterSeconds * 1_000)
      : 1_000;
    if (wait > MAX_RATE_LIMIT_WAIT_MS) {
      return response;
    }
    await delay(wait);
  }
  return null;
}

function logDeliveryFailure(stage: string, status?: number): void {
  console.warn(JSON.stringify({
    message: 'Discord result DM was not delivered',
    stage,
    ...(status === undefined ? {} : { status }),
  }));
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
