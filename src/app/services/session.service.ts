import { Injectable } from '@angular/core';
import merge from 'lodash/merge';
import { LoginPreferences, UserProfile } from '../models/auth';
import { isRecord } from '../utils/type-guards';

const TOKEN_KEY = 'workshop_token';
const USER_KEY = 'workshop_user';
const PREFERENCES_KEY = 'workshop_preferences';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private token: string | null = null;

  constructor() {
    localStorage.removeItem(TOKEN_KEY);
  }

  getToken(): string | null {
    return this.token;
  }

  getUser(): UserProfile {
    const storedUser: unknown = JSON.parse(localStorage.getItem(USER_KEY) || '{}');
    return isRecord(storedUser) ? storedUser : {};
  }

  getPreferences(): LoginPreferences {
    const preferences: LoginPreferences = { theme: 'light', showTips: true, compact: false };
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || '{}');
      merge(preferences, saved);
    } catch (error) {
      console.log('Preferences could not be loaded', error);
    }
    return preferences;
  }

  saveSession(token: string, user: UserProfile, preferences: LoginPreferences): void {
    this.token = token;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  }

  clearSession(): void {
    this.token = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
}