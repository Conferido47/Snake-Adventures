import { describe, expect, it } from 'vitest';
import { parsePlayerPreferences } from './preferences';

describe('player preferences', () => {
  it('accepts an explicit result DM choice', () => {
    expect(parsePlayerPreferences({ resultDmEnabled: true })).toEqual({ resultDmEnabled: true });
    expect(parsePlayerPreferences({ resultDmEnabled: false })).toEqual({ resultDmEnabled: false });
  });

  it('rejects missing and non-boolean choices', () => {
    expect(parsePlayerPreferences({})).toBeNull();
    expect(parsePlayerPreferences({ resultDmEnabled: 'yes' })).toBeNull();
    expect(parsePlayerPreferences(null)).toBeNull();
  });
});
