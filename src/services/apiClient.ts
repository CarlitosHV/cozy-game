/**
 * Client API Service for Cozy Leap Online Backend (v1)
 * Adheres strictly to the specification in API_ENDPOINTS_b196a80b.md:
 *  - Base URL: from VITE_API_URL
 *  - Auth: Register, Login, Refresh, Logout (Bearer token + Refresh Token)
 *  - Player: /player/me, /player/appearance, /player/inventory, /player/complete-level
 *  - Leaderboard: /leaderboard/:levelId
 *  - Friends: /friends, /friends/requests, /friends/search, request/accept/decline, DELETE /:userId
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
  relicsFound?: number;
  createdAt?: string;
}

export interface LeaderboardTables {
  normal?: LeaderboardEntry[];
  contrareloj?: LeaderboardEntry[];
  persecucion?: LeaderboardEntry[];
  free?: LeaderboardEntry[];
  time_trial?: LeaderboardEntry[];
  chase?: LeaderboardEntry[];
}

export interface LeaderboardCounts {
  normal?: number;
  contrareloj?: number;
  persecucion?: number;
  total?: number;
}

export interface LeaderboardResponse {
  status: string;
  levelId: number;
  mode: string;
  count?: number;
  tables?: LeaderboardTables;
  rankings?: LeaderboardTables;
  counts?: LeaderboardCounts;
  leaderboard: LeaderboardEntry[];
}

export type FriendRelationship = 'none' | 'friends' | 'outgoing_request' | 'incoming_request';

export interface FriendUser {
  _id: string;
  username: string;
  displayName: string;
  role?: string;
  online?: boolean;
}

export interface FriendRequestItem {
  _id: string;
  status: string;
  createdAt: string;
  fromUser: FriendUser | null;
}

export interface FriendSearchResult extends FriendUser {
  online?: boolean;
  relationship: FriendRelationship;
  requestId: string | null;
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
    // Written literally so Vite can fill it in both in `npm run dev` and in production builds
    const envUrl = import.meta.env.VITE_API_URL as string | undefined;
    if (!envUrl) {
      throw new Error('VITE_API_URL is required');
    }
    this.baseUrl = envUrl.replace(/\/+$/, '');

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

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public getSocketUrl(): string {
    const parsed = new URL(this.baseUrl);
    return `${parsed.protocol}//${parsed.host}`;
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
        const raw = json?.message || json?.error || '';
        const code = json?.code || response.status.toString();
        const err = new Error(typeof raw === 'string' ? raw : '');
        (err as unknown as { code: string; status: number }).code = code;
        (err as unknown as { status: number }).status = response.status;
        throw err;
      }

      return json as T;
    } catch (err: unknown) {
      if ((err as Error)?.name === 'TypeError' && (err as Error)?.message?.includes('fetch')) {
        const offlineErr = new Error(
          'No hay conexión ahora. Revisa tu internet e inténtalo de nuevo — tus datos siguen escritos.'
        );
        (offlineErr as unknown as { code: string }).code = 'SERVER_OFFLINE';
        (offlineErr as unknown as { status: number }).status = 0;
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
    mode?: 'normal' | 'contrareloj' | 'persecucion' | 'free' | 'time_trial' | 'chase';
  }): Promise<LevelCompletionResult> {
    const modeMap: Record<string, string> = {
      free: 'normal',
      normal: 'normal',
      time_trial: 'contrareloj',
      contrareloj: 'contrareloj',
      chase: 'persecucion',
      persecucion: 'persecucion',
    };
    const mode = modeMap[params.mode || 'normal'] || 'normal';

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
          mode,
        }),
      },
      true
    );

    return res.data;
  }

  // --- Leaderboard Endpoints (Specification 3) ---

  /**
   * GET /api/v1/leaderboard/:levelId?mode=all|contrareloj|normal|persecucion&limit=50
   */
  public async getLeaderboard(
    levelId: number,
    mode: 'all' | 'normal' | 'contrareloj' | 'persecucion' | 'time_trial' | 'free' | 'chase' = 'all',
    limit: number = 50
  ): Promise<LeaderboardResponse> {
    const modeMap: Record<string, string> = {
      all: 'all',
      free: 'normal',
      normal: 'normal',
      time_trial: 'contrareloj',
      contrareloj: 'contrareloj',
      chase: 'persecucion',
      persecucion: 'persecucion',
    };
    const canonicalMode = modeMap[mode] || 'all';

    const raw = await this.request<any>(
      `/leaderboard/${levelId}?mode=${canonicalMode}&limit=${limit}`,
      { method: 'GET' }
    );

    const tables: LeaderboardTables = raw.tables || raw.rankings || {};
    const counts: LeaderboardCounts = raw.counts || {};

    const mapEntry = (e: any): LeaderboardEntry => ({
      rank: e.rank ?? 0,
      userId: e.userId ?? '',
      username: e.username ?? 'Jugador',
      timeSeconds: e.timeSeconds ?? 0,
      collectiblesFound: e.collectiblesFound ?? e.relicsFound ?? 0,
      relicsFound: e.relicsFound ?? e.collectiblesFound ?? 0,
      createdAt: e.createdAt,
    });

    const normalizedTables: LeaderboardTables = {};
    if (Array.isArray(tables.normal)) normalizedTables.normal = tables.normal.map(mapEntry);
    if (Array.isArray(tables.contrareloj)) normalizedTables.contrareloj = tables.contrareloj.map(mapEntry);
    if (Array.isArray(tables.persecucion)) normalizedTables.persecucion = tables.persecucion.map(mapEntry);

    // Determine entries for the requested mode
    let entries: LeaderboardEntry[] = [];
    if (canonicalMode !== 'all' && normalizedTables[canonicalMode as keyof LeaderboardTables]) {
      entries = normalizedTables[canonicalMode as keyof LeaderboardTables]!;
    } else if (Array.isArray(raw.leaderboard)) {
      entries = raw.leaderboard.map(mapEntry);
    } else if (normalizedTables.contrareloj) {
      entries = normalizedTables.contrareloj;
    } else if (normalizedTables.normal) {
      entries = normalizedTables.normal;
    }

    return {
      status: raw.status || 'success',
      levelId: raw.levelId ?? levelId,
      mode: raw.mode || canonicalMode,
      count: raw.count ?? entries.length,
      tables: normalizedTables,
      rankings: normalizedTables,
      counts,
      leaderboard: entries,
    };
  }

  /**
   * GET /api/v1/leaderboard
   * Global endpoint returning all levels (1 to 5) with independent tables.
   */
  public async getAllLeaderboards(): Promise<Record<number, LeaderboardResponse>> {
    const raw = await this.request<any>('/leaderboard', { method: 'GET' });
    return raw?.data || raw || {};
  }

  // --- Friends (Specification 4) ---

  /** GET /api/v1/friends */
  public async listFriends(): Promise<FriendUser[]> {
    const res = await this.request<{
      status: string;
      data: { friends: FriendUser[] };
    }>('/friends', { method: 'GET' }, true);
    return res.data.friends ?? [];
  }

  /** GET /api/v1/friends/requests */
  public async listFriendRequests(): Promise<FriendRequestItem[]> {
    const res = await this.request<{
      status: string;
      data: { requests: FriendRequestItem[] };
    }>('/friends/requests', { method: 'GET' }, true);
    return res.data.requests ?? [];
  }

  /** GET /api/v1/friends/search?q= */
  public async searchFriends(query: string): Promise<FriendSearchResult[]> {
    const q = encodeURIComponent(query.trim());
    const res = await this.request<{
      status: string;
      data: { results: FriendSearchResult[] };
    }>(`/friends/search?q=${q}`, { method: 'GET' }, true);
    return res.data.results ?? [];
  }

  /** POST /api/v1/friends/request */
  public async sendFriendRequest(username: string): Promise<{ status: string; message?: string }> {
    const res = await this.request<{
      status: string;
      message?: string;
      data: { request: { status: string } };
    }>(
      '/friends/request',
      {
        method: 'POST',
        body: JSON.stringify({ username: username.trim().toLowerCase() }),
      },
      true
    );
    return { status: res.data.request?.status ?? 'pending', message: res.message };
  }

  /** POST /api/v1/friends/accept */
  public async acceptFriendRequest(requestId: string): Promise<FriendUser | null> {
    const res = await this.request<{
      status: string;
      data: { friend: FriendUser | null };
    }>(
      '/friends/accept',
      {
        method: 'POST',
        body: JSON.stringify({ requestId }),
      },
      true
    );
    return res.data.friend ?? null;
  }

  /** POST /api/v1/friends/decline */
  public async declineFriendRequest(requestId: string): Promise<void> {
    await this.request(
      '/friends/decline',
      {
        method: 'POST',
        body: JSON.stringify({ requestId }),
      },
      true
    );
  }

  /** DELETE /api/v1/friends/:userId */
  public async removeFriend(userId: string): Promise<void> {
    await this.request(`/friends/${encodeURIComponent(userId)}`, { method: 'DELETE' }, true);
  }

  // --- System Diagnostics (Specification 5) ---

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
