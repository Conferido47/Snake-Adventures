import { drawHollowKing, drawPhantomFruit, drawWren } from './art';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  CELL_SIZE,
  COLUMNS,
  GAME_HEIGHT,
  HEADER_HEIGHT,
  ROWS,
  type GameAudio,
  type Point,
  type Rect,
} from './contracts';
import {
  BOSS_DEFEAT_BANNER_MS,
  BOSS_DEFEAT_SCORE,
  BOSS_SIZE,
  type GameModel,
} from './model';
import type { CosmeticId } from '../../shared/cosmetics';
import { drawSnakePiece, getSnakeSkin, type SnakeVisualState } from './skins';

export type ScreenPage = 'menu' | 'rulesBasics' | 'rulesBoss';
export type ButtonAction =
  | 'play'
  | 'wardrobe'
  | 'rules'
  | 'music'
  | 'sfx'
  | 'exit'
  | 'back'
  | 'next'
  | 'resume'
  | 'quit';

export interface ButtonDefinition {
  bounds: Rect;
  label: string;
  action: ButtonAction;
}

const TITLE_FONT = '700 45px Georgia, serif';
const SUBTITLE_FONT = '600 17px "Segoe UI", sans-serif';
const BUTTON_FONT = '600 16px "Segoe UI", sans-serif';
const SECTION_FONT = '600 15px "Segoe UI", sans-serif';
const BODY_FONT = '13px "Segoe UI", sans-serif';
const SMALL_FONT = '11px "Segoe UI", sans-serif';
const SCORE_FONT = '600 15px "Segoe UI", sans-serif';
const MESSAGE_FONT = '600 33px "Segoe UI", sans-serif';
const HELP_FONT = '14px "Segoe UI", sans-serif';

