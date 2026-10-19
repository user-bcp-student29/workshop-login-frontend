import '@angular/compiler';
import { ChangeDetectorRef, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import axios from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DashboardComponent } from './dashboard/dashboard.component';
import { LoginComponent } from './login/login.component';
import { SessionService } from './services/session.service';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    removeItem: vi.fn((key: string) => values.delete(key)),
    values
  };
}

describe('authentication flow characterization', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('logs in, stores the session, loads visible tasks, and logs out', async () => {
    const storage = createMemoryStorage();
    storage.values.set('workshop_preferences', JSON.stringify({ compact: true }));
    vi.stubGlobal('localStorage', storage);
    const router = { navigate: vi.fn().mockResolvedValue(true) } as unknown as Router;
    const detector = { detectChanges: vi.fn() } as ChangeDetectorRef;
    const zone = { run: (callback: () => void) => callback() } as NgZone;
    const session = new SessionService();
    storage.removeItem.mockClear();

    vi.mocked(axios.post).mockResolvedValue({
      data: {
        token: 'session-token',
        user: { username: 'student', displayName: 'Student' }
      }
    } as never);
    vi.mocked(axios.get).mockResolvedValue({
      data: [
        { status: 'TODO', priority: 'HIGH', owner: 'student', title: 'Visible task', description: 'Details' },
        { status: 'IN_PROGRESS', priority: 'LOW', owner: 'student', title: 'Second task', description: 'More details' },
        { status: 'ARCHIVED', priority: 'LOW', owner: 'student', title: 'Archived task', description: 'Old' }
      ]
    } as never);

    const login = new LoginComponent(router, session);
    expect(login.preferences).toEqual({ theme: 'light', showTips: true, compact: true });
    login.username = 'student';
    login.password = 'Workshop123!';

    const loginPromise = login.login();
    expect(login.busy).toBe(true);
    expect(axios.post).toHaveBeenCalledWith(
      'http://localhost:8080/auth/login',
      { username: 'student', password: 'Workshop123!', client: 'angular-workshop' },
      { timeout: 5000 }
    );
    await loginPromise;

    expect(login.busy).toBe(false);
    expect(session.getToken()).toBe('session-token');
    expect(storage.values.has('workshop_token')).toBe(false);
    expect(JSON.parse(storage.values.get('workshop_user') || '{}')).toEqual({
      username: 'student',
      displayName: 'Student'
    });
    expect(storage.setItem.mock.calls).toEqual([
      ['workshop_user', JSON.stringify({ username: 'student', displayName: 'Student' })],
      ['workshop_preferences', JSON.stringify(login.preferences)]
    ]);
    expect(storage.setItem.mock.invocationCallOrder.at(-1)).toBeLessThan(router.navigate.mock.invocationCallOrder[0]);
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);

    const dashboard = new DashboardComponent(router, detector, zone, session);
    await dashboard.ngOnInit();

    expect(axios.get).toHaveBeenCalledWith('http://localhost:8000/api/tasks?owner=student', {
      headers: { Authorization: 'Bearer session-token' }
    });
    expect(storage.getItem.mock.calls).toEqual([
      ['workshop_preferences'],
      ['workshop_user']
    ]);
    expect(dashboard.visibleTasks).toHaveLength(2);
    expect(dashboard.visibleTasks[0].title).toBe('Second task');
    expect(dashboard.visibleTasks[1].title).toBe('Visible task');
    expect(dashboard.visibleTasks[1].label).toBe('HIGH · STUDENT');
    expect(dashboard.statusLabel('TODO')).toBe('Por hacer');
    expect(dashboard.statusLabel('UNKNOWN')).toBe('UNKNOWN');
    expect(dashboard.loading).toBe(false);

    await dashboard.logout();

    expect(storage.values.has('workshop_token')).toBe(false);
    expect(storage.values.has('workshop_user')).toBe(false);
    expect(storage.values.has('workshop_preferences')).toBe(true);
    expect(storage.removeItem.mock.calls).toEqual([['workshop_token'], ['workshop_user']]);
    expect(router.navigate).toHaveBeenLastCalledWith(['/login']);
  });

  it('validates the username before the password and skips HTTP', async () => {
    vi.stubGlobal('localStorage', createMemoryStorage());
    const router = { navigate: vi.fn().mockResolvedValue(true) } as unknown as Router;
    const login = new LoginComponent(router, new SessionService());
    login.username = ' ';
    login.password = '';

    await login.login();

    expect(login.message).toBe('<strong>Ingrese un usuario.</strong>');
    expect(login.busy).toBe(false);
    expect(axios.post).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('validates an empty password and skips HTTP', async () => {
    vi.stubGlobal('localStorage', createMemoryStorage());
    const router = { navigate: vi.fn().mockResolvedValue(true) } as unknown as Router;
    const login = new LoginComponent(router, new SessionService());
    login.username = 'student';
    login.password = '  ';

    await login.login();

    expect(login.message).toBe('<strong>Ingrese una contraseña.</strong>');
    expect(login.busy).toBe(false);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('reports a missing token without persisting or navigating', async () => {
    const storage = createMemoryStorage();
    vi.stubGlobal('localStorage', storage);
    const router = { navigate: vi.fn().mockResolvedValue(true) } as unknown as Router;
    vi.mocked(axios.post).mockResolvedValue({ data: {} } as never);
    const login = new LoginComponent(router, new SessionService());
    login.username = 'student';
    login.password = 'Workshop123!';

    await login.login();

    expect(login.message).toBe('<strong>El backend respondió sin token.</strong>');
    expect(login.busy).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('redirects to login without requesting tasks when no token is stored', async () => {
    vi.stubGlobal('localStorage', createMemoryStorage());
    const router = { navigate: vi.fn().mockResolvedValue(true) } as unknown as Router;
    const detector = { detectChanges: vi.fn() } as ChangeDetectorRef;
    const zone = { run: (callback: () => void) => callback() } as NgZone;
    const dashboard = new DashboardComponent(router, detector, zone, new SessionService());

    await dashboard.ngOnInit();

    expect(axios.get).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('shows task request errors and ends loading without clearing the session', async () => {
    const storage = createMemoryStorage();
    vi.stubGlobal('localStorage', storage);
    const session = new SessionService();
    session.saveSession('session-token', { username: 'student' }, {
      theme: 'light',
      showTips: true,
      compact: false
    });
    const router = { navigate: vi.fn().mockResolvedValue(true) } as unknown as Router;
    const detector = { detectChanges: vi.fn() } as ChangeDetectorRef;
    const zone = { run: (callback: () => void) => callback() } as NgZone;
    vi.mocked(axios.get).mockRejectedValue({ response: { data: { detail: 'Private task detail' } } });
    const dashboard = new DashboardComponent(router, detector, zone, session);

    await dashboard.ngOnInit();

    expect(dashboard.error).toBe('Private task detail');
    expect(dashboard.loading).toBe(false);
    expect(session.getToken()).toBe('session-token');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('shows a backend-unavailable error and restores the login button', async () => {
    const storage = createMemoryStorage();
    vi.stubGlobal('localStorage', storage);
    const router = { navigate: vi.fn().mockResolvedValue(true) } as unknown as Router;
    const requestError = new Error('Network Error');
    vi.mocked(axios.post).mockRejectedValue(requestError);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const login = new LoginComponent(router, new SessionService());
    login.username = 'student';
    login.password = 'Workshop123!';

    await login.login();

    expect(login.message).toContain('No se pudo autenticar a student.');
    expect(login.message).toContain('Network Error');
    expect(login.busy).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('shows the configured login timeout and restores the login button', async () => {
    const storage = createMemoryStorage();
    vi.stubGlobal('localStorage', storage);
    const router = { navigate: vi.fn().mockResolvedValue(true) } as unknown as Router;
    const timeoutError = new Error('timeout of 5000ms exceeded');
    vi.mocked(axios.post).mockRejectedValue(timeoutError);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const login = new LoginComponent(router, new SessionService());
    login.username = 'student';
    login.password = 'Workshop123!';

    await login.login();

    expect(axios.post).toHaveBeenCalledWith(
      'http://localhost:8080/auth/login',
      { username: 'student', password: 'Workshop123!', client: 'angular-workshop' },
      { timeout: 5000 }
    );
    expect(login.message).toContain('timeout of 5000ms exceeded');
    expect(login.busy).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('shows an invalid-token task error without clearing the session or redirecting', async () => {
    const storage = createMemoryStorage();
    vi.stubGlobal('localStorage', storage);
    const session = new SessionService();
    session.saveSession('expired-token', { username: 'student' }, {
      theme: 'light',
      showTips: true,
      compact: false
    });
    const router = { navigate: vi.fn().mockResolvedValue(true) } as unknown as Router;
    const detector = { detectChanges: vi.fn() } as ChangeDetectorRef;
    const zone = { run: (callback: () => void) => callback() } as NgZone;
    vi.mocked(axios.get).mockRejectedValue({
      response: { status: 401, data: { detail: 'Invalid token' } }
    });
    const dashboard = new DashboardComponent(router, detector, zone, session);

    await dashboard.ngOnInit();

    expect(axios.get).toHaveBeenCalledWith('http://localhost:8000/api/tasks?owner=student', {
      headers: { Authorization: 'Bearer expired-token' }
    });
    expect(dashboard.error).toBe('Invalid token');
    expect(dashboard.loading).toBe(false);
    expect(session.getToken()).toBe('expired-token');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('keeps default preferences when stored preference JSON is invalid', () => {
    const storage = createMemoryStorage();
    storage.values.set('workshop_preferences', '{invalid');
    vi.stubGlobal('localStorage', storage);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const router = { navigate: vi.fn().mockResolvedValue(true) } as unknown as Router;

    const login = new LoginComponent(router, new SessionService());

    expect(login.preferences).toEqual({ theme: 'light', showTips: true, compact: false });
    expect(log).toHaveBeenCalled();
  });

  it('rejects before requesting tasks when persisted user JSON is invalid', async () => {
    const storage = createMemoryStorage();
    storage.values.set('workshop_token', 'session-token');
    storage.values.set('workshop_user', '{invalid');
    vi.stubGlobal('localStorage', storage);
    const router = { navigate: vi.fn().mockResolvedValue(true) } as unknown as Router;
    const detector = { detectChanges: vi.fn() } as ChangeDetectorRef;
    const zone = { run: (callback: () => void) => callback() } as NgZone;
    const dashboard = new DashboardComponent(router, detector, zone, new SessionService());

    await expect(dashboard.ngOnInit()).rejects.toThrow(SyntaxError);

    expect(axios.get).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('shows a loading error when the task response is null', async () => {
    const storage = createMemoryStorage();
    vi.stubGlobal('localStorage', storage);
    const session = new SessionService();
    session.saveSession('session-token', { username: 'student' }, {
      theme: 'light',
      showTips: true,
      compact: false
    });
    const router = { navigate: vi.fn().mockResolvedValue(true) } as unknown as Router;
    const detector = { detectChanges: vi.fn() } as ChangeDetectorRef;
    const zone = { run: (callback: () => void) => callback() } as NgZone;
    vi.mocked(axios.get).mockResolvedValue({ data: null } as never);
    const dashboard = new DashboardComponent(router, detector, zone, session);

    await dashboard.ngOnInit();

    expect(dashboard.error).toBeTruthy();
    expect(dashboard.loading).toBe(false);
    expect(session.getToken()).toBe('session-token');
  });
});