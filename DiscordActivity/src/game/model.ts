import {
  COLUMNS,
  ROWS,
  pointKey,
  pointsEqual,
  type GameAudio,
  type Point,
  type RunSummary,
} from './contracts';

const STARTING_GAME_TICK_MS = 95;
const MINIMUM_GAME_TICK_MS = 70;
const GAME_TICK_STEP_MS = 5;
const STARTING_WREN_MOVE_TICKS = 3;
const FAST_WREN_MOVE_TICKS = 2;
const WREN_MINIMUM_SPAWN_DISTANCE = 10;
const NORMAL_FOODS_PER_PHANTOM_FRUIT = 5;
const STARTING_POWER_DURATION_MS = 5_000;
const MINIMUM_POWER_DURATION_MS = 3_000;
const POWER_DURATION_STEP_MS = 500;
const PHANTOM_FRUIT_SCORE = 25;
const WREN_DEFEAT_SCORE = 50;
export const BOSS_SIZE = 3;
const BOSS_SCORE_INTERVAL = 500;
const STARTING_BOSS_MOVE_TICKS = 8;
const MINIMUM_BOSS_MOVE_TICKS = 4;
const BOSS_ARENA_MARGIN = 3;
const BOSS_SPAWN_CLEARANCE = 2;
const BOSS_INTRO_MS = 1_500;
const STARTING_BOSS_CONSTRICT_MS = 5_000;
const MAXIMUM_BOSS_CONSTRICT_MS = 8_000;
const BOSS_CONSTRICT_STEP_MS = 500;
export const BOSS_DEFEAT_BANNER_MS = 1_500;
export const BOSS_DEFEAT_SCORE = 250;
const LEVEL_UP_BANNER_MS = 1_500;
const SLASH_UNLOCK_LEVEL = 5;
const STARTING_BOSS_SLASH_INTERVAL_MS = 2_000;
const MINIMUM_BOSS_SLASH_INTERVAL_MS = 1_200;
const BOSS_SLASH_INTERVAL_STEP_MS = 200;
const SLASH_WARNING_MS = 450;
const SLASH_MOVE_TICKS = 3;
const MAXIMUM_BOSS_SLASHES = 4;
const FULL_LIFE_BONUS_SCORE = 50;
const EXTRA_LIFE_LEAD_SCORE = 200;
const EXTRA_LIFE_NOTICE_MS = 1_500;
const RECOVERY_INVULNERABILITY_MS = 2_000;

export interface SwordSlash {
  position: Point;
  direction: Point;
  moveCounter: number;
}

export class GameModel {
  readonly snake: Point[] = [];
  readonly bossSlashes: SwordSlash[] = [];

  food: Point = { x: -1, y: -1 };
  phantomFruit: Point = { x: -1, y: -1 };
  wren: Point = { x: -1, y: -1 };
  bossPosition: Point = { x: -BOSS_SIZE, y: -BOSS_SIZE };
  slashWarningOrigin: Point = { x: 0, y: 0 };
  slashWarningDirection: Point = { x: 0, y: 0 };
  direction: Point = { x: 1, y: 0 };
  nextDirection: Point = { x: 1, y: 0 };

  score = 0;
  highScore = 0;
  wrenMoveCounter = 0;
  normalFoodsEaten = 0;
  powerTimeRemainingMilliseconds = 0;
  animationTick = 0;
  nextBossScore = BOSS_SCORE_INTERVAL;
  bossMoveCounter = 0;
  bossConstrictTimeMilliseconds = 0;
  bossIntroTimeRemainingMilliseconds = 0;
  bossDefeatTimeRemainingMilliseconds = 0;
  levelUpTimeRemainingMilliseconds = 0;
  bossSlashTimeRemainingMilliseconds = 0;
  slashWarningTimeRemainingMilliseconds = 0;
  extraLives = 0;
  nextExtraLifeScore = BOSS_SCORE_INTERVAL - EXTRA_LIFE_LEAD_SCORE;
  extraLifeNoticeTimeRemainingMilliseconds = 0;
  recoveryTimeRemainingMilliseconds = 0;
  level = 1;
  pendingLevel = 0;
  currentTickMilliseconds = STARTING_GAME_TICK_MS;

  paused = false;
  gameOver = false;
  won = false;
  phantomFruitActive = false;
  wrenActive = false;
  bossActive = false;
  bossEnclosed = false;
  lifeRewardNotice = '';
  gameOverTitle = 'Game over';