export class GameRenderer {
  private readonly context: CanvasRenderingContext2D;
  private equippedSkinId: CosmeticId = 'classic';

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas 2D is not supported by this browser.');
    }
    this.context = context;
  }

  setEquippedSkin(id: CosmeticId): void {
    this.equippedSkinId = id;
  }

  renderOpening(
    page: ScreenPage,
    animationFrame: number,
    selectedButton: number,
    hoveredButton: number,
    audio: GameAudio,
  ): void {
    const context = this.prepare();
    this.drawOpeningBackground(context, animationFrame);
    if (page === 'menu') {
      this.drawOpeningMenu(context, animationFrame, selectedButton, hoveredButton, audio);
    } else {
      this.drawRules(context, page, selectedButton, hoveredButton, audio);
    }
  }

  renderGame(model: GameModel, selectedPauseButton: number, hoveredPauseButton: number): void {
    const context = this.prepare();
    if (model.snake.length === 0) {
      context.fillStyle = '#0b141d';
      context.fillRect(0, 0, BOARD_WIDTH, GAME_HEIGHT);
      return;
    }

    this.drawHeader(context, model);
    this.drawBoard(context);
    this.drawFood(context, model);
    this.drawPhantomFruit(context, model);
    this.drawBossCaptureRadius(context, model);
    this.drawSlashWarning(context, model);
    this.drawBoss(context, model);
    this.drawBossSlashes(context, model);
    this.drawSnake(context, model);
    this.drawWren(context, model);
    this.drawBossDefeatEffect(context, model);

    if (model.paused) {
      this.drawPauseMenu(context, model, selectedPauseButton, hoveredPauseButton);
    } else if (model.bossIntroTimeRemainingMilliseconds > 0) {
      this.drawOverlay(
        context,
        'THE HOLLOW KING',
        model.bossUsesSlashes
          ? 'Body pass is ON | Dodge sword crescents and surround him'
          : 'Body pass is ON | Surround it without touching it',
      );
    } else if (model.bossDefeatTimeRemainingMilliseconds > 0) {
      this.drawOverlay(
        context,
        'HOLLOW KING DEFEATED!',
        `+${BOSS_DEFEAT_SCORE} points | Level up next`,
      );
    } else if (model.levelUpTimeRemainingMilliseconds > 0) {
      this.drawOverlay(
        context,
        `LEVEL ${model.pendingLevel}`,
        getLevelDescription(model.pendingLevel),
      );
    } else if (model.gameOver) {
      this.drawOverlay(context, model.gameOverTitle, 'Press Space or tap to play again');
    }
  }

  private prepare(): CanvasRenderingContext2D {
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    const pixelWidth = Math.round(BOARD_WIDTH * ratio);
    const pixelHeight = Math.round(GAME_HEIGHT * ratio);
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
    }
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.context.imageSmoothingEnabled = true;
    this.context.clearRect(0, 0, BOARD_WIDTH, GAME_HEIGHT);
    return this.context;
  }

  private drawOpeningBackground(context: CanvasRenderingContext2D, animationFrame: number): void {
    const gradient = context.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    gradient.addColorStop(0, '#0b141d');
    gradient.addColorStop(1, '#271937');
    context.fillStyle = gradient;
    context.fillRect(0, 0, BOARD_WIDTH, GAME_HEIGHT);

    context.strokeStyle = 'rgb(109 174 159 / 0.09)';
    context.lineWidth = 1;
    for (let x = -20; x < BOARD_WIDTH + 40; x += 40) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x - 80, GAME_HEIGHT);
      context.stroke();
    }
    for (let y = 20; y < GAME_HEIGHT; y += 40) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(BOARD_WIDTH, y);
      context.stroke();
    }

    for (let index = 0; index < 18; index += 1) {
      const x = (index * 83 + animationFrame * (index % 3 + 1)) % BOARD_WIDTH;
      const y = 24 + (index * 47) % (GAME_HEIGHT - 48);
      const alpha = (45 + 35 * (Math.sin((animationFrame + index * 7) / 11) + 1)) / 255;
      fillEllipse(context, `rgb(116 226 205 / ${alpha})`, x, y, 3 + index % 3, 3 + index % 3);
    }
  }

  private drawOpeningMenu(
    context: CanvasRenderingContext2D,
    animationFrame: number,
    selectedButton: number,
    hoveredButton: number,
    audio: GameAudio,
  ): void {
    this.drawSerpentMark(context, animationFrame);
    drawWren(
      context,
      { x: 472, y: 72 + Math.trunc(Math.sin(animationFrame / 8) * 3), width: 72, height: 72 },
      false,
    );

    drawText(context, 'SNAKE', { x: 0, y: 38, width: BOARD_WIDTH, height: 52 }, '#e6f4e7', TITLE_FONT);
    drawText(
      context,
      'A D V E N T U R E S',
      { x: 0, y: 88, width: BOARD_WIDTH, height: 30 },
      '#6fe0c9',
      SUBTITLE_FONT,
    );
    drawText(
      context,
      'DISCORD ACTIVITY  |  VERSION 1.0',
      { x: 0, y: 118, width: BOARD_WIDTH, height: 24 },
      '#b79ccf',
      SMALL_FONT,
    );

    this.drawButtons(context, getMenuButtons('menu', audio), selectedButton, hoveredButton);
    drawText(
      context,
      'CREATED BY',
      { x: 20, y: GAME_HEIGHT - 84, width: BOARD_WIDTH - 40, height: 18 },
      '#f5d37e',
      SMALL_FONT,
    );
    drawText(
      context,
      'Justin Conferido  |  Najem Alayoubi  |  Merj Din',
      { x: 20, y: GAME_HEIGHT - 66, width: BOARD_WIDTH - 40, height: 20 },
      '#c4d3cf',
      SMALL_FONT,
    );
    drawText(
      context,
      'Arrows: move menu   Enter: select   M: music   S: effects',
      { x: 20, y: GAME_HEIGHT - 33, width: BOARD_WIDTH - 40, height: 22 },
      '#899fa6',
      SMALL_FONT,
    );
  }

  private drawSerpentMark(context: CanvasRenderingContext2D, animationFrame: number): void {
    const wave = Math.trunc(Math.sin(animationFrame / 10) * 4);
    for (let index = 0; index < 11; index += 1) {
      const x = 45 + index * 15;
      const y = 100 + Math.trunc(Math.sin((index + animationFrame / 8) * 0.72) * 16);
      fillEllipse(context, index === 10 ? '#82de84' : '#398f77', x, y + wave, 18, 18);
    }
    fillEllipse(context, '#111e1b', 201, 105 + wave, 3, 3);
  }

  private drawRules(
    context: CanvasRenderingContext2D,
    page: Exclude<ScreenPage, 'menu'>,
    selectedButton: number,
    hoveredButton: number,
    audio: GameAudio,
  ): void {
    drawText(
      context,
      page === 'rulesBasics' ? 'FIELD GUIDE  1 / 2' : 'FIELD GUIDE  2 / 2',
      { x: 20, y: 18, width: BOARD_WIDTH - 40, height: 34 },
      '#efe6cc',
      SUBTITLE_FONT,
    );

    if (page === 'rulesBasics') {
      this.drawRuleCard(
        context,
        { x: 28, y: 65, width: 258, height: 155 },
        'MOVE & SURVIVE',
        'Use Arrow keys, WASD, swipe, or the direction pad. The snake wraps through every board edge. Eat red fruit to grow and earn 10 points. Press P for pause and R to restart.',
      );
      this.drawRuleCard(
        context,
        { x: 314, y: 65, width: 258, height: 155 },
        'WREN THE HUNTER',
        'Wren tracks the snake across wraparound edges. Touching him normally ends the run. During Phantom power he becomes vulnerable, flees, and is worth 50 points.',
      );
      this.drawRuleCard(
        context,
        { x: 28, y: 238, width: 258, height: 155 },
        'PHANTOM FRUIT',
        'A gold-and-violet Phantom Fruit appears after every five red fruits. It powers the snake temporarily. The duration becomes shorter at higher levels.',
      );
      this.drawRuleCard(
        context,
        { x: 314, y: 238, width: 258, height: 155 },
        'EXTRA LIFE',
        'One life is offered 200 points before each boss. Only one can be stored. If already full, the reward becomes 50 points. A used life grants brief protection.',
      );
    } else {
      this.drawBossRules(context);
    }

    this.drawButtons(context, getMenuButtons(page, audio), selectedButton, hoveredButton);
  }

  private drawBossRules(context: CanvasRenderingContext2D): void {
    this.drawRuleCard(
      context,
      { x: 28, y: 62, width: 544, height: 118 },
      'THE HOLLOW KING',
      'A boss arrives every 500 points and Wren leaves. Body pass-through is active: coil around the King until he cannot reach the outside. Hold the enclosure as the ring contracts. Touching the King or a sword crescent costs a life or ends the run.',
    );

    const bounds = { x: 28, y: 194, width: 544, height: 211 };
    context.fillStyle = 'rgb(18 29 39 / 0.76)';
    context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    context.strokeStyle = 'rgb(143 196 179 / 0.38)';
    context.strokeRect(bounds.x + 0.5, bounds.y + 0.5, bounds.width - 1, bounds.height - 1);

    const headers = ['SCORE', 'SPEED', 'WREN', 'POWER', 'BOSS'];
    const widths = [92, 68, 132, 70, 182];
    const rows = [
      ['0-499', '95ms', 'Tracks', '5.0s', 'Base'],
      ['500-999', '90ms', 'Faster', '5.0s', 'Moves faster'],
      ['1000-1499', '85ms', 'Predicts 2', '4.5s', '+0.5s coil'],
      ['1500-1999', '80ms', '2-tick move', '4.0s', 'Stronger'],
      ['2000-2499', '75ms', 'Predicts 3', '3.5s', 'Slashes unlock'],
      ['2500+', '70ms', 'Maximum', '3.0s', 'Capped scaling'],
    ];

    let x = bounds.x;
    headers.forEach((header, column) => {
      drawText(
        context,
        header,
        { x: x + 4, y: bounds.y + 5, width: widths[column]! - 8, height: 24 },
        '#f5d37e',
        SMALL_FONT,
        'left',
      );
      x += widths[column]!;
    });

    rows.forEach((row, rowIndex) => {
      const rowY = bounds.y + 31 + rowIndex * 29;
      context.fillStyle = rowIndex % 2 === 0
        ? 'rgb(101 190 173 / 0.12)'
        : 'rgb(101 190 173 / 0.055)';
      context.fillRect(bounds.x + 1, rowY, bounds.width - 2, 28);
      x = bounds.x;
      row.forEach((value, column) => {
        drawText(
          context,
          value,
          { x: x + 4, y: rowY, width: widths[column]! - 8, height: 28 },
          '#d5e1dc',
          SMALL_FONT,
          'left',
        );
        x += widths[column]!;
      });
    });
  }

  private drawRuleCard(
    context: CanvasRenderingContext2D,
    bounds: Rect,
    title: string,
    body: string,
  ): void {
    context.fillStyle = 'rgb(18 30 40 / 0.8)';
    context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    context.strokeStyle = 'rgb(116 198 177 / 0.37)';
    context.strokeRect(bounds.x + 0.5, bounds.y + 0.5, bounds.width - 1, bounds.height - 1);
    drawText(
      context,
      title,
      { x: bounds.x + 12, y: bounds.y + 9, width: bounds.width - 24, height: 25 },
      '#f5d37e',
      SECTION_FONT,
      'left',
    );
    drawWrappedText(
      context,
      body,
      { x: bounds.x + 12, y: bounds.y + 39, width: bounds.width - 24, height: bounds.height - 48 },
      '#d2e0dc',
      BODY_FONT,
      17,
    );
  }

  private drawButtons(
    context: CanvasRenderingContext2D,
    buttons: ButtonDefinition[],
    selectedButton: number,
    hoveredButton: number,
  ): void {
    buttons.forEach((button, index) => {
      const active = index === selectedButton || index === hoveredButton;
      context.fillStyle = active ? 'rgb(43 108 99 / 0.88)' : 'rgb(20 36 46 / 0.85)';
      context.fillRect(button.bounds.x, button.bounds.y, button.bounds.width, button.bounds.height);
      context.strokeStyle = active ? '#7eeecd' : '#468089';
      context.lineWidth = index === selectedButton ? 2 : 1;
      context.strokeRect(
        button.bounds.x + 0.5,
        button.bounds.y + 0.5,
        button.bounds.width - 1,
        button.bounds.height - 1,
      );
      drawText(
        context,
        button.label,
        button.bounds,
        active ? '#ffffff' : '#cbd7d3',
        BUTTON_FONT,
      );
    });
    context.lineWidth = 1;
  }

  private drawHeader(context: CanvasRenderingContext2D, model: GameModel): void {
    context.fillStyle = '#1d272e';
    context.fillRect(0, 0, BOARD_WIDTH, HEADER_HEIGHT);

    let statusText: string;
    let statusColor: string;
    if (model.isRecovering) {
      statusText = `LIFE USED | SAFE  ${(model.recoveryTimeRemainingMilliseconds / 1000).toFixed(1)}s`;
      statusColor = '#71deff';
    } else if (model.extraLifeNoticeTimeRemainingMilliseconds > 0) {
      statusText = model.lifeRewardNotice;
      statusColor = '#71deff';
    } else if (model.bossIntroTimeRemainingMilliseconds > 0) {
      statusText = 'HOLLOW KING';
      statusColor = '#ff764c';
    } else if (model.bossActive) {
      const seconds = Math.max(
        0,
        model.currentBossConstrictDurationMilliseconds - model.bossConstrictTimeMilliseconds,
      ) / 1000;
      if (model.bossEnclosed) {
        statusText = `CONSTRICTING  ${seconds.toFixed(1)}s`;
        statusColor = '#ffd54d';
      } else if (model.bossConstrictTimeMilliseconds > 0) {
        statusText = `PASS ON | OPEN  ${seconds.toFixed(1)}s`;
        statusColor = '#ff8b55';
      } else {
        statusText = model.bossUsesSlashes ? 'PASS ON | DODGE SLASHES' : 'BODY PASS ON | SURROUND';
        statusColor = '#ff8b55';
      }
    } else if (model.bossDefeatTimeRemainingMilliseconds > 0) {
      statusText = `KING  +${BOSS_DEFEAT_SCORE}`;
      statusColor = '#ffd54d';
    } else if (model.levelUpTimeRemainingMilliseconds > 0) {
      statusText = `LEVEL ${model.pendingLevel}  UNLOCKED`;
      statusColor = '#76e0ff';
    } else if (model.isPowered) {
      const seconds = (model.powerTimeRemainingMilliseconds / 1000).toFixed(1);
      statusText = model.wrenActive ? `PHANTOM  ${seconds}s` : `PHANTOM  ${seconds}s | WREN DOWN`;
      statusColor = '#ffd84c';
    } else {
      statusText = 'WASD/Arrows | P pause | R reset';
      statusColor = '#a0b1a9';
    }

    drawText(
      context,
      `SCORE  ${model.score}  BEST  ${model.highScore}  LIFE ${model.extraLives}  LV ${model.level}`,
      { x: 14, y: 0, width: 324, height: HEADER_HEIGHT },
      '#ecf2ee',
      SCORE_FONT,
      'left',
    );
    drawText(
      context,
      statusText,
      { x: 338, y: 0, width: BOARD_WIDTH - 352, height: HEADER_HEIGHT },
      statusColor,
      '12px "Segoe UI", sans-serif',
      'right',
    );
  }

  private drawBoard(context: CanvasRenderingContext2D): void {
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLUMNS; x += 1) {
        context.fillStyle = (x + y) % 2 === 0 ? '#23302b' : '#1f2b27';
        context.fillRect(x * CELL_SIZE, HEADER_HEIGHT + y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }
  }

  private drawFood(context: CanvasRenderingContext2D, model: GameModel): void {
    if (model.won) {
      return;
    }
    const bounds = cellBounds(model.food, 3);
    fillEllipse(context, '#f15a4f', bounds.x, bounds.y, bounds.width, bounds.height);
    fillEllipse(context, '#ffc3ae', bounds.x + 3, bounds.y + 3, 4, 4);
  }

  private drawPhantomFruit(context: CanvasRenderingContext2D, model: GameModel): void {
    if (model.phantomFruitActive && !model.won) {
      drawPhantomFruit(context, cellBounds(model.phantomFruit, 0), model.animationTick);
    }
  }

  private drawBossCaptureRadius(context: CanvasRenderingContext2D, model: GameModel): void {
    if (!model.bossActive || model.bossIntroTimeRemainingMilliseconds > 0) {
      return;
    }

    const progress = model.bossConstrictTimeMilliseconds / model.currentBossConstrictDurationMilliseconds;
    const padding = Math.round(50 - 42 * progress);
    const bossBounds = bossPixelBounds(model.bossPosition);
    const bounds = {
      x: bossBounds.x - padding,
      y: bossBounds.y - padding,
      width: bossBounds.width + padding * 2,
      height: bossBounds.height + padding * 2,
    };
    context.beginPath();
    context.ellipse(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
      bounds.width / 2,
      bounds.height / 2,
      0,
      0,
      Math.PI * 2,
    );
    context.fillStyle = model.bossEnclosed ? 'rgb(255 207 69 / 0.11)' : 'rgb(255 104 75 / 0.05)';
    context.fill();
    context.strokeStyle = model.bossEnclosed ? 'rgb(255 207 69 / 0.92)' : 'rgb(255 104 75 / 0.82)';
    context.lineWidth = model.bossEnclosed ? 4 : 3;
    context.setLineDash(model.bossEnclosed ? [] : [10, 7]);
    context.lineDashOffset = model.animationTick % 12;
    context.stroke();
    context.setLineDash([]);
    context.lineWidth = 1;
  }

  private drawSlashWarning(context: CanvasRenderingContext2D, model: GameModel): void {
    if (model.slashWarningTimeRemainingMilliseconds <= 0) {
      return;
    }

    const bright = prefersReducedMotion() || Math.trunc(model.animationTick / 3) % 2 === 0;
    let cell = { ...model.slashWarningOrigin };
    const maximumCells = Math.max(COLUMNS, ROWS) + 1;
    for (let index = 0; index < maximumCells; index += 1) {
      if (cell.x < 0 || cell.x >= COLUMNS || cell.y < 0 || cell.y >= ROWS) {
        break;
      }
      const bounds = cellBounds(cell, 2);
      context.fillStyle = bright ? 'rgb(232 102 171 / 0.35)' : 'rgb(232 102 171 / 0.16)';
      context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
      context.strokeStyle = 'rgb(255 205 235 / 0.75)';
      context.lineWidth = 2;
      context.strokeRect(bounds.x + 1, bounds.y + 1, bounds.width - 2, bounds.height - 2);
      cell = {
        x: cell.x + model.slashWarningDirection.x,
        y: cell.y + model.slashWarningDirection.y,
      };
    }
    context.lineWidth = 1;
  }

  private drawBoss(context: CanvasRenderingContext2D, model: GameModel): void {
    if (model.bossActive) {
      drawHollowKing(
        context,
        bossPixelBounds(model.bossPosition),
        model.slashWarningTimeRemainingMilliseconds > 0,
      );
    }
  }

  private drawBossSlashes(context: CanvasRenderingContext2D, model: GameModel): void {
    for (const slash of model.bossSlashes) {
      const glow = cellBounds(slash.position, 1);
      fillEllipse(context, 'rgb(204 105 242 / 0.35)', glow.x, glow.y, glow.width, glow.height);
      const bounds = cellBounds(slash.position, 4);
      const startDegrees = slash.direction.x !== 0
        ? slash.direction.x > 0 ? 245 : 65
        : slash.direction.y > 0 ? 335 : 155;
      drawArc(context, bounds, startDegrees, 230, '#c46ee1', 4);
      drawArc(context, bounds, startDegrees, 230, '#fff2e2', 2);
    }
  }

  private drawBossDefeatEffect(context: CanvasRenderingContext2D, model: GameModel): void {
    if (model.bossDefeatTimeRemainingMilliseconds <= 0) {
      return;
    }
    const progress = 1 - model.bossDefeatTimeRemainingMilliseconds / BOSS_DEFEAT_BANNER_MS;
    const bossBounds = bossPixelBounds(model.bossPosition);
    const centerX = bossBounds.x + bossBounds.width / 2;
    const centerY = bossBounds.y + bossBounds.height / 2;
    const radius = 18 + Math.trunc(progress * 70);
    const alpha = Math.max(0, 0.745 * (1 - progress));
    fillEllipse(
      context,
      `rgb(255 183 54 / ${alpha})`,
      centerX - radius,
      centerY - radius,
      radius * 2,
      radius * 2,
    );
    context.strokeStyle = `rgb(255 231 145 / ${alpha})`;
    context.lineWidth = 4;
    for (let index = 0; index < 8; index += 1) {
      const angle = index * Math.PI / 4;
      context.beginPath();
      context.moveTo(
        centerX + Math.cos(angle) * radius * 0.65,
        centerY + Math.sin(angle) * radius * 0.65,
      );
      context.lineTo(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius);
      context.stroke();
    }
    context.lineWidth = 1;
  }

  private drawSnake(context: CanvasRenderingContext2D, model: GameModel): void {
    const allowFlash = !prefersReducedMotion();
    const recoveryFlash =
      allowFlash && model.isRecovering && Math.trunc(model.animationTick / 4) % 2 === 0;
    const warningFlash =
      allowFlash &&
      model.isPowered &&
      model.powerTimeRemainingMilliseconds <= 1_000 &&
      Math.trunc(model.animationTick / 4) % 2 === 0;
    const state: SnakeVisualState = model.isRecovering
      ? 'recovery'
      : model.isPowered
        ? 'powered'
        : 'normal';
    const flash = recoveryFlash || warningFlash;
    const skin = getSnakeSkin(this.equippedSkinId);

    for (let index = model.snake.length - 1; index >= 0; index -= 1) {
      drawSnakePiece(context, cellBounds(model.snake[index]!, 1), skin, {
        index,
        isHead: index === 0,
        direction: model.direction,
        state,
        flash,
      });
    }
  }

  private drawWren(context: CanvasRenderingContext2D, model: GameModel): void {
    if (model.wrenActive) {
      drawWren(context, cellBounds(model.wren, 0), model.isPowered);
    }
  }

  private drawPauseMenu(
    context: CanvasRenderingContext2D,
    model: GameModel,
    selectedButton: number,
    hoveredButton: number,
  ): void {
    const panel = { x: 130, y: 64, width: 340, height: 353 };
    context.fillStyle = 'rgb(7 12 17 / 0.8)';
    context.fillRect(0, 0, BOARD_WIDTH, GAME_HEIGHT);
    context.fillStyle = 'rgb(19 31 42 / 0.95)';
    context.fillRect(panel.x, panel.y, panel.width, panel.height);
    context.strokeStyle = '#84dcc2';
    context.lineWidth = 2;
    context.strokeRect(panel.x + 1, panel.y + 1, panel.width - 2, panel.height - 2);

    drawText(
      context,
      'PAUSED',
      { x: panel.x, y: panel.y + 15, width: panel.width, height: 47 },
      '#eef2eb',
      MESSAGE_FONT,
    );
    drawText(
      context,
      'AUDIO & OPTIONS',
      { x: panel.x, y: panel.y + 64, width: panel.width, height: 25 },
      '#7bdcc8',
      HELP_FONT,
    );

    const buttons = getPauseButtons(model);
    buttons.forEach((button, index) => {
      const active = index === selectedButton || index === hoveredButton;
      context.fillStyle = active ? '#357067' : '#1c2d39';
      context.fillRect(button.bounds.x, button.bounds.y, button.bounds.width, button.bounds.height);
      context.strokeStyle = active ? '#91f2d6' : '#436870';
      context.lineWidth = index === selectedButton ? 2 : 1;
      context.strokeRect(
        button.bounds.x + 0.5,
        button.bounds.y + 0.5,
        button.bounds.width - 1,
        button.bounds.height - 1,
      );
      drawText(
        context,
        button.label,
        button.bounds,
        active ? '#ffffff' : '#ccd9d7',
        HELP_FONT,
      );
    });

    drawText(
      context,
      'P / Esc: resume    M: music    S: effects',
      { x: panel.x + 12, y: panel.y + panel.height - 42, width: panel.width - 24, height: 25 },
      '#8b9ea4',
      HELP_FONT,
    );
    context.lineWidth = 1;
  }

  private drawOverlay(context: CanvasRenderingContext2D, title: string, instructions: string): void {
    context.fillStyle = 'rgb(12 18 16 / 0.73)';
    context.fillRect(0, HEADER_HEIGHT, BOARD_WIDTH, BOARD_HEIGHT);
    const titleBounds = {
      x: 0,
      y: HEADER_HEIGHT + BOARD_HEIGHT / 2 - 55,
      width: BOARD_WIDTH,
      height: 50,
    };
    drawText(context, title, titleBounds, '#ffffff', MESSAGE_FONT);
    drawText(
      context,
      instructions,
      { x: 0, y: titleBounds.y + titleBounds.height + 8, width: BOARD_WIDTH, height: 35 },
      '#bee2c7',
      HELP_FONT,
    );
  }
}

