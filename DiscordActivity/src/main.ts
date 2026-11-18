import './style.css';
import { CosmeticsService, createDiscordCommerce } from './cosmetics';
import { connectDiscord } from './discord';
import { WebAudioManager } from './game/audio';
import { SnakeGameApp, type ControlAction } from './game/controller';
import type { RunSummary } from './game/contracts';
import { createRunReporter, type RunReporter } from './run-reporter';
import { DiscordPresence } from './presence';
import { PlayerHub, PlayerHubService } from './player-hub';
import { Wardrobe } from './wardrobe';

async function main(): Promise<void> {
  const canvas = requireCanvas('game-canvas');
  const message = requireElement('game-message');
  const runtimeLabel = requireElement('runtime-label');
  const connectionLight = requireElement('connection-light');
  const accessibilityStatus = requireElement('accessibility-status');
  const mobileInfo = requireElement('mobile-info');
  const mobileInfoTitle = requireElement('mobile-info-title');
  const mobileInfoBody = requireElement('mobile-info-body');
  const wardrobeDialog = requireDialog('wardrobe-dialog');
  const playerHubDialog = requireDialog('player-hub-dialog');
  const leaderboardButton = requireButton('leaderboard-button');

  message.textContent = 'Connecting to Discord...';
  message.classList.add('visible');
  const runtime = await connectDiscord();
  message.classList.remove('visible');
  message.textContent = '';

  if (runtime.kind === 'discord') {
    runtimeLabel.textContent = runtime.session ? 'DISCORD | ONLINE' : 'DISCORD ACTIVITY';
    connectionLight.classList.add('discord');
  }

  const audio = new WebAudioManager();
  const reporter: RunReporter | null = runtime.session
    ? createRunReporter(runtime.session.accessToken)
    : null;
  const cosmetics = new CosmeticsService({
    accessToken: runtime.session?.accessToken ?? null,
    commerce: createDiscordCommerce(runtime.sdk),
  });
  const playerHubService = new PlayerHubService({
    accessToken: runtime.session?.accessToken ?? null,
  });
  const presenceSdk = runtime.sdk;
  const presence = presenceSdk && runtime.session
    ? new DiscordPresence((payload) => presenceSdk.commands.setActivity(payload))
    : null;
  let app: SnakeGameApp;
  let wardrobe: Wardrobe;
  let playerHub: PlayerHub;
  const submitCompletedRun = (summary: RunSummary): void => {
    if (!reporter) {
      return;
    }
    void reporter.submit(summary)
      .then((result) => {
        playerHub.refreshAfterRun();
        const status = completedRunStatus(summary, result);
        app.showStatus(status);
      })
      .catch((error: unknown) => {
        const reason = error instanceof Error ? ` ${error.message}` : '';
        app.showStatus(`Score ${summary.score} could not be saved.${reason}`);
      });
  };

  app = new SnakeGameApp({
    canvas,
    messageElement: message,
    accessibilityStatusElement: accessibilityStatus,
    mobileInfoElement: mobileInfo,
    mobileInfoTitleElement: mobileInfoTitle,
    mobileInfoBodyElement: mobileInfoBody,
    audio,
    onRunCompleted: submitCompletedRun,
    onPresenceChange: (update) => presence?.update(update),
    onOpenWardrobe: () => wardrobe.open(),
    exitMessage: runtime.kind === 'discord'
      ? "Use Discord's Leave Activity control to exit."
      : 'Close this browser tab when you are finished playing.',
    onExit: () => {
      if (runtime.kind === 'browser') {
        window.close();
      }
    },
  });
  wardrobe = new Wardrobe({
    dialog: wardrobeDialog,
    service: cosmetics,
    onEquipped: (id) => app.setEquippedSkin(id),
    onOpenChange: (open) => app.setOverlayOpen(open),
    showStatus: (status) => app.showStatus(status),
  });
  playerHub = new PlayerHub({
    dialog: playerHubDialog,
    service: playerHubService,
    shareLeaderboard: runtime.sdk && runtime.session
      ? async (shareMessage) => {
          const { success } = await runtime.sdk.commands.shareLink({
            message: shareMessage,
            custom_id: 'leaderboard',
          });
          return success;
        }
      : null,
    onOpenChange: (open) => app.setOverlayOpen(open),
    showStatus: (status) => app.showStatus(status),
  });
  leaderboardButton.addEventListener('click', () => playerHub.open());

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action]')) {
    button.addEventListener('click', () => {
      const action = button.dataset.action;
      if (isControlAction(action)) {
        app.handleControl(action);
      }
    });
  }

  const handleLayoutMode = (update: { layout_mode: -1 | 0 | 1 | 2 }): void => {
    const focused = update.layout_mode === 0;
    document.body.dataset.layoutMode = focused ? 'focused' : 'compact';
    app.handleHostFocus(focused);
  };
  if (runtime.sdk) {
    void runtime.sdk
      .subscribe('ACTIVITY_LAYOUT_MODE_UPDATE', handleLayoutMode)
      .catch(() => undefined);
  }

  window.addEventListener('beforeunload', () => {
    if (runtime.sdk) {
      void runtime.sdk
        .unsubscribe('ACTIVITY_LAYOUT_MODE_UPDATE', handleLayoutMode)
        .catch(() => undefined);
    }
    app.dispose();
    wardrobe.dispose();
    playerHub.dispose();
    cosmetics.dispose();
    presence?.dispose();
    void audio.dispose().catch(() => undefined);
  });
  app.start();
  if (runtime.sdk?.customId === 'leaderboard') {
    playerHub.open();
  }
  void playerHub.initialize().catch((error: unknown) => {
    if (runtime.session) {
      const reason = error instanceof Error ? error.message : 'The leaderboard is unavailable.';
      app.showStatus(reason);
    }
  });
  void cosmetics.initialize().catch((error: unknown) => {
    if (runtime.kind === 'discord' && runtime.session) {
      const reason = error instanceof Error ? error.message : 'The Wardrobe service is unavailable.';
      app.showStatus(reason);
    }
  });
  if (runtime.kind === 'discord' && runtime.session) {
    const displayName = runtime.session.user.globalName ?? runtime.session.user.username;
    app.showStatus(`Connected as ${displayName}. Open Top 10 to manage private result DMs.`);
  } else if (runtime.kind === 'discord' && runtime.authenticationError) {
    app.showStatus(`${runtime.authenticationError} The game can still be played.`);
  }
}