  constructor(
    private readonly audio: GameAudio,
    private readonly random: () => number = Math.random,
    private readonly onRunCompleted: (summary: RunSummary) => void = () => undefined,
  ) {}

  get isPowered(): boolean {
    return this.powerTimeRemainingMilliseconds > 0;
  }

  get isRecovering(): boolean {
    return this.recoveryTimeRemainingMilliseconds > 0;
  }

  get musicEnabled(): boolean {
    return this.audio.musicEnabled;
  }

  get soundEffectsEnabled(): boolean {
    return this.audio.soundEffectsEnabled;
  }

  get currentWrenMoveEveryTicks(): number {
    return this.level >= 4 ? FAST_WREN_MOVE_TICKS : STARTING_WREN_MOVE_TICKS;
  }

  get currentWrenPredictionCells(): number {
    return this.level >= 5 ? 3 : this.level >= 3 ? 2 : 0;
  }

  get currentPowerDurationMilliseconds(): number {
    return Math.max(
      MINIMUM_POWER_DURATION_MS,
      STARTING_POWER_DURATION_MS - Math.max(0, this.level - 2) * POWER_DURATION_STEP_MS,
    );
  }

  get currentBossMoveEveryTicks(): number {
    return Math.max(MINIMUM_BOSS_MOVE_TICKS, STARTING_BOSS_MOVE_TICKS - (this.level - 1));
  }

  get currentBossConstrictDurationMilliseconds(): number {
    return Math.min(
      MAXIMUM_BOSS_CONSTRICT_MS,
      STARTING_BOSS_CONSTRICT_MS + (this.level - 1) * BOSS_CONSTRICT_STEP_MS,
    );
  }

  get bossUsesSlashes(): boolean {
    return this.level >= SLASH_UNLOCK_LEVEL;
  }

  get currentSlashMoveEveryTicks(): number {
    return this.level >= 7 ? 2 : SLASH_MOVE_TICKS;
  }

  get currentBossSlashIntervalMilliseconds(): number {
    return Math.max(
      MINIMUM_BOSS_SLASH_INTERVAL_MS,
      STARTING_BOSS_SLASH_INTERVAL_MS -
        Math.max(0, this.level - SLASH_UNLOCK_LEVEL) * BOSS_SLASH_INTERVAL_STEP_MS,
    );
  }

  startGame(): void {
    this.audio.playMusic('adventure');
    this.audio.resumeMusic();
    this.currentTickMilliseconds = STARTING_GAME_TICK_MS;
    this.snake.length = 0;
    this.bossSlashes.length = 0;

    const startX = Math.trunc(COLUMNS / 2);
    const startY = Math.trunc(ROWS / 2);
    for (let index = 0; index < 4; index += 1) {
      this.snake.push({ x: startX - index, y: startY });
    }

    this.direction = { x: 1, y: 0 };
    this.nextDirection = this.direction;
    this.score = 0;
    this.wrenMoveCounter = 0;
    this.normalFoodsEaten = 0;
    this.powerTimeRemainingMilliseconds = 0;
    this.animationTick = 0;
    this.nextBossScore = BOSS_SCORE_INTERVAL;
    this.bossMoveCounter = 0;
    this.bossConstrictTimeMilliseconds = 0;
    this.bossIntroTimeRemainingMilliseconds = 0;
    this.bossDefeatTimeRemainingMilliseconds = 0;
    this.levelUpTimeRemainingMilliseconds = 0;
    this.bossSlashTimeRemainingMilliseconds = 0;
    this.slashWarningTimeRemainingMilliseconds = 0;
    this.extraLives = 0;
    this.nextExtraLifeScore = BOSS_SCORE_INTERVAL - EXTRA_LIFE_LEAD_SCORE;
    this.extraLifeNoticeTimeRemainingMilliseconds = 0;
    this.recoveryTimeRemainingMilliseconds = 0;
    this.level = 1;
    this.pendingLevel = 0;
    this.paused = false;
    this.gameOver = false;
    this.won = false;
    this.phantomFruitActive = false;
    this.wrenActive = false;
    this.bossActive = false;
    this.bossEnclosed = false;
    this.lifeRewardNotice = '';
    this.gameOverTitle = 'Game over';
    this.food = { x: -1, y: -1 };
    this.phantomFruit = { x: -1, y: -1 };
    this.bossPosition = { x: -BOSS_SIZE, y: -BOSS_SIZE };
    this.slashWarningOrigin = { x: 0, y: 0 };
    this.slashWarningDirection = { x: 0, y: 0 };

    this.wrenActive = this.placeWren();
    if (!this.placeFood()) {
      this.endGame(true, 'You win!');
    }
  }