export function getMenuButtons(page: ScreenPage, audio: GameAudio): ButtonDefinition[] {
  if (page === 'menu') {
    const x = BOARD_WIDTH / 2 - 142;
    return [
      { bounds: { x, y: 150, width: 284, height: 34 }, label: 'PLAY', action: 'play' },
      { bounds: { x, y: 190, width: 284, height: 34 }, label: 'WARDROBE', action: 'wardrobe' },
      { bounds: { x, y: 230, width: 284, height: 34 }, label: 'HOW TO PLAY', action: 'rules' },
      {
        bounds: { x, y: 270, width: 284, height: 34 },
        label: `MUSIC  ${onOff(audio.musicEnabled)}`,
        action: 'music',
      },
      {
        bounds: { x, y: 310, width: 284, height: 34 },
        label: `SFX  ${onOff(audio.soundEffectsEnabled)}`,
        action: 'sfx',
      },
      { bounds: { x, y: 350, width: 284, height: 34 }, label: 'HOW TO EXIT', action: 'exit' },
    ];
  }

  const buttonY = GAME_HEIGHT - 59;
  if (page === 'rulesBasics') {
    return [
      { bounds: { x: 28, y: buttonY, width: 145, height: 40 }, label: 'BACK', action: 'back' },
      { bounds: { x: 427, y: buttonY, width: 145, height: 40 }, label: 'NEXT', action: 'next' },
    ];
  }
  return [
    { bounds: { x: 28, y: buttonY, width: 145, height: 40 }, label: 'BACK', action: 'back' },
    { bounds: { x: 397, y: buttonY, width: 175, height: 40 }, label: 'START GAME', action: 'play' },
  ];
}