function completedRunStatus(
  summary: RunSummary,
  result: Awaited<ReturnType<RunReporter['submit']>>,
): string {
  const rank = result.rank === null ? '' : ` Rank #${result.rank}.`;
  if (result.duplicate) {
    return `Score ${summary.score} was already saved.${rank}`;
  }
  if (result.dmStatus === 'sent') {
    return `Score ${summary.score} saved and sent to your DMs.${rank}`;
  }
  if (result.dmStatus === 'failed') {
    return `Score ${summary.score} saved, but the private result DM was unavailable.${rank}`;
  }
  if (result.dmStatus === 'preferenceUnavailable') {
    return `Score ${summary.score} saved, but your DM setting could not be checked.${rank}`;
  }
  return `Score ${summary.score} saved.${rank} Enable private DMs in Top 10.`;
}

function requireDialog(id: string): HTMLDialogElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLDialogElement)) {
    throw new Error(`Missing required dialog #${id}.`);
  }
  return element;
}

function requireElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing required element #${id}.`);
  }
  return element;
}

function requireButton(id: string): HTMLButtonElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLButtonElement)) {
    throw new Error(`Missing required button #${id}.`);
  }
  return element;
}

function requireCanvas(id: string): HTMLCanvasElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLCanvasElement)) {
    throw new Error(`Missing required canvas #${id}.`);
  }
  return element;
}

function isControlAction(value: string | undefined): value is ControlAction {
  return value === 'up' ||
    value === 'down' ||
    value === 'left' ||
    value === 'right' ||
    value === 'pause' ||
    value === 'restart';
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Snake Adventures failed to start.';
  document.body.innerHTML = '';
  const panel = document.createElement('main');
  panel.className = 'startup-error';
  const heading = document.createElement('h1');
  heading.textContent = 'Unable to start';
  const details = document.createElement('p');
  details.textContent = message;
  panel.append(heading, details);
  document.body.append(panel);
});
