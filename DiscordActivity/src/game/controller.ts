import {
  rectContains,
  type GameAudio,
  type GamePresence,
  type Point,
  type RunSummary,
} from './contracts';
import type { CosmeticId } from '../../shared/cosmetics';
import { BOSS_DEFEAT_SCORE, GameModel } from './model';
import {
  GameRenderer,
  canvasPoint,
  getMenuButtons,
  getPauseButtons,
  type ScreenPage,
} from './renderer';

export type ControlAction = 'up' | 'down' | 'left' | 'right' | 'pause' | 'restart';

interface GameAppOptions {
  canvas: HTMLCanvasElement;
  messageElement: HTMLElement;
  accessibilityStatusElement: HTMLElement;
  mobileInfoElement: HTMLElement;
  mobileInfoTitleElement: HTMLElement;
  mobileInfoBodyElement: HTMLElement;
  audio: GameAudio;
  exitMessage: string;
  onRunCompleted?(summary: RunSummary): void;
  onPresenceChange?(presence: GamePresence): void;
  onOpenWardrobe(): void;
  onExit(): void;
}

const DIRECTIONS: Record<Exclude<ControlAction, 'pause' | 'restart'>, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export class SnakeGameApp {
  private readonly canvas: HTMLCanvasElement;
  private readonly messageElement: HTMLElement;
  private readonly accessibilityStatusElement: HTMLElement;
  private readonly mobileInfoElement: HTMLElement;
  private readonly mobileInfoTitleElement: HTMLElement;
  private readonly mobileInfoBodyElement: HTMLElement;
  private readonly audio: GameAudio;
  private readonly renderer: GameRenderer;
  private readonly model: GameModel;
  private readonly exitMessage: string;
  private readonly onExit: () => void;
  private readonly onOpenWardrobe: () => void;
  private readonly onPresenceChange: (presence: GamePresence) => void;

  private mode: 'opening' | 'game' = 'opening';
  private screenPage: ScreenPage = 'menu';
  private selectedButton = 0;
  private hoveredButton = -1;
  private pauseSelectedButton = 0;
  private pauseHoveredButton = -1;
  private openingAnimationFrame = 0;
  private openingTimer: number | null = null;
  private gameTimer: number | null = null;
  private messageTimer: number | null = null;
  private pointerStart: Point | null = null;
  private activePointerId: number | null = null;
  private lastAccessibilityStatus = '';
  private disposed = false;
  private overlayOpen = false;
  private runStartedAt: number | null = null;
  private lastPresenceKey = '';

  constructor(options: GameAppOptions) {
    this.canvas = options.canvas;
    this.messageElement = options.messageElement;
    this.accessibilityStatusElement = options.accessibilityStatusElement;
    this.mobileInfoElement = options.mobileInfoElement;
    this.mobileInfoTitleElement = options.mobileInfoTitleElement;
    this.mobileInfoBodyElement = options.mobileInfoBodyElement;
    this.audio = options.audio;
    this.exitMessage = options.exitMessage;
    this.onExit = options.onExit;
    this.onOpenWardrobe = options.onOpenWardrobe;
    this.onPresenceChange = options.onPresenceChange ?? (() => undefined);
    this.renderer = new GameRenderer(this.canvas);
    this.model = new GameModel(this.audio, Math.random, (summary) => {
      document.body.dataset.runState = 'ended';
      options.onRunCompleted?.(summary);
    });

    window.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('pointercancel', this.handlePointerCancel);
    this.canvas.addEventListener('pointerleave', this.handlePointerLeave);
  }

  start(): void {
    this.showOpeningScreen();
    this.canvas.focus({ preventScroll: true });
  }

  handleControl(action: ControlAction): void {
    if (this.overlayOpen) {
      return;
    }
    this.unlockAudio();
    this.canvas.focus({ preventScroll: true });

    if (this.mode === 'opening') {
      if (action === 'up' || action === 'left') {
        this.selectOpeningButton(-1);
      } else if (action === 'down' || action === 'right') {
        this.selectOpeningButton(1);
      } else if (action === 'pause') {
        this.activateOpeningButton(this.selectedButton);
      } else if (action === 'restart' && this.screenPage !== 'menu') {
        this.goBackOneOpeningPage();
      }
      return;
    }

    if (action === 'restart') {
      this.startGame();
      return;
    }
    if (action === 'pause') {
      this.togglePause();
      return;
    }

    if (this.model.paused) {
      this.selectPauseButton(action === 'up' || action === 'left' ? -1 : 1);
    } else if (!this.model.gameOver) {
      this.model.setDirection(DIRECTIONS[action]);
    }
  }

  handleHostFocus(focused: boolean): void {
    if (focused) {
      if (this.mode === 'opening') {
        this.audio.resumeMusic();
      }
      return;
    }

    if (this.mode === 'opening') {
      this.audio.suspendMusic();
    } else if (!this.model.paused && !this.model.gameOver) {
      this.togglePause();
    }
  }

  dispose(): void {
    this.disposed = true;
    this.cancelOpeningTimer();
    this.cancelGameTimer();
    if (this.messageTimer !== null) {
      window.clearTimeout(this.messageTimer);
    }
    window.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointercancel', this.handlePointerCancel);
    this.canvas.removeEventListener('pointerleave', this.handlePointerLeave);
  }

  showStatus(message: string): void {
    if (this.disposed) {
      return;
    }
    this.showMessage(message);
  }

  setEquippedSkin(id: CosmeticId): void {
    this.renderer.setEquippedSkin(id);
    this.render();
  }

  setOverlayOpen(open: boolean): void {
    if (this.overlayOpen === open) {
      return;
    }
    this.overlayOpen = open;
    if (open) {
      this.cancelOpeningTimer();
      this.clearPointer();
      this.canvas.style.cursor = 'default';
      return;
    }
    if (this.mode === 'opening') {
      this.startOpeningTimer();
      this.render();
    }
    this.canvas.focus({ preventScroll: true });
  }

  private showOpeningScreen(): void {
    this.cancelGameTimer();
    this.mode = 'opening';
    this.runStartedAt = null;
    document.body.dataset.gameMode = this.mode;
    document.body.dataset.screenPage = 'menu';
    delete document.body.dataset.runState;
    this.screenPage = 'menu';
    this.selectedButton = 0;
    this.hoveredButton = -1;
    this.audio.playMusic('menu');
    this.audio.resumeMusic();
    this.cancelOpeningTimer();
    this.startOpeningTimer();
    this.render();
  }

  private startGame(): void {
    this.cancelOpeningTimer();
    this.cancelGameTimer();
    this.mode = 'game';
    this.runStartedAt = Math.floor(Date.now() / 1000);
    document.body.dataset.gameMode = this.mode;
    document.body.dataset.runState = 'active';
    delete document.body.dataset.screenPage;
    this.pauseSelectedButton = 0;
    this.pauseHoveredButton = -1;
    this.hoveredButton = -1;
    this.model.startGame();
    this.render();
    this.scheduleGameTick();
  }

  private scheduleGameTick(): void {
    if (this.mode !== 'game' || this.model.paused || this.model.gameOver || this.gameTimer !== null) {
      return;
    }
    this.gameTimer = window.setTimeout(() => {
      this.gameTimer = null;
      this.model.tick();
      this.render();
      this.scheduleGameTick();
    }, this.model.currentTickMilliseconds);
  }

  private render(): void {
    if (this.mode === 'opening') {
      this.renderer.renderOpening(
        this.screenPage,
        this.openingAnimationFrame,
        this.selectedButton,
        this.hoveredButton,
        this.audio,
      );
    } else {
      this.renderer.renderGame(this.model, this.pauseSelectedButton, this.pauseHoveredButton);
    }
    this.updateAccessibleState();
    this.publishPresence();
  }

  private publishPresence(): void {
    const phase = this.mode === 'opening'
      ? 'menu'
      : this.model.gameOver
        ? 'gameOver'
        : this.model.paused
          ? 'paused'
          : 'playing';
    const encounter = this.mode === 'opening'
      ? null
      : this.model.bossActive || this.model.bossDefeatTimeRemainingMilliseconds > 0
        ? 'hollowKing'
        : this.model.isPowered
          ? 'phantom'
          : 'wren';
    const presence: GamePresence = {
      phase,
      encounter,
      score: this.mode === 'game' ? this.model.score : 0,
      level: this.mode === 'game' ? this.model.level : 1,
      startedAt: this.mode === 'game' ? this.runStartedAt : null,
    };
    const key = JSON.stringify(presence);
    if (key === this.lastPresenceKey) {
      return;
    }
    this.lastPresenceKey = key;
    this.onPresenceChange(presence);
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (this.overlayOpen) {
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    if (event.target instanceof HTMLButtonElement || event.target instanceof HTMLInputElement) {
      return;
    }

    const key = event.key.toLowerCase();
    const handledKeys = new Set([
      'arrowup', 'arrowdown', 'arrowleft', 'arrowright',
      'w', 'a', 's', 'd', 'enter', ' ', 'escape', 'm', 'p', 'r',
    ]);
    if (!handledKeys.has(key)) {
      return;
    }

    const repeatedToggle =
      key === 'm' ||
      key === 'p' ||
      key === 'r' ||
      key === 'enter' ||
      key === ' ' ||
      key === 'escape' ||
      (key === 's' && (this.mode === 'opening' || this.model.paused));
    if (event.repeat && repeatedToggle) {
      return;
    }

    event.preventDefault();
    this.unlockAudio();

    if (this.mode === 'opening') {
      this.handleOpeningKey(key);
      return;
    }
    this.handleGameKey(key);
  };

  private handleOpeningKey(key: string): void {
    if (key === 'm') {
      this.toggleMusic();
      return;
    }
    if (key === 's') {
      this.toggleSoundEffects();
      return;
    }
    if (key === 'escape') {
      if (this.screenPage === 'menu') {
        this.requestExit();
      } else {
        this.goBackOneOpeningPage();
      }
      return;
    }
    if (key === 'arrowup' || key === 'arrowleft') {
      this.selectOpeningButton(-1);
      return;
    }
    if (key === 'arrowdown' || key === 'arrowright') {
      this.selectOpeningButton(1);
      return;
    }
    if (key === 'enter' || key === ' ') {
      this.activateOpeningButton(this.selectedButton);
    }
  }

  private handleGameKey(key: string): void {
    if (key === 'r') {
      this.startGame();
      return;
    }
    if (key === 'p' && !this.model.gameOver) {
      this.togglePause();
      return;
    }

    if (this.model.paused) {
      this.handlePauseKey(key);
      return;
    }
    if (this.model.gameOver) {
      if (key === ' ' || key === 'enter') {
        this.startGame();
      }
      return;
    }

    const direction = key === 'arrowup' || key === 'w'
      ? DIRECTIONS.up
      : key === 'arrowdown' || key === 's'
        ? DIRECTIONS.down
        : key === 'arrowleft' || key === 'a'
          ? DIRECTIONS.left
          : key === 'arrowright' || key === 'd'
            ? DIRECTIONS.right
            : null;
    if (direction) {
      this.model.setDirection(direction);
    }
  }

  private handlePauseKey(key: string): void {
    if (key === 'escape') {
      this.resumeGame();
    } else if (key === 'm') {
      this.toggleMusic();
    } else if (key === 's') {
      this.toggleSoundEffects();
    } else if (key === 'arrowup' || key === 'arrowleft') {
      this.selectPauseButton(-1);
    } else if (key === 'arrowdown' || key === 'arrowright') {
      this.selectPauseButton(1);
    } else if (key === 'enter' || key === ' ') {
      this.activatePauseButton(this.pauseSelectedButton);
    }
  }

  private selectOpeningButton(offset: number): void {
    const count = getMenuButtons(this.screenPage, this.audio).length;
    const next = (this.selectedButton + offset + count) % count;
    if (next === this.selectedButton) {
      return;
    }
    this.selectedButton = next;
    this.hoveredButton = -1;
    this.audio.playCue('menuMove');
    this.render();
  }

  private activateOpeningButton(index: number): void {
    this.audio.playCue('menuMove');
    const action = getMenuButtons(this.screenPage, this.audio)[index]?.action;
    if (!action) {
      return;
    }
    switch (action) {
      case 'play':
        this.startGame();
        break;
      case 'wardrobe':
        this.onOpenWardrobe();
        break;
      case 'rules':
        this.setOpeningPage('rulesBasics');
        break;
      case 'music':
        this.toggleMusic(false);
        break;
      case 'sfx':
        this.toggleSoundEffects(false);
        break;
      case 'exit':
        this.requestExit();
        break;
      case 'back':
        this.goBackOneOpeningPage();
        break;
      case 'next':
        this.setOpeningPage('rulesBoss');
        break;
    }
  }

  private setOpeningPage(page: ScreenPage): void {
    this.screenPage = page;
    document.body.dataset.screenPage = page;
    this.selectedButton = page === 'menu' ? 0 : 1;
    this.hoveredButton = -1;
    this.render();
  }

  private goBackOneOpeningPage(): void {
    this.setOpeningPage(this.screenPage === 'rulesBoss' ? 'rulesBasics' : 'menu');
  }

  private togglePause(): void {
    if (this.model.paused) {
      this.resumeGame();
      return;
    }
    if (this.model.gameOver) {
      return;
    }
    this.model.pause();
    this.pauseSelectedButton = 0;
    this.pauseHoveredButton = -1;
    this.cancelGameTimer();
    this.render();
  }

  private resumeGame(): void {
    this.model.resume();
    this.pauseHoveredButton = -1;
    this.render();
    this.scheduleGameTick();
  }

  private selectPauseButton(offset: number): void {
    const count = getPauseButtons(this.audio).length;
    const next = (this.pauseSelectedButton + offset + count) % count;
    if (next === this.pauseSelectedButton) {
      return;
    }
    this.pauseSelectedButton = next;
    this.pauseHoveredButton = -1;
    this.audio.playCue('menuMove');
    this.render();
  }

  private activatePauseButton(index: number): void {
    if (index === 0) {
      this.audio.playCue('menuMove');
      this.resumeGame();
    } else if (index === 1) {
      this.toggleMusic();
    } else if (index === 2) {
      this.toggleSoundEffects();
    } else if (index === 3) {
      this.audio.playCue('menuMove');
      this.showOpeningScreen();
    }
  }

  private toggleMusic(playCue = true): void {
    this.audio.setMusicEnabled(!this.audio.musicEnabled);
    if (playCue) {
      this.audio.playCue('menuMove');
    }
    this.render();
  }

  private toggleSoundEffects(playCue = true): void {
    const enabled = !this.audio.soundEffectsEnabled;
    if (playCue && !enabled) {
      this.audio.playCue('menuMove');
    }
    this.audio.setSoundEffectsEnabled(enabled);
    if (playCue && enabled) {
      this.audio.playCue('menuMove');
    }
    this.render();
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (this.overlayOpen) {
      return;
    }
    if (event.button !== 0 && event.pointerType === 'mouse') {
      return;
    }
    event.preventDefault();
    this.unlockAudio();
    this.canvas.focus({ preventScroll: true });
    this.pointerStart = canvasPoint(this.canvas, event);
    this.activePointerId = event.pointerId;
    this.canvas.setPointerCapture(event.pointerId);
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (this.overlayOpen) {
      return;
    }
    if (event.pointerType !== 'mouse') {
      return;
    }
    const point = canvasPoint(this.canvas, event);
    if (this.mode === 'opening') {
      const hit = this.hitTest(getMenuButtons(this.screenPage, this.audio), point);
      if (hit !== this.hoveredButton) {
        this.hoveredButton = hit;
        if (hit >= 0) {
          this.selectedButton = hit;
        }
        this.canvas.style.cursor = hit >= 0 ? 'pointer' : 'default';
        this.render();
      }
    } else if (this.model.paused) {
      const hit = this.hitTest(getPauseButtons(this.audio), point);
      if (hit !== this.pauseHoveredButton) {
        this.pauseHoveredButton = hit;
        if (hit >= 0) {
          this.pauseSelectedButton = hit;
        }
        this.canvas.style.cursor = hit >= 0 ? 'pointer' : 'default';
        this.render();
      }
    }
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (this.overlayOpen) {
      return;
    }
    if (event.pointerId !== this.activePointerId || !this.pointerStart) {
      return;
    }
    const start = this.pointerStart;
    const end = canvasPoint(this.canvas, event);
    this.clearPointer();

    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const swipeDistance = Math.hypot(deltaX, deltaY);
    if (this.mode === 'game' && !this.model.paused && !this.model.gameOver && swipeDistance >= 24) {
      const direction = Math.abs(deltaX) >= Math.abs(deltaY)
        ? deltaX > 0 ? DIRECTIONS.right : DIRECTIONS.left
        : deltaY > 0 ? DIRECTIONS.down : DIRECTIONS.up;
      this.model.setDirection(direction);
      return;
    }

    if (swipeDistance > 18) {
      return;
    }
    if (this.mode === 'opening') {
      const hit = this.hitTest(getMenuButtons(this.screenPage, this.audio), end);
      if (hit >= 0) {
        this.activateOpeningButton(hit);
      }
    } else if (this.model.paused) {
      const hit = this.hitTest(getPauseButtons(this.audio), end);
      if (hit >= 0) {
        this.activatePauseButton(hit);
      }
    } else if (this.model.gameOver) {
      this.startGame();
    }
  };

  private readonly handlePointerCancel = (): void => {
    this.clearPointer();
  };

  private readonly handlePointerLeave = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse') {
      return;
    }
    if (this.mode === 'opening' && this.hoveredButton !== -1) {
      this.hoveredButton = -1;
      this.canvas.style.cursor = 'default';
      this.render();
    } else if (this.mode === 'game' && this.pauseHoveredButton !== -1) {
      this.pauseHoveredButton = -1;
      this.canvas.style.cursor = 'default';
      this.render();
    }
  };

  private readonly handleVisibilityChange = (): void => {
    if (this.mode === 'opening') {
      if (document.hidden) {
        this.audio.suspendMusic();
      } else {
        this.audio.resumeMusic();
      }
    } else if (document.hidden && !this.model.paused && !this.model.gameOver) {
      this.togglePause();
    }
  };

  private updateAccessibleState(): void {
    let status: string;
    let mobileTitle = '';
    let mobileBody = '';

    if (this.mode === 'opening') {
      const buttons = getMenuButtons(this.screenPage, this.audio);
      const selected = buttons[this.selectedButton]?.label ?? '';
      if (this.screenPage === 'menu') {
        status = `Main menu. ${selected} selected. Use arrow keys to move and Enter to select.`;
        this.mobileInfoElement.hidden = true;
      } else if (this.screenPage === 'rulesBasics') {
        status = 'Field Guide page 1. Move with arrows, WASD, swipe, or the direction pad. Red fruit scores 10. Wren hunts you. Phantom Fruit makes Wren vulnerable. One extra life can be stored.';
        mobileTitle = 'FIELD GUIDE 1 / 2';
        mobileBody = 'Move with arrows, WASD, swipe, or the pad. Edges wrap. Red fruit scores 10. Wren hunts you; Phantom Fruit makes him vulnerable. One extra life can be stored.';
        this.mobileInfoElement.hidden = false;
      } else {
        status = 'Field Guide page 2. Surround the Hollow King and hold the enclosure while the capture ring contracts. Avoid the King and sword crescents.';
        mobileTitle = 'FIELD GUIDE 2 / 2';
        mobileBody = 'Every 500 points, surround the Hollow King and hold the enclosure while the ring contracts. Body pass-through is active. Avoid the King and sword crescents.';
        this.mobileInfoElement.hidden = false;
      }
    } else {
      let gameState = 'Playing.';
      if (this.model.paused) {
        gameState = `Paused. ${getPauseButtons(this.audio)[this.pauseSelectedButton]?.label ?? ''} selected.`;
      } else if (this.model.gameOver) {
        gameState = `${this.model.gameOverTitle} Press Space or tap the board to play again.`;
      } else if (this.model.bossIntroTimeRemainingMilliseconds > 0) {
        gameState = 'The Hollow King has arrived.';
      } else if (this.model.bossActive) {
        gameState = this.model.bossEnclosed ? 'The Hollow King is enclosed.' : 'Hollow King battle.';
      } else if (this.model.isPowered) {
        gameState = 'Phantom power is active.';
      } else if (this.model.isRecovering) {
        gameState = 'A life was used. Recovery protection is active.';
      }

      status = `Score ${this.model.score}. Best ${this.model.highScore}. Level ${this.model.level}. Lives ${this.model.extraLives}. ${gameState}`;
      mobileTitle = `SCORE ${this.model.score}  BEST ${this.model.highScore}  LV ${this.model.level}`;
      mobileBody = `Life ${this.model.extraLives}. ${gameState}`;
      this.mobileInfoElement.hidden = false;
    }

    this.mobileInfoTitleElement.textContent = mobileTitle;
    this.mobileInfoBodyElement.textContent = mobileBody;
    this.canvas.setAttribute('aria-label', status);
    if (status !== this.lastAccessibilityStatus) {
      this.lastAccessibilityStatus = status;
      this.accessibilityStatusElement.textContent = status;
    }
  }

  private unlockAudio(): void {
    void this.audio.unlock().catch(() => undefined);
  }

  private clearPointer(): void {
    if (this.activePointerId !== null && this.canvas.hasPointerCapture(this.activePointerId)) {
      this.canvas.releasePointerCapture(this.activePointerId);
    }
    this.pointerStart = null;
    this.activePointerId = null;
  }

  private hitTest(buttons: ReturnType<typeof getMenuButtons>, point: Point): number {
    return buttons.findIndex((button) => rectContains(button.bounds, point));
  }

  private requestExit(): void {
    this.onExit();
    this.showMessage(this.exitMessage);
  }

  private showMessage(message: string): void {
    this.messageElement.textContent = message;
    this.messageElement.classList.add('visible');
    if (this.messageTimer !== null) {
      window.clearTimeout(this.messageTimer);
    }
    this.messageTimer = window.setTimeout(() => {
      this.messageElement.classList.remove('visible');
      this.messageTimer = null;
    }, 4_000);
  }

  private cancelOpeningTimer(): void {
    if (this.openingTimer !== null) {
      window.clearInterval(this.openingTimer);
      this.openingTimer = null;
    }
  }

  private startOpeningTimer(): void {
    if (
      this.overlayOpen ||
      this.openingTimer !== null ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    this.openingTimer = window.setInterval(() => {
      this.openingAnimationFrame += 1;
      this.render();
    }, 50);
  }

  private cancelGameTimer(): void {
    if (this.gameTimer !== null) {
      window.clearTimeout(this.gameTimer);
      this.gameTimer = null;
    }
  }
}