export function getPauseButtons(
  audio: Pick<GameAudio, 'musicEnabled' | 'soundEffectsEnabled'>,
): ButtonDefinition[] {
  const x = 175;
  return [
    { bounds: { x, y: 151, width: 250, height: 42 }, label: 'RESUME', action: 'resume' },
    {
      bounds: { x, y: 203, width: 250, height: 42 },
      label: `MUSIC  ${onOff(audio.musicEnabled)}`,
      action: 'music',
    },
    {
      bounds: { x, y: 255, width: 250, height: 42 },
      label: `SFX  ${onOff(audio.soundEffectsEnabled)}`,
      action: 'sfx',
    },
    { bounds: { x, y: 319, width: 250, height: 42 }, label: 'QUIT TO MAIN MENU', action: 'quit' },
  ];
}

export function canvasPoint(canvas: HTMLCanvasElement, event: PointerEvent): Point {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - bounds.left) * BOARD_WIDTH / bounds.width,
    y: (event.clientY - bounds.top) * GAME_HEIGHT / bounds.height,
  };
}

function getLevelDescription(level: number): string {
  switch (level) {
    case 2:
      return 'Game speed increased';
    case 3:
      return 'Wren predicts your path | Phantom lasts 4.5s';
    case 4:
      return 'Wren moves faster | The King grows stronger';
    case 5:
      return 'Sword crescents unlocked';
    case 6:
      return 'Maximum game speed | Phantom lasts 3.0s';
    default:
      return 'Hollow King movement and slash rate increased';
  }
}

