import type { RunSummary } from './game/contracts';

const PROFILE_KEY = 'snake-adventures-player-v1';
interface PlayerProfile { displayName: string; token: string }

export class NamedPlayerReporter {
  private readonly sessionId = crypto.randomUUID();
  constructor(private readonly profile: PlayerProfile, private readonly send: typeof fetch = fetch) {}

  async report(summary?: RunSummary): Promise<void> {
    const body = JSON.stringify({
      displayName: this.profile.displayName,
      platform: 'browser', gameVersion: '1.0.1', sessionId: this.sessionId,
      ...(summary ? { run: { submissionId: crypto.randomUUID(), score: summary.score,
        level: summary.level, won: summary.won, gameVersion: '1.0.1' } } : {}),
    });
    // Reuse the same identifiers if a response is lost, so retries cannot duplicate records.
    for (let attempt = 0; attempt < 2; attempt++) {
      let response: Response | null = null;
      try {
        response = await this.send.call(globalThis, '/api/play', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.profile.token}` },
          body, signal: AbortSignal.timeout(8_000),
        });
      } catch (error: unknown) {
        if (attempt === 1) throw error;
      }
      if (response?.ok) {
        const value: unknown = await response.json();
        if (typeof value !== 'object' || value === null || !('stored' in value) || value.stored !== true) {
          throw new Error('Player service returned an invalid response.');
        }
        return;
      }
      if (response && response.status < 500 && response.status !== 429) throw new Error('Player details could not be saved.');
      if (attempt === 1) throw new Error('Player reporting is unavailable. You can keep playing.');
      await new Promise(resolve => setTimeout(resolve, 5_100));
    }
  }
}

export async function chooseBrowserPlayer(): Promise<NamedPlayerReporter | null> {
  let saved: PlayerProfile | null = null;
  try {
    const value: unknown = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null');
    if (typeof value === 'object' && value !== null && 'displayName' in value && 'token' in value &&
        typeof value.displayName === 'string' && typeof value.token === 'string' && /^[0-9a-f]{64}$/.test(value.token)) {
      saved = { displayName: value.displayName, token: value.token };
    }
  } catch { /* Private/storage-restricted browsers can still play with a session-only profile. */ }
  const dialog = document.createElement('dialog');
  dialog.className = 'player-name-dialog';
  dialog.setAttribute('aria-labelledby', 'player-name-title');
  dialog.innerHTML = `<form>
    <h2 id="player-name-title">Who's playing?</h2>
    <p>Choose a display name, not necessarily your real name.</p>
    <label for="player-name-input">Player name</label>
    <input id="player-name-input" name="playerName" maxlength="32" required autocomplete="nickname" />
    <p>Your name, platform, visits, and completed scores will be saved for the game creators' private player dashboard. This is not a verified account.</p>
    <p><a href="/privacy/" target="_blank" rel="noopener">Privacy details</a></p>
    <p class="player-name-error" role="alert"></p>
    <div class="player-name-actions"><button type="submit">Play and save results</button>
    <button type="button" data-offline>Play offline</button></div>
  </form>`;
  const input = dialog.querySelector('input')!;
  const error = dialog.querySelector('.player-name-error')!;
  input.value = saved?.displayName ?? '';
  document.body.append(dialog);
  return new Promise(resolve => {
    const finish = (result: NamedPlayerReporter | null): void => {
      dialog.close(); dialog.remove(); resolve(result);
    };
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(null); });
    dialog.querySelector('[data-offline]')!.addEventListener('click', () => finish(null));
    dialog.querySelector('form')!.addEventListener('submit', event => {
      event.preventDefault();
      const displayName = input.value.trim().normalize('NFC');
      if (!displayName || displayName.length > 32 || /[\p{Cc}\p{Cf}<>]/u.test(displayName)) {
        error.textContent = 'Use 1–32 characters without control characters or angle brackets.';
        return;
      }
      const token = saved?.token ?? Array.from(crypto.getRandomValues(new Uint8Array(32)),
        byte => byte.toString(16).padStart(2, '0')).join('');
      const profile = { displayName, token };
      try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch { /* Session-only identity. */ }
      finish(new NamedPlayerReporter(profile));
    });
    dialog.showModal();
    input.focus();
  });
}
