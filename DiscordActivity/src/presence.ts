import type { GamePresence } from './game/contracts';

const REGULAR_UPDATE_INTERVAL_MS = 15_000;
const STATE_UPDATE_INTERVAL_MS = 2_000;

export type RichPresencePayload = ReturnType<typeof buildRichPresence>;

export class DiscordPresence {
  private latest: GamePresence | null = null;
  private latestUrgentKey = '';
  private lastSentPayload = '';
  private lastSentAt = Number.NEGATIVE_INFINITY;
  private timer: number | null = null;
  private scheduledFor = Number.POSITIVE_INFINITY;
  private sending = false;
  private disposed = false;

  constructor(
    private readonly setActivity: (payload: RichPresencePayload) => Promise<unknown>,
    private readonly now: () => number = Date.now,
  ) {}

  update(presence: GamePresence): void {
    if (this.disposed) {
      return;
    }
    this.latest = presence;
    const urgentKey = `${presence.phase}:${presence.encounter}:${presence.level}`;
    const stateChanged = urgentKey !== this.latestUrgentKey;
    this.latestUrgentKey = urgentKey;
    const interval = stateChanged ? STATE_UPDATE_INTERVAL_MS : REGULAR_UPDATE_INTERVAL_MS;
    this.schedule(this.lastSentAt + interval);
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private schedule(earliest: number): void {
    const scheduledFor = Math.max(this.now(), earliest);
    if (this.timer !== null && this.scheduledFor <= scheduledFor) {
      return;
    }
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
    }
    this.scheduledFor = scheduledFor;
    const delay = Math.max(0, scheduledFor - this.now());
    this.timer = window.setTimeout(() => {
      this.timer = null;
      this.scheduledFor = Number.POSITIVE_INFINITY;
      void this.flush();
    }, delay);
  }

  private async flush(): Promise<void> {
    if (this.disposed || !this.latest) {
      return;
    }
    if (this.sending) {
      this.schedule(this.now() + STATE_UPDATE_INTERVAL_MS);
      return;
    }

    const snapshot = this.latest;
    const payload = buildRichPresence(snapshot);
    const payloadKey = JSON.stringify(payload);
    if (payloadKey === this.lastSentPayload) {
      return;
    }

    this.sending = true;
    try {
      await this.setActivity(payload);
      this.lastSentPayload = payloadKey;
    } catch (error: unknown) {
      console.warn('Discord Rich Presence update failed.', error);
    } finally {
      this.lastSentAt = this.now();
      this.sending = false;
      if (this.latest !== snapshot) {
        this.schedule(this.lastSentAt + STATE_UPDATE_INTERVAL_MS);
      }
    }
  }
}

export function buildRichPresence(presence: GamePresence) {
  const details = presence.phase === 'menu'
    ? 'Preparing an adventure'
    : presence.phase === 'paused'
      ? 'Run Paused'
      : presence.phase === 'gameOver'
        ? 'Adventure Ended'
        : presence.encounter === 'hollowKing'
          ? 'Battling the Hollow King'
          : presence.encounter === 'phantom'
            ? 'Phantom Hunt'
            : 'Endless Adventure';
  const state = presence.phase === 'menu'
    ? 'Main Menu'
    : presence.phase === 'gameOver'
      ? `Final Score ${presence.score} | Level ${presence.level}`
      : `Score ${presence.score} | Level ${presence.level}`;
  const smallAsset = presence.encounter === 'hollowKing'
    ? { small_image: 'hollow-king', small_text: 'Facing the Hollow King' }
    : presence.encounter === 'phantom'
      ? { small_image: 'phantom-fruit', small_text: 'Phantom power active' }
      : { small_image: 'wren', small_text: presence.phase === 'menu' ? 'Wren awaits' : 'Wren is hunting' };

  return {
    activity: {
      type: 0,
      details,
      state,
      assets: {
        large_image: 'snake-adventures',
        large_text: 'Snake Adventures',
        ...smallAsset,
      },
      ...(presence.startedAt === null ? {} : {
        timestamps: { start: presence.startedAt },
      }),
    },
  };
}
