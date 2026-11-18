export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type MusicTrack = 'none' | 'menu' | 'adventure' | 'boss';

export type SoundCue =
  | 'menuMove'
  | 'phantomFruit'
  | 'lifeLost'
  | 'bossDefeated'
  | 'levelUp'
  | 'win'
  | 'lose'
  | 'slashWarning'
  | 'swordSlash';

export interface GameAudio {
  readonly musicEnabled: boolean;
  readonly soundEffectsEnabled: boolean;
  unlock(): Promise<void>;
  setMusicEnabled(enabled: boolean): void;
  setSoundEffectsEnabled(enabled: boolean): void;
  suspendMusic(): void;
  resumeMusic(): void;
  playMusic(track: MusicTrack): void;
  playCue(cue: SoundCue): void;
}

export interface RunSummary {
  score: number;
  level: number;
  localHighScore: number;
  won: boolean;
}

export interface GamePresence {
  phase: 'menu' | 'playing' | 'paused' | 'gameOver';
  encounter: 'wren' | 'phantom' | 'hollowKing' | null;
  score: number;
  level: number;
  startedAt: number | null;
}

export const CELL_SIZE = 20;
export const COLUMNS = 30;
export const ROWS = 22;
export const HEADER_HEIGHT = 52;
export const BOARD_WIDTH = COLUMNS * CELL_SIZE;
export const BOARD_HEIGHT = ROWS * CELL_SIZE;
export const GAME_HEIGHT = HEADER_HEIGHT + BOARD_HEIGHT;

export function pointsEqual(first: Point, second: Point): boolean {
  return first.x === second.x && first.y === second.y;
}

export function pointKey(point: Point): string {
  return `${point.x},${point.y}`;
}

export function rectContains(rect: Rect, point: Point): boolean {
  return (
    point.x >= rect.x &&
    point.x < rect.x + rect.width &&
    point.y >= rect.y &&
    point.y < rect.y + rect.height
  );
}
