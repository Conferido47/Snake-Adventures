import { describe, expect, it } from 'vitest';
import type { GameAudio, MusicTrack, RunSummary, SoundCue } from './contracts';
import { GameModel, wrapCell, wrappedDistance } from './model';

class FakeAudio implements GameAudio {
  musicEnabled = true;
  soundEffectsEnabled = true;
  tracks: MusicTrack[] = [];
  cues: SoundCue[] = [];
  suspended = false;

  async unlock(): Promise<void> {}

  setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled;
  }

  setSoundEffectsEnabled(enabled: boolean): void {
    this.soundEffectsEnabled = enabled;
  }

  suspendMusic(): void {
    this.suspended = true;
  }

  resumeMusic(): void {
    this.suspended = false;
  }

  playMusic(track: MusicTrack): void {
    this.tracks.push(track);
  }

  playCue(cue: SoundCue): void {
    this.cues.push(cue);
  }
}

function createGame(
  onRunCompleted: (summary: RunSummary) => void = () => undefined,
): { game: GameModel; audio: FakeAudio } {
  const audio = new FakeAudio();
  const game = new GameModel(audio, () => 0.25, onRunCompleted);
  game.startGame();
  return { game, audio };
}

describe('GameModel', () => {
  it('starts with the desktop game layout and keeps the session high score', () => {
    const { game, audio } = createGame();

    expect(game.snake).toEqual([
      { x: 15, y: 11 },
      { x: 14, y: 11 },
      { x: 13, y: 11 },
      { x: 12, y: 11 },
    ]);
    expect(game.currentTickMilliseconds).toBe(95);
    expect(game.level).toBe(1);
    expect(game.wrenActive).toBe(true);
    expect(audio.tracks.at(-1)).toBe('adventure');

    game.highScore = 120;
    game.startGame();
    expect(game.highScore).toBe(120);
    expect(game.score).toBe(0);
  });

  it('wraps movement and rejects a direct reversal', () => {
    const { game } = createGame();
    game.snake.splice(0, game.snake.length,
      { x: 29, y: 8 },
      { x: 28, y: 8 },
      { x: 27, y: 8 },
      { x: 26, y: 8 },
    );
    game.food = { x: 5, y: 5 };
    game.wrenActive = false;
    game.powerTimeRemainingMilliseconds = 10_000;

    game.setDirection({ x: -1, y: 0 });
    expect(game.nextDirection).toEqual({ x: 1, y: 0 });
    game.setDirection({ x: 2, y: 0 });
    game.setDirection({ x: 1, y: 1 });
    expect(game.nextDirection).toEqual({ x: 1, y: 0 });
    game.tick();
    expect(game.snake[0]).toEqual({ x: 0, y: 8 });

    game.setDirection({ x: 0, y: -1 });
    expect(game.nextDirection).toEqual({ x: 0, y: -1 });
  });

  it('grows and spawns a Phantom Fruit after every fifth normal fruit', () => {
    const { game } = createGame();
    game.wrenActive = false;
    game.powerTimeRemainingMilliseconds = 10_000;
    game.normalFoodsEaten = 4;
    game.food = { x: 16, y: 11 };

    game.tick();

    expect(game.score).toBe(10);
    expect(game.snake).toHaveLength(5);
    expect(game.normalFoodsEaten).toBe(5);
    expect(game.phantomFruitActive).toBe(true);
  });

  it('turns Wren into a 50-point target during Phantom power', () => {
    const { game } = createGame();
    game.wren = { x: 16, y: 11 };
    game.wrenActive = true;
    game.food = { x: 4, y: 4 };
    game.powerTimeRemainingMilliseconds = 2_000;

    game.tick();

    expect(game.gameOver).toBe(false);
    expect(game.wrenActive).toBe(false);
    expect(game.score).toBe(50);
    expect(game.snake[0]).toEqual({ x: 16, y: 11 });
  });

  it('activates Phantom power, grows, and awards 25 points when the fruit is eaten', () => {
    const { game, audio } = createGame();
    game.wren = { x: 0, y: 0 };
    game.wrenActive = true;
    game.food = { x: 4, y: 4 };
    game.phantomFruit = { x: 16, y: 11 };
    game.phantomFruitActive = true;

    game.tick();

    expect(game.score).toBe(25);
    expect(game.snake).toHaveLength(5);
    expect(game.phantomFruitActive).toBe(false);
    expect(game.powerTimeRemainingMilliseconds).toBe(5_000);
    expect(audio.cues).toContain('phantomFruit');
  });

  it('allows the head to enter the departing tail but not a growing tail', () => {
    const safe = createGame().game;
    safe.snake.splice(0, safe.snake.length,
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 1, y: 2 },
      { x: 1, y: 1 },
    );
    safe.direction = { x: -1, y: 0 };
    safe.nextDirection = { x: -1, y: 0 };
    safe.food = { x: 8, y: 8 };
    safe.wrenActive = false;
    safe.powerTimeRemainingMilliseconds = 10_000;
    safe.tick();
    expect(safe.gameOver).toBe(false);
    expect(safe.snake[0]).toEqual({ x: 1, y: 1 });

    const growing = createGame().game;
    growing.snake.splice(0, growing.snake.length,
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 1, y: 2 },
      { x: 1, y: 1 },
    );
    growing.direction = { x: -1, y: 0 };
    growing.nextDirection = { x: -1, y: 0 };
    growing.food = { x: 1, y: 1 };
    growing.wrenActive = false;
    growing.powerTimeRemainingMilliseconds = 10_000;
    growing.tick();
    expect(growing.gameOver).toBe(true);
    expect(growing.gameOverTitle).toBe('Game over');
  });

  it('awards one stored life at 300 points', () => {
    const { game } = createGame();
    game.wrenActive = false;
    game.powerTimeRemainingMilliseconds = 100_000;

    for (let fruit = 0; fruit < 30; fruit += 1) {
      game.snake.splice(0, game.snake.length,
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 },
        { x: 7, y: 10 },
      );
      game.direction = { x: 1, y: 0 };
      game.nextDirection = { x: 1, y: 0 };
      game.food = { x: 11, y: 10 };
      game.phantomFruitActive = false;
      game.tick();
    }

    expect(game.score).toBe(300);
    expect(game.extraLives).toBe(1);
    expect(game.lifeRewardNotice).toBe('EXTRA LIFE  +1');
  });

  it('consumes a life and grants recovery instead of ending the run', () => {
    const { game, audio } = createGame();
    game.extraLives = 1;
    game.wren = { x: 16, y: 11 };
    game.wrenActive = true;
    game.food = { x: 4, y: 4 };

    game.tick();

    expect(game.gameOver).toBe(false);
    expect(game.extraLives).toBe(0);
    expect(game.recoveryTimeRemainingMilliseconds).toBe(2_000);
    expect(game.snake[0]).toEqual({ x: 15, y: 11 });
    expect(audio.cues).toContain('lifeLost');
  });

  it('emits one immutable summary for a completed run', () => {
    const completedRuns: RunSummary[] = [];
    const { game } = createGame((summary) => completedRuns.push(summary));
    game.score = 140;
    game.highScore = 220;
    game.level = 3;
    game.wren = { x: 16, y: 11 };
    game.wrenActive = true;
    game.food = { x: 4, y: 4 };

    game.tick();
    game.tick();

    expect(completedRuns).toEqual([{
      score: 140,
      level: 3,
      localHighScore: 220,
      won: false,
    }]);
  });

  it('does not submit a run when an extra life prevents game over', () => {
    const completedRuns: RunSummary[] = [];
    const { game } = createGame((summary) => completedRuns.push(summary));
    game.extraLives = 1;
    game.wren = { x: 16, y: 11 };
    game.wrenActive = true;
    game.food = { x: 4, y: 4 };

    game.tick();

    expect(game.gameOver).toBe(false);
    expect(completedRuns).toEqual([]);
  });

  it('freezes movement and status timers during a boss introduction', () => {
    const { game } = createGame();
    const snake = game.snake.map((segment) => ({ ...segment }));
    game.bossActive = true;
    game.bossIntroTimeRemainingMilliseconds = 95;
    game.powerTimeRemainingMilliseconds = 1_000;
    game.recoveryTimeRemainingMilliseconds = 1_000;

    game.tick();

    expect(game.bossIntroTimeRemainingMilliseconds).toBe(0);
    expect(game.powerTimeRemainingMilliseconds).toBe(1_000);
    expect(game.recoveryTimeRemainingMilliseconds).toBe(1_000);
    expect(game.snake).toEqual(snake);
  });

  it('removes an existing sword crescent and consumes a stored life before movement', () => {
    const { game } = createGame();
    game.level = 5;
    game.bossActive = true;
    game.bossPosition = { x: 5, y: 5 };
    game.food = { x: 4, y: 4 };
    game.wrenActive = false;
    game.extraLives = 1;
    game.bossSlashes.push({
      position: { x: 16, y: 11 },
      direction: { x: -1, y: 0 },
      moveCounter: 0,
    });

    game.tick();

    expect(game.bossSlashes).toHaveLength(0);
    expect(game.extraLives).toBe(0);
    expect(game.recoveryTimeRemainingMilliseconds).toBe(2_000);
    expect(game.snake[0]).toEqual({ x: 15, y: 11 });
  });

  it('creates a valid warning lane when recovery puts the head at the boss center', () => {
    const { game } = createGame();
    game.level = 5;
    game.bossActive = true;
    game.bossPosition = { x: 10, y: 10 };
    game.snake.splice(0, game.snake.length,
      { x: 10, y: 11 },
      { x: 9, y: 11 },
      { x: 8, y: 11 },
      { x: 7, y: 11 },
    );
    game.direction = { x: 1, y: 0 };
    game.nextDirection = { x: 1, y: 0 };
    game.food = { x: 4, y: 4 };
    game.wrenActive = false;
    game.recoveryTimeRemainingMilliseconds = 1_000;
    game.bossSlashTimeRemainingMilliseconds = 1;

    game.tick();

    expect(game.snake[0]).toEqual({ x: 11, y: 11 });
    expect(game.slashWarningDirection).toEqual({ x: 1, y: 0 });
    expect(game.slashWarningOrigin).toEqual({ x: 13, y: 11 });
    expect(game.slashWarningTimeRemainingMilliseconds).toBe(450);
  });

  it('starts a Hollow King introduction after crossing 500 points', () => {
    const { game, audio } = createGame();
    game.score = 500;
    game.highScore = 500;
    game.wrenActive = false;
    game.powerTimeRemainingMilliseconds = 10_000;
    game.food = { x: 4, y: 4 };

    game.tick();

    expect(game.bossActive).toBe(true);
    expect(game.bossIntroTimeRemainingMilliseconds).toBe(1_500);
    expect(audio.tracks.at(-1)).toBe('boss');
  });

  it('freezes and resumes the model through pause', () => {
    const { game, audio } = createGame();
    const head = { ...game.snake[0]! };
    game.pause();
    game.tick();
    expect(game.snake[0]).toEqual(head);
    expect(audio.suspended).toBe(true);

    game.resume();
    expect(audio.suspended).toBe(false);
  });
});

describe('toroidal helpers', () => {
  it('wraps board edges and chooses the short cross-edge distance', () => {
    expect(wrapCell({ x: 30, y: 22 })).toEqual({ x: 0, y: 0 });
    expect(wrapCell({ x: -1, y: -1 })).toEqual({ x: 29, y: 21 });
    expect(wrappedDistance({ x: 0, y: 0 }, { x: 29, y: 21 })).toBe(2);
  });
});