function onOff(enabled: boolean): string {
  return enabled ? 'ON' : 'OFF';
}

function cellBounds(cell: Point, inset: number): Rect {
  return {
    x: cell.x * CELL_SIZE + inset,
    y: HEADER_HEIGHT + cell.y * CELL_SIZE + inset,
    width: CELL_SIZE - inset * 2,
    height: CELL_SIZE - inset * 2,
  };
}

function bossPixelBounds(position: Point): Rect {
  return {
    x: position.x * CELL_SIZE,
    y: HEADER_HEIGHT + position.y * CELL_SIZE,
    width: BOSS_SIZE * CELL_SIZE,
    height: BOSS_SIZE * CELL_SIZE,
  };
}

function drawText(
  context: CanvasRenderingContext2D,
  text: string,
  bounds: Rect,
  color: string,
  font: string,
  alignment: CanvasTextAlign = 'center',
): void {
  context.save();
  context.beginPath();
  context.rect(bounds.x, bounds.y, bounds.width, bounds.height);
  context.clip();
  context.font = responsiveFont(context, font, 1.45);
  context.fillStyle = color;
  context.textAlign = alignment;
  context.textBaseline = 'middle';
  const x = alignment === 'left'
    ? bounds.x
    : alignment === 'right'
      ? bounds.x + bounds.width
      : bounds.x + bounds.width / 2;
  context.fillText(text, x, bounds.y + bounds.height / 2);
  context.restore();
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  bounds: Rect,
  color: string,
  font: string,
  lineHeight: number,
): void {
  context.save();
  context.beginPath();
  context.rect(bounds.x, bounds.y, bounds.width, bounds.height);
  context.clip();
  const readableFont = responsiveFont(context, font, 1.15);
  const lineScale = fontPixelSize(readableFont) / Math.max(1, fontPixelSize(font));
  context.font = readableFont;
  context.fillStyle = color;
  context.textAlign = 'left';
  context.textBaseline = 'top';

  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width <= bounds.width || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) {
    lines.push(line);
  }
  lines.forEach((value, index) => {
    context.fillText(value, bounds.x, bounds.y + index * lineHeight * lineScale);
  });
  context.restore();
}

