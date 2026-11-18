export interface PlayerPreferences {
  resultDmEnabled: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  highScore: number;
  highestLevel: number;
}

export interface LeaderboardSnapshot {
  entries: LeaderboardEntry[];
  player: LeaderboardEntry | null;
}

interface PlayerHubServiceOptions {
  accessToken: string | null;
  fetcher?: typeof fetch;
}

interface PlayerHubOptions {
  dialog: HTMLDialogElement;
  service: PlayerHubService;
  shareLeaderboard: ((message: string) => Promise<boolean>) | null;
  onOpenChange(open: boolean): void;
  showStatus(message: string): void;
}

export class PlayerHubService {
  private readonly accessToken: string | null;
  private readonly fetcher: typeof fetch;

  constructor(options: PlayerHubServiceOptions) {
    this.accessToken = options.accessToken;
    this.fetcher = options.fetcher ?? ((input, init) => globalThis.fetch(input, init));
  }

  get available(): boolean {
    return this.accessToken !== null;
  }

  async getPreferences(): Promise<PlayerPreferences> {
    return this.request('/api/preferences', undefined, isPlayerPreferences, 'Player preferences');
  }

  async setResultDmEnabled(resultDmEnabled: boolean): Promise<PlayerPreferences> {
    return this.request('/api/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resultDmEnabled }),
    }, isPlayerPreferences, 'Player preferences');
  }

  async getLeaderboard(): Promise<LeaderboardSnapshot> {
    return this.request('/api/leaderboard', undefined, isLeaderboardSnapshot, 'Leaderboard');
  }

  private async request<T>(
    url: string,
    init: RequestInit | undefined,
    validate: (value: unknown) => value is T,
    serviceName: string,
  ): Promise<T> {
    if (!this.accessToken) {
      throw new Error(`${serviceName} is available inside Discord.`);
    }
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${this.accessToken}`);
    const response = await this.fetcher(url, { ...init, headers });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(errorMessage(payload, `${serviceName} is temporarily unavailable.`));
    }
    if (!validate(payload)) {
      throw new Error(`${serviceName} returned an invalid response.`);
    }
    return payload;
  }
}

export class PlayerHub {
  private readonly dialog: HTMLDialogElement;
  private readonly service: PlayerHubService;
  private readonly shareLeaderboard: ((message: string) => Promise<boolean>) | null;
  private readonly onOpenChange: (open: boolean) => void;
  private readonly showStatus: (message: string) => void;
  private readonly list: HTMLOListElement;
  private readonly playerRank: HTMLElement;
  private readonly playerBest: HTMLElement;
  private readonly dmToggle: HTMLInputElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly refreshButton: HTMLButtonElement;
  private readonly shareButton: HTMLButtonElement;
  private readonly status: HTMLElement;
  private preferences: PlayerPreferences = { resultDmEnabled: false };
  private leaderboard: LeaderboardSnapshot | null = null;
  private preferencesLoaded = false;
  private busy = false;
  private refreshQueued = false;
  private pendingFocus: 'dm' | 'refresh' | 'share' | null = null;

  constructor(options: PlayerHubOptions) {
    this.dialog = options.dialog;
    this.service = options.service;
    this.shareLeaderboard = options.shareLeaderboard;
    this.onOpenChange = options.onOpenChange;
    this.showStatus = options.showStatus;
    this.list = requireList(this.dialog, '[data-leaderboard-list]');
    this.playerRank = requireDescendant(this.dialog, '[data-player-rank]');
    this.playerBest = requireDescendant(this.dialog, '[data-player-best]');
    this.dmToggle = requireInput(this.dialog, '[data-result-dm-toggle]');
    this.closeButton = requireButton(this.dialog, '[data-player-hub-close]');
    this.refreshButton = requireButton(this.dialog, '[data-leaderboard-refresh]');
    this.shareButton = requireButton(this.dialog, '[data-leaderboard-share]');
    this.status = requireDescendant(this.dialog, '[data-leaderboard-status]');

    this.closeButton.addEventListener('click', () => this.close());
    this.refreshButton.addEventListener('click', () => {
      this.pendingFocus = 'refresh';
      void this.refresh(true);
    });
    this.shareButton.addEventListener('click', () => void this.handleShare());
    this.dmToggle.addEventListener('change', () => void this.handleDmPreference());
    this.dialog.addEventListener('close', this.handleClose);
    this.dialog.addEventListener('cancel', this.handleCancel);
    this.render();
  }

  open(): void {
    if (!this.dialog.open) {
      this.dialog.showModal();
    }
    this.onOpenChange(true);
    this.closeButton.focus({ preventScroll: true });
    void this.refresh(false);
  }

  close(): void {
    if (this.dialog.open) {
      this.dialog.close();
    }
  }

  async initialize(): Promise<void> {
    await this.refresh(false);
  }

  refreshAfterRun(): void {
    if (this.busy) {
      this.refreshQueued = true;
      return;
    }
    void this.refresh(false).catch(() => undefined);
  }

  dispose(): void {
    this.dialog.removeEventListener('close', this.handleClose);
    this.dialog.removeEventListener('cancel', this.handleCancel);
  }

  private async refresh(reportSuccess: boolean): Promise<void> {
    if (this.busy) {
      return;
    }
    if (!this.service.available) {
      this.status.textContent = 'Launch Snake Adventures inside Discord to view online records.';
      this.render();
      return;
    }

    this.busy = true;
    this.status.textContent = 'Opening the Hollow Archives...';
    this.render();
    const [preferences, leaderboard] = await Promise.allSettled([
      this.service.getPreferences(),
      this.service.getLeaderboard(),
    ]);
    if (preferences.status === 'fulfilled') {
      this.preferences = preferences.value;
      this.preferencesLoaded = true;
    }
    if (leaderboard.status === 'fulfilled') {
      this.leaderboard = leaderboard.value;
    }
    const failure = preferences.status === 'rejected'
      ? preferences.reason
      : leaderboard.status === 'rejected'
        ? leaderboard.reason
        : null;
    this.busy = false;
    const message = failure instanceof Error
      ? failure.message
      : failure
        ? 'The Hollow Archives are temporarily unavailable.'
        : reportSuccess
          ? 'Leaderboard refreshed.'
          : this.preferences.resultDmEnabled
            ? 'Private result DMs are enabled.'
            : 'Enable private DMs below to receive future run results.';
    this.status.textContent = message;
    this.render();
    if (failure && reportSuccess) {
      this.showStatus(message);
    }
    if (!this.runQueuedRefresh()) {
      this.restorePendingFocus();
    }
  }

  private async handleDmPreference(): Promise<void> {
    const requested = this.dmToggle.checked;
    const previous = this.preferences.resultDmEnabled;
    this.pendingFocus = 'dm';
    this.preferences = { resultDmEnabled: requested };
    this.busy = true;
    this.status.textContent = requested ? 'Enabling private result DMs...' : 'Turning result DMs off...';
    this.render();
    try {
      this.preferences = await this.service.setResultDmEnabled(requested);
      this.preferencesLoaded = true;
      const message = requested
        ? 'Private result DMs enabled for future completed runs.'
        : 'Private result DMs turned off.';
      this.status.textContent = message;
      this.showStatus(message);
    } catch (error: unknown) {
      this.preferences = { resultDmEnabled: previous };
      this.preferencesLoaded = false;
      const reason = error instanceof Error ? error.message : 'The DM preference could not be saved.';
      const message = `${reason} Refresh to confirm your current setting.`;
      this.status.textContent = message;
      this.showStatus(message);
    } finally {
      this.busy = false;
      this.render();
      if (!this.runQueuedRefresh()) {
        this.restorePendingFocus();
      }
    }
  }

  private async handleShare(): Promise<void> {
    if (!this.leaderboard || !this.shareLeaderboard) {
      return;
    }
    this.pendingFocus = 'share';
    this.busy = true;
    this.status.textContent = 'Opening Discord share...';
    this.render();
    try {
      const shared = await this.shareLeaderboard(buildLeaderboardShareMessage(this.leaderboard));
      const message = shared ? 'Leaderboard shared.' : 'Share canceled.';
      this.status.textContent = message;
      if (shared) {
        this.showStatus(message);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'The leaderboard could not be shared.';
      this.status.textContent = message;
      this.showStatus(message);
    } finally {
      this.busy = false;
      this.render();
      if (!this.runQueuedRefresh()) {
        this.restorePendingFocus();
      }
    }
  }

  private render(): void {
    this.dmToggle.checked = this.preferences.resultDmEnabled;
    this.dmToggle.disabled = this.busy || !this.service.available || !this.preferencesLoaded;
    this.refreshButton.disabled = this.busy || !this.service.available;
    this.shareButton.disabled = this.busy || !this.leaderboard || !this.shareLeaderboard;

    const player = this.leaderboard?.player;
    this.playerRank.textContent = player ? `#${player.rank}` : '--';
    this.playerBest.textContent = player
      ? `${player.highScore.toLocaleString('en-US')} PTS | LEVEL ${player.highestLevel}`
      : 'COMPLETE A RUN TO ENTER';

    const rows = (this.leaderboard?.entries ?? []).map((entry) => {
      const item = document.createElement('li');
      const rank = document.createElement('span');
      rank.className = 'leaderboard-rank';
      rank.textContent = `#${entry.rank}`;
      const name = document.createElement('strong');
      name.textContent = entry.displayName;
      const score = document.createElement('span');
      score.className = 'leaderboard-score';
      score.textContent = entry.highScore.toLocaleString('en-US');
      const level = document.createElement('small');
      level.textContent = `LV ${entry.highestLevel}`;
      item.append(rank, name, score, level);
      return item;
    });
    if (rows.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'leaderboard-empty';
      empty.textContent = this.service.available ? 'No completed runs yet.' : 'Discord records unavailable in browser mode.';
      rows.push(empty);
    }
    this.list.replaceChildren(...rows);
  }

  private runQueuedRefresh(): boolean {
    if (!this.refreshQueued || this.busy) {
      return false;
    }
    this.refreshQueued = false;
    void this.refresh(false).catch(() => undefined);
    return true;
  }

  private restorePendingFocus(): void {
    if (!this.pendingFocus || !this.dialog.open) {
      this.pendingFocus = null;
      return;
    }
    const requested = this.pendingFocus === 'dm'
      ? this.dmToggle
      : this.pendingFocus === 'share'
        ? this.shareButton
        : this.refreshButton;
    const target = requested.disabled
      ? !this.refreshButton.disabled ? this.refreshButton : this.closeButton
      : requested;
    this.pendingFocus = null;
    target.focus({ preventScroll: true });
  }

  private readonly handleClose = (): void => {
    this.onOpenChange(false);
  };

  private readonly handleCancel = (event: Event): void => {
    event.preventDefault();
    this.close();
  };
}