  tick(): void {
    if (this.paused || this.gameOver || this.snake.length === 0) {
      return;
    }

    this.animationTick += 1;
    if (this.updateBossTransition()) {
      return;
    }

    this.updateLifeTimers();
    this.updatePowerMode();

    this.direction = this.nextDirection;
    const currentHead = this.snake[0]!;
    const newHead = wrapCell({
      x: currentHead.x + this.direction.x,
      y: currentHead.y + this.direction.y,
    });
    const eatingFood = pointsEqual(newHead, this.food);
    const eatingPhantomFruit =
      this.phantomFruitActive && pointsEqual(newHead, this.phantomFruit);
    const growing = eatingFood || eatingPhantomFruit;

    const bodyCollisionIndex = this.bossActive
      ? -1
      : this.findBodyCollisionIndex(newHead, growing);
    if (bodyCollisionIndex >= 0) {
      const survived = this.isRecovering || this.handleFatalCollision('Game over');
      if (survived) {
        this.snake.splice(bodyCollisionIndex);
      }
      return;
    }

    if (this.wrenActive && pointsEqual(newHead, this.wren) && !this.handleWrenCollision()) {
      return;
    }

    if (
      this.bossActive &&
      !this.isRecovering &&
      bossContainsCell(this.bossPosition, newHead)
    ) {
      this.handleFatalCollision('The Hollow King struck you!');
      return;
    }

    if (!this.handleSlashAt(newHead)) {
      return;
    }

    this.snake.unshift(newHead);
    if (eatingFood) {
      this.addScore(10);
      this.normalFoodsEaten += 1;
      if (!this.placeFood()) {
        this.endGame(true, 'You win!');
        return;
      }

      if (
        this.normalFoodsEaten % NORMAL_FOODS_PER_PHANTOM_FRUIT === 0 &&
        !this.phantomFruitActive
      ) {
        this.placePhantomFruit();
      }
    } else if (eatingPhantomFruit) {
      this.phantomFruitActive = false;
      this.powerTimeRemainingMilliseconds = this.currentPowerDurationMilliseconds;
      this.addScore(PHANTOM_FRUIT_SCORE);
      this.audio.playCue('phantomFruit');
    } else {
      this.snake.pop();
    }

    if (this.bossActive) {
      this.moveBoss();
      if (!this.updateBossSlashes()) {
        return;
      }
      this.updateBossConstrict();
    } else {
      if (this.moveWren() && !this.handleWrenCollision()) {
        return;
      }
      this.tryStartBossBattle();
    }
  }

  setDirection(direction: Point): void {
    const isUnitCardinal = Math.abs(direction.x) + Math.abs(direction.y) === 1;
    if (isUnitCardinal && !isOpposite(direction, this.direction)) {
      this.nextDirection = direction;
    }
  }

  pause(): void {
    if (this.paused || this.gameOver) {
      return;
    }
    this.paused = true;
    this.audio.suspendMusic();
  }

  resume(): void {
    if (!this.paused || this.gameOver) {
      return;
    }
    this.paused = false;
    this.audio.resumeMusic();
  }

  private findBodyCollisionIndex(newHead: Point, growing: boolean): number {
    const segmentsToCheck = this.snake.length - (growing ? 0 : 1);
    for (let index = 0; index < segmentsToCheck; index += 1) {
      if (pointsEqual(this.snake[index]!, newHead)) {
        return index;
      }
    }
    return -1;
  }

