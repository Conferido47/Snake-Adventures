import { describe, expect, it } from 'vitest';
import type { GamePresence } from './game/contracts';
import { buildRichPresence } from './presence';

function presence(overrides: Partial<GamePresence> = {}): GamePresence {
  return {
    phase: 'playing',
    encounter: 'wren',
    score: 120,
    level: 2,
    startedAt: 1_722_000_000,
    ...overrides,
  };
}

describe('buildRichPresence', () => {
  it('describes a solo run without fake party or join data', () => {
    const payload = buildRichPresence(presence());

    expect(payload.activity).toMatchObject({
      type: 0,
      details: 'Endless Adventure',
      state: 'Score 120 | Level 2',
      timestamps: { start: 1_722_000_000 },
      assets: {
        large_image: 'snake-adventures',
        small_image: 'wren',
      },
    });
    expect(payload.activity).not.toHaveProperty('party');
    expect(payload.activity).not.toHaveProperty('secrets');
  });

  it('uses the Phantom and Hollow King context assets', () => {
    expect(buildRichPresence(presence({ encounter: 'phantom' })).activity).toMatchObject({
      details: 'Phantom Hunt',
      assets: { small_image: 'phantom-fruit' },
    });
    expect(buildRichPresence(presence({ encounter: 'hollowKing' })).activity).toMatchObject({
      details: 'Battling the Hollow King',
      assets: { small_image: 'hollow-king' },
    });
  });

  it('shows a clean menu presence without a run timestamp', () => {
    const payload = buildRichPresence(presence({
      phase: 'menu',
      encounter: null,
      score: 0,
      level: 1,
      startedAt: null,
    }));

    expect(payload.activity).toMatchObject({
      details: 'Preparing an adventure',
      state: 'Main Menu',
      assets: { small_text: 'Wren awaits' },
    });
    expect(payload.activity).not.toHaveProperty('timestamps');
  });

  it('shows the final score when a run ends', () => {
    expect(buildRichPresence(presence({ phase: 'gameOver', score: 730, level: 4 })).activity)
      .toMatchObject({
        details: 'Adventure Ended',
        state: 'Final Score 730 | Level 4',
      });
  });
});