function fillEllipse(
  context: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  context.beginPath();
  context.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
  context.fillStyle = color;
  context.fill();
}

function drawArc(
  context: CanvasRenderingContext2D,
  bounds: Rect,
  startDegrees: number,
  sweepDegrees: number,
  color: string,
  width: number,
): void {
  context.beginPath();
  context.ellipse(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
    bounds.width / 2,
    bounds.height / 2,
    0,
    startDegrees * Math.PI / 180,
    (startDegrees + sweepDegrees) * Math.PI / 180,
  );
  context.strokeStyle = color;
  context.lineWidth = width;
  context.stroke();
  context.lineWidth = 1;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function responsiveFont(
  context: CanvasRenderingContext2D,
  font: string,
  maximumBoost: number,
): string {
  const displayedWidth = context.canvas.getBoundingClientRect().width;
  const displayScale = displayedWidth > 0 ? displayedWidth / BOARD_WIDTH : 1;
  const boost = displayScale < 0.9 ? Math.min(maximumBoost, 0.9 / displayScale) : 1;
  const size = fontPixelSize(font);
  if (size >= 24 || boost === 1) {
    return font;
  }
  return font.replace(/\d+(?:\.\d+)?px/, `${(size * boost).toFixed(2)}px`);
}

function fontPixelSize(font: string): number {
  const match = font.match(/(\d+(?:\.\d+)?)px/);
  return match ? Number(match[1]) : 16;
}