  private placeWren(): boolean {
    const occupied = new Set(this.snake.map(pointKey));
    occupied.add(pointKey(this.food));
    if (this.phantomFruitActive) {
      occupied.add(pointKey(this.phantomFruit));
    }

    const emptyCells: Point[] = [];
    const distantCells: Point[] = [];
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLUMNS; x += 1) {
        const cell = { x, y };
        if (occupied.has(pointKey(cell))) {
          continue;
        }
        emptyCells.push(cell);
        if (wrappedDistance(cell, this.snake[0]!) >= WREN_MINIMUM_SPAWN_DISTANCE) {
          distantCells.push(cell);
        }
      }
    }

    const spawnCells = distantCells.length > 0 ? distantCells : emptyCells;
    const spawn = this.randomItem(spawnCells);
    if (!spawn) {
      return false;
    }
    this.wren = spawn;
    return true;
  }

  private placeFood(): boolean {
    const occupied = new Set(this.snake.map(pointKey));
    if (this.wrenActive) {
      occupied.add(pointKey(this.wren));
    }
    if (this.phantomFruitActive) {
      occupied.add(pointKey(this.phantomFruit));
    }
    this.addBossCells(occupied);

    const emptyCells = this.getUnoccupiedCells(occupied);
    const food = this.randomItem(emptyCells);
    if (!food) {
      return false;
    }
    this.food = food;
    return true;
  }

  private placePhantomFruit(): boolean {
    const occupied = new Set(this.snake.map(pointKey));
    occupied.add(pointKey(this.food));
    if (this.wrenActive) {
      occupied.add(pointKey(this.wren));
    }
    this.addBossCells(occupied);

    const fruit = this.randomItem(this.getUnoccupiedCells(occupied));
    if (!fruit) {
      return false;
    }
    this.phantomFruit = fruit;
    this.phantomFruitActive = true;
    return true;
  }

  private getUnoccupiedCells(occupied: Set<string>): Point[] {
    const cells: Point[] = [];
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLUMNS; x += 1) {
        const cell = { x, y };
        if (!occupied.has(pointKey(cell))) {
          cells.push(cell);
        }
      }
    }
    return cells;
  }

  private updatePowerMode(): void {
    if (this.isPowered) {
      this.powerTimeRemainingMilliseconds = Math.max(
        0,
        this.powerTimeRemainingMilliseconds - this.currentTickMilliseconds,
      );
    }

    if (
      !this.isPowered &&
      !this.wrenActive &&
      !this.bossActive &&
      this.bossDefeatTimeRemainingMilliseconds === 0 &&
      this.levelUpTimeRemainingMilliseconds === 0
    ) {
      this.wrenActive = this.placeWren();
      this.wrenMoveCounter = 0;
    }
  }

  private handleWrenCollision(): boolean {
    if (this.isPowered) {
      this.wrenActive = false;
      this.wrenMoveCounter = 0;
      this.addScore(WREN_DEFEAT_SCORE);
      return true;
    }
    if (this.isRecovering) {
      return true;
    }
    this.handleFatalCollision('Wren caught you!');
    return false;
  }

  private addScore(points: number): void {
    this.score += points;
    this.highScore = Math.max(this.highScore, this.score);

    while (this.score >= this.nextExtraLifeScore) {
      this.nextExtraLifeScore += BOSS_SCORE_INTERVAL;
      if (this.extraLives === 0) {
        this.extraLives = 1;
        this.lifeRewardNotice = 'EXTRA LIFE  +1';
      } else {
        this.score += FULL_LIFE_BONUS_SCORE;
        this.highScore = Math.max(this.highScore, this.score);
        this.lifeRewardNotice = `LIFE FULL  +${FULL_LIFE_BONUS_SCORE}`;
      }
      this.extraLifeNoticeTimeRemainingMilliseconds = EXTRA_LIFE_NOTICE_MS;
    }
  }

  private updateLifeTimers(): void {
    this.extraLifeNoticeTimeRemainingMilliseconds = Math.max(
      0,
      this.extraLifeNoticeTimeRemainingMilliseconds - this.currentTickMilliseconds,
    );
    this.recoveryTimeRemainingMilliseconds = Math.max(
      0,
      this.recoveryTimeRemainingMilliseconds - this.currentTickMilliseconds,
    );
  }

  private handleFatalCollision(title: string): boolean {
    if (this.extraLives === 0) {
      this.endGame(false, title);
      return false;
    }

    this.extraLives -= 1;
    this.recoveryTimeRemainingMilliseconds = RECOVERY_INVULNERABILITY_MS;
    this.extraLifeNoticeTimeRemainingMilliseconds = 0;
    this.lifeRewardNotice = '';
    this.audio.playCue('lifeLost');
    return true;
  }

  private updateBossTransition(): boolean {
    if (this.bossIntroTimeRemainingMilliseconds > 0) {
      this.bossIntroTimeRemainingMilliseconds = Math.max(
        0,
        this.bossIntroTimeRemainingMilliseconds - this.currentTickMilliseconds,
      );
      return true;
    }

    if (this.bossDefeatTimeRemainingMilliseconds > 0) {
      this.bossDefeatTimeRemainingMilliseconds = Math.max(
        0,
        this.bossDefeatTimeRemainingMilliseconds - this.currentTickMilliseconds,
      );
      if (this.bossDefeatTimeRemainingMilliseconds === 0) {
        this.levelUpTimeRemainingMilliseconds = LEVEL_UP_BANNER_MS;
        this.audio.playCue('levelUp');
      }
      return true;
    }

    if (this.levelUpTimeRemainingMilliseconds > 0) {
      this.levelUpTimeRemainingMilliseconds = Math.max(
        0,
        this.levelUpTimeRemainingMilliseconds - this.currentTickMilliseconds,
      );
      if (this.levelUpTimeRemainingMilliseconds === 0) {
        this.applyPendingLevel();
        this.wrenActive = this.placeWren();
        this.wrenMoveCounter = 0;
        this.audio.playMusic('adventure');
      }
      return true;
    }

    return false;
  }

  private tryStartBossBattle(): boolean {
    if (
      this.score < this.nextBossScore ||
      this.bossActive ||
      this.bossDefeatTimeRemainingMilliseconds > 0 ||
      !this.tryPlaceBoss()
    ) {
      return false;
    }

    this.bossActive = true;
    this.bossEnclosed = false;
    this.bossMoveCounter = 0;
    this.bossConstrictTimeMilliseconds = 0;
    this.bossIntroTimeRemainingMilliseconds = BOSS_INTRO_MS;
    this.bossSlashTimeRemainingMilliseconds = this.currentBossSlashIntervalMilliseconds;
    this.slashWarningTimeRemainingMilliseconds = 0;
    this.bossSlashes.length = 0;
    this.wrenActive = false;
    this.wrenMoveCounter = 0;
    this.audio.playMusic('boss');
    return true;
  }

  private tryPlaceBoss(): boolean {
    const occupied = new Set(this.snake.map(pointKey));
    occupied.add(pointKey(this.food));
    if (this.phantomFruitActive) {
      occupied.add(pointKey(this.phantomFruit));
    }
    if (this.wrenActive) {
      occupied.add(pointKey(this.wren));
    }

    const bestPositions: Point[] = [];
    let greatestDistance = Number.NEGATIVE_INFINITY;
    for (let y = BOSS_ARENA_MARGIN; y <= ROWS - BOSS_SIZE - BOSS_ARENA_MARGIN; y += 1) {
      for (let x = BOSS_ARENA_MARGIN; x <= COLUMNS - BOSS_SIZE - BOSS_ARENA_MARGIN; x += 1) {
        const position = { x, y };
        if (!bossAreaIsClear(position, occupied, BOSS_SPAWN_CLEARANCE)) {
          continue;
        }

        const center = { x: x + Math.trunc(BOSS_SIZE / 2), y: y + Math.trunc(BOSS_SIZE / 2) };
        const distance = wrappedDistance(center, this.snake[0]!);
        if (distance > greatestDistance) {
          greatestDistance = distance;
          bestPositions.length = 0;
          bestPositions.push(position);
        } else if (distance === greatestDistance) {
          bestPositions.push(position);
        }
      }
    }

    const position = this.randomItem(bestPositions);
    if (!position) {
      return false;
    }
    this.bossPosition = position;
    return true;
  }

  private moveBoss(): void {
    if (this.slashWarningTimeRemainingMilliseconds > 0) {
      return;
    }

    this.bossMoveCounter += 1;
    if (this.bossMoveCounter < this.currentBossMoveEveryTicks) {
      return;
    }
    this.bossMoveCounter = 0;

    const possibleMoves: Point[] = [
      { x: this.bossPosition.x + 1, y: this.bossPosition.y },
      { x: this.bossPosition.x - 1, y: this.bossPosition.y },
      { x: this.bossPosition.x, y: this.bossPosition.y + 1 },
      { x: this.bossPosition.x, y: this.bossPosition.y - 1 },
    ];
    const bestMoves: Point[] = [];
    let shortestDistance = Number.POSITIVE_INFINITY;
    for (const move of possibleMoves) {
      if (!this.canBossMoveTo(move)) {
        continue;
      }
      const center = { x: move.x + Math.trunc(BOSS_SIZE / 2), y: move.y + Math.trunc(BOSS_SIZE / 2) };
      const distance = Math.abs(center.x - this.snake[0]!.x) + Math.abs(center.y - this.snake[0]!.y);
      if (distance < shortestDistance) {
        shortestDistance = distance;
        bestMoves.length = 0;
        bestMoves.push(move);
      } else if (distance === shortestDistance) {
        bestMoves.push(move);
      }
    }

    const move = this.randomItem(bestMoves);
    if (move) {
      this.bossPosition = move;
    }
  }

  private handleSlashAt(cell: Point): boolean {
    const before = this.bossSlashes.length;
    for (let index = this.bossSlashes.length - 1; index >= 0; index -= 1) {
      if (pointsEqual(this.bossSlashes[index]!.position, cell)) {
        this.bossSlashes.splice(index, 1);
      }
    }
    if (before === this.bossSlashes.length || this.isRecovering) {
      return true;
    }
    this.handleFatalCollision("The Hollow King's slash hit you!");
    return false;
  }

  private updateBossSlashes(): boolean {
    if (!this.bossUsesSlashes) {
      this.bossSlashes.length = 0;
      this.slashWarningTimeRemainingMilliseconds = 0;
      return true;
    }

    if (this.slashWarningTimeRemainingMilliseconds > 0) {
      this.slashWarningTimeRemainingMilliseconds = Math.max(
        0,
        this.slashWarningTimeRemainingMilliseconds - this.currentTickMilliseconds,
      );
      if (this.slashWarningTimeRemainingMilliseconds === 0) {
        this.launchBossSlash();
      }
    } else {
      this.bossSlashTimeRemainingMilliseconds -= this.currentTickMilliseconds;
      if (this.bossSlashTimeRemainingMilliseconds <= 0) {
        this.beginBossSlashWarning();
      }
    }

    for (let index = this.bossSlashes.length - 1; index >= 0; index -= 1) {
      const slash = this.bossSlashes[index]!;
      slash.moveCounter += 1;
      if (slash.moveCounter >= this.currentSlashMoveEveryTicks) {
        slash.moveCounter = 0;
        slash.position = {
          x: slash.position.x + slash.direction.x,
          y: slash.position.y + slash.direction.y,
        };
      }

      if (
        slash.position.x < 0 ||
        slash.position.x >= COLUMNS ||
        slash.position.y < 0 ||
        slash.position.y >= ROWS
      ) {
        this.bossSlashes.splice(index, 1);
        continue;
      }

      if (!pointsEqual(slash.position, this.snake[0]!)) {
        continue;
      }
      this.bossSlashes.splice(index, 1);
      if (this.isRecovering) {
        continue;
      }
      if (!this.handleFatalCollision("The Hollow King's slash hit you!")) {
        return false;
      }
    }

    return true;
  }

  private beginBossSlashWarning(): void {
    const center = {
      x: this.bossPosition.x + Math.trunc(BOSS_SIZE / 2),
      y: this.bossPosition.y + Math.trunc(BOSS_SIZE / 2),
    };
    let horizontalDistance = this.snake[0]!.x - center.x;
    let verticalDistance = this.snake[0]!.y - center.y;

    // Recovery can place the head at the exact center; force a valid lane instead of hanging.
    if (horizontalDistance === 0 && verticalDistance === 0) {
      horizontalDistance = this.direction.x;
      verticalDistance = this.direction.y;
    }

    if (Math.abs(horizontalDistance) >= Math.abs(verticalDistance)) {
      this.slashWarningDirection = { x: Math.sign(horizontalDistance) || 1, y: 0 };
      this.slashWarningOrigin = {
        x: this.slashWarningDirection.x > 0
          ? this.bossPosition.x + BOSS_SIZE
          : this.bossPosition.x - 1,
        y: center.y,
      };
    } else {
      this.slashWarningDirection = { x: 0, y: Math.sign(verticalDistance) || 1 };
      this.slashWarningOrigin = {
        x: center.x,
        y: this.slashWarningDirection.y > 0
          ? this.bossPosition.y + BOSS_SIZE
          : this.bossPosition.y - 1,
      };
    }

    this.slashWarningTimeRemainingMilliseconds = SLASH_WARNING_MS;
    this.audio.playCue('slashWarning');
  }

  private launchBossSlash(): void {
    if (this.bossSlashes.length < MAXIMUM_BOSS_SLASHES) {
      this.bossSlashes.push({
        position: { ...this.slashWarningOrigin },
        direction: { ...this.slashWarningDirection },
        moveCounter: 0,
      });
    }
    this.bossSlashTimeRemainingMilliseconds = this.currentBossSlashIntervalMilliseconds;
    this.audio.playCue('swordSlash');
  }

  private canBossMoveTo(position: Point): boolean {
    if (
      position.x < BOSS_ARENA_MARGIN ||
      position.y < BOSS_ARENA_MARGIN ||
      position.x > COLUMNS - BOSS_SIZE - BOSS_ARENA_MARGIN ||
      position.y > ROWS - BOSS_SIZE - BOSS_ARENA_MARGIN
    ) {
      return false;
    }

    for (let y = position.y; y < position.y + BOSS_SIZE; y += 1) {
      for (let x = position.x; x < position.x + BOSS_SIZE; x += 1) {
        const cell = { x, y };
        const blockedByFruit =
          pointsEqual(cell, this.food) ||
          (this.phantomFruitActive && pointsEqual(cell, this.phantomFruit));
        if (blockedByFruit || this.snake.some((segment) => pointsEqual(segment, cell))) {
          return false;
        }
      }
    }
    return true;
  }

  private updateBossConstrict(): void {
    this.bossEnclosed = this.isBossEnclosed();
    if (!this.bossEnclosed) {
      return;
    }

    this.bossConstrictTimeMilliseconds = Math.min(
      this.currentBossConstrictDurationMilliseconds,
      this.bossConstrictTimeMilliseconds + this.currentTickMilliseconds,
    );
    if (this.bossConstrictTimeMilliseconds >= this.currentBossConstrictDurationMilliseconds) {
      this.defeatBoss();
    }
  }

  private isBossEnclosed(): boolean {
    const blocked = new Set(this.snake.map(pointKey));
    const visited = new Set<string>();
    const queue: Point[] = [{
      x: this.bossPosition.x + Math.trunc(BOSS_SIZE / 2),
      y: this.bossPosition.y + Math.trunc(BOSS_SIZE / 2),
    }];
    visited.add(pointKey(queue[0]!));

    for (let index = 0; index < queue.length; index += 1) {
      const cell = queue[index]!;
      if (cell.x === 0 || cell.x === COLUMNS - 1 || cell.y === 0 || cell.y === ROWS - 1) {
        return false;
      }

      const neighbors = [
        { x: cell.x + 1, y: cell.y },
        { x: cell.x - 1, y: cell.y },
        { x: cell.x, y: cell.y + 1 },
        { x: cell.x, y: cell.y - 1 },
      ];
      for (const next of neighbors) {
        const key = pointKey(next);
        if (
          next.x < 0 || next.x >= COLUMNS || next.y < 0 || next.y >= ROWS ||
          visited.has(key) || blocked.has(key)
        ) {
          continue;
        }
        visited.add(key);
        queue.push(next);
      }
    }

    return true;
  }

  private defeatBoss(): void {
    this.bossActive = false;
    this.bossEnclosed = false;
    this.bossDefeatTimeRemainingMilliseconds = BOSS_DEFEAT_BANNER_MS;
    this.pendingLevel = this.level + 1;
    this.bossSlashes.length = 0;
    this.slashWarningTimeRemainingMilliseconds = 0;
    this.removeOverlappingTail();
    this.addScore(BOSS_DEFEAT_SCORE);
    this.audio.playMusic('none');
    this.audio.playCue('bossDefeated');

    this.nextBossScore += BOSS_SCORE_INTERVAL;
    this.nextExtraLifeScore = Math.max(
      this.nextExtraLifeScore,
      this.nextBossScore - EXTRA_LIFE_LEAD_SCORE,
    );
  }

  private applyPendingLevel(): void {
    if (this.pendingLevel <= this.level) {
      return;
    }
    this.level = this.pendingLevel;
    this.pendingLevel = 0;
    this.currentTickMilliseconds = Math.max(
      MINIMUM_GAME_TICK_MS,
      STARTING_GAME_TICK_MS - (this.level - 1) * GAME_TICK_STEP_MS,
    );
  }

  private removeOverlappingTail(): void {
    const occupied = new Set<string>();
    for (let index = 0; index < this.snake.length; index += 1) {
      const key = pointKey(this.snake[index]!);
      if (occupied.has(key)) {
        this.snake.splice(index);
        return;
      }
      occupied.add(key);
    }
  }

  private addBossCells(occupied: Set<string>): void {
    if (!this.bossActive) {
      return;
    }
    for (let y = this.bossPosition.y; y < this.bossPosition.y + BOSS_SIZE; y += 1) {
      for (let x = this.bossPosition.x; x < this.bossPosition.x + BOSS_SIZE; x += 1) {
        occupied.add(pointKey({ x, y }));
      }
    }
  }

  private moveWren(): boolean {
    if (!this.wrenActive) {
      return false;
    }

    this.wrenMoveCounter += 1;
    if (this.wrenMoveCounter < this.currentWrenMoveEveryTicks) {
      return false;
    }
    this.wrenMoveCounter = 0;

    const snakeHead = this.snake[0]!;
    let target = snakeHead;
    if (!this.isPowered) {
      for (let index = 0; index < this.currentWrenPredictionCells; index += 1) {
        target = wrapCell({ x: target.x + this.direction.x, y: target.y + this.direction.y });
      }
    }

    const possibleMoves = [
      wrapCell({ x: this.wren.x + 1, y: this.wren.y }),
      wrapCell({ x: this.wren.x - 1, y: this.wren.y }),
      wrapCell({ x: this.wren.x, y: this.wren.y + 1 }),
      wrapCell({ x: this.wren.x, y: this.wren.y - 1 }),
    ];
    const bestMoves: Point[] = [];
    let bestDistance = this.isPowered ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
    for (const move of possibleMoves) {
      const blockedBySnake =
        !pointsEqual(move, snakeHead) && this.snake.some((segment) => pointsEqual(segment, move));
      const blockedByFruit =
        pointsEqual(move, this.food) ||
        (this.phantomFruitActive && pointsEqual(move, this.phantomFruit));
      if (blockedBySnake || blockedByFruit) {
        continue;
      }

      const distance = wrappedDistance(move, target);
      const better = this.isPowered ? distance > bestDistance : distance < bestDistance;
      if (better) {
        bestDistance = distance;
        bestMoves.length = 0;
        bestMoves.push(move);
      } else if (distance === bestDistance) {
        bestMoves.push(move);
      }
    }

    const move = this.randomItem(bestMoves);
    if (move) {
      this.wren = move;
    }
    return pointsEqual(this.wren, snakeHead);
  }

  private endGame(won: boolean, title: string): void {
    if (this.gameOver) {
      return;
    }

    this.audio.playMusic('none');
    this.audio.playCue(won ? 'win' : 'lose');
    this.gameOver = true;
    this.won = won;
    this.gameOverTitle = title;
    this.onRunCompleted({
      score: this.score,
      level: this.level,
      localHighScore: this.highScore,
      won,
    });
  }

  private randomItem<T>(items: T[]): T | undefined {
    if (items.length === 0) {
      return undefined;
    }
    return items[Math.floor(this.random() * items.length)];
  }
}