export function buildLeaderboardShareMessage(snapshot: LeaderboardSnapshot): string {
  const topScore = snapshot.entries[0]?.highScore;
  const rank = snapshot.player?.rank;
  const standing = rank ? ` I'm ranked #${rank}.` : '';
  const lead = topScore === undefined
    ? 'The first adventure is waiting.'
    : `The top score is ${topScore.toLocaleString('en-US')}.`;
  return `Snake Adventures Lifetime Top 10. ${lead}${standing} Can you climb the leaderboard?`;
}

function isPlayerPreferences(value: unknown): value is PlayerPreferences {
  return isRecord(value) && typeof value.resultDmEnabled === 'boolean';
}

function isLeaderboardSnapshot(value: unknown): value is LeaderboardSnapshot {
  return isRecord(value) &&
    Array.isArray(value.entries) &&
    value.entries.length <= 10 &&
    value.entries.every(isLeaderboardEntry) &&
    (value.player === null || isLeaderboardEntry(value.player));
}

function isLeaderboardEntry(value: unknown): value is LeaderboardEntry {
  return isRecord(value) &&
    typeof value.rank === 'number' &&
    Number.isInteger(value.rank) &&
    value.rank > 0 &&
    typeof value.displayName === 'string' &&
    value.displayName.length > 0 &&
    value.displayName.length <= 80 &&
    typeof value.highScore === 'number' &&
    Number.isInteger(value.highScore) &&
    value.highScore >= 0 &&
    typeof value.highestLevel === 'number' &&
    Number.isInteger(value.highestLevel) &&
    value.highestLevel >= 1;
}

function errorMessage(value: unknown, fallback: string): string {
  return isRecord(value) && typeof value.error === 'string' ? value.error : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function requireDescendant(root: ParentNode, selector: string): HTMLElement {
  const element = root.querySelector(selector);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing player records element ${selector}.`);
  }
  return element;
}

function requireButton(root: ParentNode, selector: string): HTMLButtonElement {
  const element = root.querySelector(selector);
  if (!(element instanceof HTMLButtonElement)) {
    throw new Error(`Missing player records button ${selector}.`);
  }
  return element;
}

function requireInput(root: ParentNode, selector: string): HTMLInputElement {
  const element = root.querySelector(selector);
  if (!(element instanceof HTMLInputElement)) {
    throw new Error(`Missing player records input ${selector}.`);
  }
  return element;
}

function requireList(root: ParentNode, selector: string): HTMLOListElement {
  const element = root.querySelector(selector);
  if (!(element instanceof HTMLOListElement)) {
    throw new Error(`Missing player records list ${selector}.`);
  }
  return element;
}
