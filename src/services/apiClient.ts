/**
 * Client API Service for Cozy Leap Online Backend (v1)
 * Adheres strictly to the specification in API_ENDPOINTS_b196a80b.md:
 *  - Base URL: /api/v1 (or configurable via VITE_API_URL / custom server URL)
 *  - Auth: Register, Login, Refresh, Logout (Bearer token + Refresh Token)
 *  - Player: /player/me, /player/appearance, /player/inventory, /player/complete-level
 *  - Leaderboard: /leaderboard/:levelId
 *  - System: /system/health
 */

import { CharacterAppearance } from '../game/character';
import { ItemType } from '../game/items';

export interface User {
  _id: string;
  username: string;
  displayName: string;
  email: string;
  role: 'player' | 'admin';
  isActive: boolean;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresInSeconds: number;
}

export interface PlayerProfileData {
  user: User;
  appearance: CharacterAppearance | Record<string, unknown>;
  inventory: {
    slots: (ItemType | null)[];
  };
  progress: {
    maxUnlockedLevel: number;
    completedLevels: number[];
    totalCollectiblesFound: number;
    unlockedCompanions: string[];
  };
  stats?: {
    totalPlayTimeSeconds: number;
    totalJumps: number;
    totalFalls: number;
  };
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  timeSeconds: number;
  collectiblesFound: number;
}

export interface LevelCompletionResult {
  record: {
    _id: string;
    userId: string;
    username: string;
    levelId: number;
    mode: string;
    timeSeconds: number;
    collectiblesFound: number;
    createdAt: string;
  };
  rank: number;
  isNewBest: boolean;
  progress: {
    maxUnlockedLevel: number;
    completedLevels: number[];
    totalCollectiblesFound: number;
  };
  antiCheatCheck?: {
    passed: boolean;
    verifiedAt: string;
    minPhysicalTime: number;
  };
}

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'cozyleap_access_token',
  REFRESH_TOKEN: 'cozyleap_refresh_token',
  CURRENT_USER: 'cozyleap_current_user',
  API_BASE_URL: 'cozyleap_api_base_url',
};