export function wrapCell(cell: Point): Point {
  return {
    x: (cell.x + COLUMNS) % COLUMNS,
    y: (cell.y + ROWS) % ROWS,
  };
}

export function wrappedDistance(first: Point, second: Point): number {
  let horizontal = Math.abs(first.x - second.x);
  let vertical = Math.abs(first.y - second.y);
  horizontal = Math.min(horizontal, COLUMNS - horizontal);
  vertical = Math.min(vertical, ROWS - vertical);
  return horizontal + vertical;
}

export function isOpposite(first: Point, second: Point): boolean {
  return first.x === -second.x && first.y === -second.y;
}

function bossAreaIsClear(position: Point, occupied: Set<string>, clearance: number): boolean {
  for (let y = position.y - clearance; y < position.y + BOSS_SIZE + clearance; y += 1) {
    for (let x = position.x - clearance; x < position.x + BOSS_SIZE + clearance; x += 1) {
      if (occupied.has(pointKey({ x, y }))) {
        return false;
      }
    }
  }
  return true;
}

function bossContainsCell(position: Point, cell: Point): boolean {
  return (
    cell.x >= position.x &&
    cell.x < position.x + BOSS_SIZE &&
    cell.y >= position.y &&
    cell.y < position.y + BOSS_SIZE
  );
}
