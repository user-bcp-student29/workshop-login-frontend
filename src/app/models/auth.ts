export interface UserProfile {
  username?: unknown;
  displayName?: unknown;
}

export interface LoginRequest {
  username: string;
  password: string;
  client: 'angular-workshop';
}

export interface LoginResponse {
  token?: string;
  user: UserProfile;
}

export interface LoginPreferences {
  theme: string;
  showTips: boolean;
  compact: boolean;
}