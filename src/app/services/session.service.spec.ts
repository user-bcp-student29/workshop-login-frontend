import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginPreferences } from '../models/auth';
import { SessionService } from './session.service';

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    removeItem: vi.fn((key: string) => values.delete(key)),
    values
  };
}

describe('SessionService', () => {
  let storage: ReturnType<typeof createMemoryStorage>;
  let session: SessionService;

  beforeEach(() => {
    storage = createMemoryStorage();
    vi.stubGlobal('localStorage', storage);
    session = new SessionService();
    storage.removeItem.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns defaults and merges saved preferences', () => {
    expect(session.getPreferences()).toEqual({ theme: 'light', showTips: true, compact: false });
    storage.values.set('workshop_preferences', JSON.stringify({ compact: true }));
    expect(session.getPreferences()).toEqual({ theme: 'light', showTips: true, compact: true });
  });

  it('logs preference parse errors and retains defaults', () => {
    storage.values.set('workshop_preferences', '{invalid');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    expect(session.getPreferences()).toEqual({ theme: 'light', showTips: true, compact: false });
    expect(log).toHaveBeenCalled();
  });

  it('keeps the token in memory and persists only user and preferences', () => {
    const user = { username: 'student', displayName: 'Student' };
    const preferences: LoginPreferences = { theme: 'light', showTips: true, compact: false };
    session.saveSession('session-token', user, preferences);

    expect(storage.setItem.mock.calls).toEqual([
      ['workshop_user', JSON.stringify(user)],
      ['workshop_preferences', JSON.stringify(preferences)]
    ]);
    expect(session.getToken()).toBe('session-token');
    expect(session.getUser()).toEqual(user);
  });

  it('does not recover the token in a new service instance after reload', () => {
    const user = { username: 'student', displayName: 'Student' };
    const preferences: LoginPreferences = { theme: 'light', showTips: true, compact: false };
    session.saveSession('session-token', user, preferences);

    const reloadedSession = new SessionService();

    expect(reloadedSession.getToken()).toBeNull();
    expect(storage.values.has('workshop_token')).toBe(false);
    expect(reloadedSession.getUser()).toEqual(user);
  });

  it('removes a token persisted by an older application version', () => {
    storage.values.set('workshop_token', 'legacy-token');

    const reloadedSession = new SessionService();

    expect(reloadedSession.getToken()).toBeNull();
    expect(storage.values.has('workshop_token')).toBe(false);
  });

  it('clears only token and user while preserving preferences', () => {
    storage.values.set('workshop_token', 'session-token');
    storage.values.set('workshop_user', JSON.stringify({ username: 'student' }));
    storage.values.set('workshop_preferences', JSON.stringify({ compact: true }));

    session.clearSession();

    expect(storage.removeItem.mock.calls).toEqual([['workshop_token'], ['workshop_user']]);
    expect(storage.values.has('workshop_preferences')).toBe(true);
  });

  it('preserves the existing JSON parse failure for a malformed user', () => {
    storage.values.set('workshop_user', '{invalid');

    expect(() => session.getUser()).toThrow(SyntaxError);
  });
});