class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private refreshTokenVal: string | null = null;
  private currentUser: User | null = null;
  private listeners: Set<(user: User | null) => void> = new Set();
  private isRefreshing: boolean = false;
  private refreshPromise: Promise<string | null> | null = null;

  constructor() {
    const savedUrl = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.API_BASE_URL) : null;
    const envUrl = (import.meta as unknown as { env?: Record<string, string> })?.env?.VITE_API_URL;
    this.baseUrl = savedUrl || envUrl || 'http://localhost:3000/api/v1';

    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      this.refreshTokenVal = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      const userStr = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (userStr) {
        try {
          this.currentUser = JSON.parse(userStr);
        } catch {
          this.currentUser = null;
        }
      }
    }
  }

  // --- Configuration ---
  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/+$/, '');
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.API_BASE_URL, this.baseUrl);
    }
  }

  public getSocketUrl(): string {
    // Socket.io connects to root host of the API (without /api/v1 path)
    try {
      const parsed = new URL(this.baseUrl);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return 'http://localhost:3000';
    }
  }

  // --- Auth State ---
  public getCurrentUser(): User | null {
    return this.currentUser;
  }

  public getAccessToken(): string | null {
    return this.accessToken;
  }

  public isAuthenticated(): boolean {
    return Boolean(this.accessToken && this.currentUser);
  }

  public onAuthChange(cb: (user: User | null) => void): () => void {
    this.listeners.add(cb);
    cb(this.currentUser);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notifyAuthChange() {
    for (const listener of this.listeners) {
      listener(this.currentUser);
    }
  }

  private saveSession(user: User, accessToken: string, refreshToken?: string) {
    this.currentUser = user;
    this.accessToken = accessToken;
    if (refreshToken) this.refreshTokenVal = refreshToken;

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
      if (refreshToken) {
        localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
      }
    }
    this.notifyAuthChange();
  }

  private clearSession() {
    this.currentUser = null;
    this.accessToken = null;
    this.refreshTokenVal = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    }
    this.notifyAuthChange();
  }

  // --- Core Request Wrapper with Auto-Refresh ---
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    requireAuth: boolean = false
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (requireAuth && this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    try {
      let response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include', // Include HttpOnly cookies for refresh
      });

      // Handle token expiration: attempt automatic refresh once
      if (response.status === 401 && requireAuth && this.refreshTokenVal && !this.isRefreshing) {
        const newAccessToken = await this.refreshToken();
        if (newAccessToken) {
          headers['Authorization'] = `Bearer ${newAccessToken}`;
          response = await fetch(url, {
            ...options,
            headers,
            credentials: 'include',
          });
        }
      }

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMsg = json?.message || json?.error || `HTTP ${response.status}: Error en el servidor`;
        const code = json?.code || response.status.toString();
        const err = new Error(errorMsg);
        (err as unknown as { code: string; status: number }).code = code;
        (err as unknown as { status: number }).status = response.status;
        throw err;
      }

      return json as T;
    } catch (err: unknown) {
      if ((err as Error)?.name === 'TypeError' && (err as Error)?.message?.includes('fetch')) {
        const offlineErr = new Error(`No se pudo conectar al servidor backend (${this.baseUrl}). Verifica que esté iniciado.`);
        (offlineErr as unknown as { code: string }).code = 'SERVER_OFFLINE';
        throw offlineErr;
      }
      throw err;
    }
  }

  // --- Auth Endpoints (Specification 1) ---

  /**
   * POST /api/v1/auth/register
   */
  public async register(params: {
    username: string;
    displayName?: string;
    email: string;
    password: string;
  }): Promise<{ user: User; accessToken: string }> {
    const res = await this.request<{
      status: string;
      message: string;
      data: {
        user: User;
        accessToken: string;
        refreshToken?: string;
        tokenType: string;
        expiresInSeconds: number;
      };
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(params),
    });

    this.saveSession(res.data.user, res.data.accessToken, res.data.refreshToken);
    return { user: res.data.user, accessToken: res.data.accessToken };
  }

  /**
   * POST /api/v1/auth/login
   */
  public async login(params: {
    email: string;
    password: string;
    deviceId?: string;
  }): Promise<{ user: User; accessToken: string }> {
    const res = await this.request<{
      status: string;
      message: string;
      data: {
        user: User;
        accessToken: string;
        refreshToken?: string;
        tokenType: string;
        expiresInSeconds: number;
      };
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: params.email,
        password: params.password,
        deviceId: params.deviceId || 'web-browser',
      }),
    });

    this.saveSession(res.data.user, res.data.accessToken, res.data.refreshToken);
    return { user: res.data.user, accessToken: res.data.accessToken };
  }

  /**
   * POST /api/v1/auth/refresh
   */
  public async refreshToken(): Promise<string | null> {
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = (async () => {
      try {
        const res = await this.request<{
          status: string;
          data: {
            accessToken: string;
            refreshToken?: string;
            tokenType: string;
            expiresInSeconds: number;
          };
        }>('/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({
            refreshToken: this.refreshTokenVal,
            deviceId: 'web-browser',
          }),
        });

        this.accessToken = res.data.accessToken;
        if (res.data.refreshToken) {
          this.refreshTokenVal = res.data.refreshToken;
          localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, res.data.refreshToken);
        }
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, res.data.accessToken);
        return res.data.accessToken;
      } catch (e) {
        console.warn('Session refresh failed:', e);
        this.clearSession();
        return null;
      } finally {
        this.isRefreshing = false;
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /**
   * POST /api/v1/auth/logout
   */
  public async logout(): Promise<void> {
    try {
      if (this.accessToken) {
        await this.request(
          '/auth/logout',
          {
            method: 'POST',
            body: JSON.stringify({
              refreshToken: this.refreshTokenVal,
              userId: this.currentUser?._id,
            }),
          },
          true
        );
      }
    } catch (e) {
      console.warn('Logout request warning:', e);
    } finally {
      this.clearSession();
    }
  }

  // --- Player & Progress Endpoints (Specification 2) ---

  /**
   * GET /api/v1/player/me
   */
  public async getMe(): Promise<PlayerProfileData> {
    const res = await this.request<{
      status: string;
      data: PlayerProfileData;
    }>('/player/me', { method: 'GET' }, true);

    if (res.data.user) {
      this.currentUser = res.data.user;
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(res.data.user));
      this.notifyAuthChange();
    }
    return res.data;
  }

  /**
   * PUT /api/v1/player/appearance
   */
  public async updateAppearance(appearance: Partial<CharacterAppearance>): Promise<void> {
    await this.request(
      '/player/appearance',
      {
        method: 'PUT',
        body: JSON.stringify(appearance),
      },
      true
    );
  }

  /**
   * PUT /api/v1/player/inventory
   */
  public async updateInventory(slots: (ItemType | null)[]): Promise<void> {
    // Must be exactly 5 slots per specification
    const fixedSlots = [...slots];
    while (fixedSlots.length < 5) fixedSlots.push(null);
    if (fixedSlots.length > 5) fixedSlots.length = 5;

    await this.request(
      '/player/inventory',
      {
        method: 'PUT',
        body: JSON.stringify({ slots: fixedSlots }),
      },
      true
    );
  }

  /**
   * POST /api/v1/player/complete-level
   */
  public async completeLevel(params: {
    levelId: number;
    timeSeconds: number;
    relicsFound?: number;
    mode?: 'time_trial' | 'free' | 'chase';
  }): Promise<LevelCompletionResult> {
    const res = await this.request<{
      status: string;
      data: LevelCompletionResult;
    }>(
      '/player/complete-level',
      {
        method: 'POST',
        body: JSON.stringify({
          levelId: params.levelId,
          timeSeconds: Number(params.timeSeconds.toFixed(2)),
          relicsFound: params.relicsFound ?? 0,
          mode: params.mode || 'time_trial',
        }),
      },
      true
    );

    return res.data;
  }

  // --- Leaderboard Endpoints (Specification 3) ---

  /**
   * GET /api/v1/leaderboard/:levelId?mode=time_trial&limit=50
   */
  public async getLeaderboard(
    levelId: number,
    mode: 'time_trial' | 'free' | 'chase' = 'time_trial',
    limit: number = 50
  ): Promise<{ levelId: number; mode: string; count: number; leaderboard: LeaderboardEntry[] }> {
    const res = await this.request<{
      status: string;
      levelId: number;
      mode: string;
      count: number;
      leaderboard: LeaderboardEntry[];
    }>(`/leaderboard/${levelId}?mode=${mode}&limit=${limit}`, { method: 'GET' });

    return res;
  }

  // --- System Diagnostics (Specification 4) ---

  /**
   * GET /api/v1/system/health
   */
  public async checkHealth(): Promise<{
    status: string;
    game: string;
    services: {
      mongoDatabase: string;
      redisCache: string;
      webSocketServer: string;
    };
  }> {
    return await this.request('/system/health', { method: 'GET' });
  }
}

export const apiClient = new ApiClient();
