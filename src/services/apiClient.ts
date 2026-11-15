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

import { buildBackendAppearancePayload, CharacterAppearance } from '../game/character';
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

export interface CurrenciesBalance {
  walnut: number;
  crystal: number;
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
    totalWalnutRelicsFound?: number;
    totalCrystalRelicsFound?: number;
    unlockedCompanions: string[];
    relicsBalance?: number;
  };
  currencies?: CurrenciesBalance;
  walnutBalance?: number;
  crystalBalance?: number;
  relicsBalance?: number;
  unlockedItems?: string[];
  equippedItems?: string[];
  equippedByCategory?: Partial<Record<ShopCategory, string>>;
  stats?: {
    totalPlayTimeSeconds: number;
    totalJumps: number;
    totalFalls: number;
  };
}

export type ShopCategory =
  | 'skin'
  | 'hat'
  | 'outfit'
  | 'pattern'
  | 'glasses'
  | 'backpack'
  | 'hair'
  | 'accessory'
  | 'shoes'
  | 'aura'
  | 'companion';

export type ShopTier = 'common' | 'epic' | 'golden' | 'mythic';
export type ShopRarity = ShopTier | 'rare' | 'legendary';

export interface ShopTierMeta {
  id: ShopTier;
  label: string;
  color: string;
  order: number;
}

export interface ShopCatalogCategory {
  id: ShopCategory;
  label: string;
}

export interface ShopItem {
  id: string;
  category: ShopCategory;
  name: string;
  description: string;
  tier: ShopTier;
  rarity: ShopRarity;
  priceWalnut: number;
  priceCrystal: number;
  price: CurrenciesBalance;
  /** Legacy alias equal to priceWalnut */
  priceRelics: number;
  previewColor: string;
  appearancePatch: Record<string, unknown>;
  owned: boolean;
  equipped: boolean;
  canAfford: boolean;
  missingCurrencies: CurrenciesBalance;
}

export interface ShopCatalogResponse {
  currency?: string;
  currencies: CurrenciesBalance;
  walnutBalance: number;
  crystalBalance: number;
  relicsBalance: number;
  tiers?: ShopTierMeta[];
  categories: ShopCatalogCategory[];
  totalItems: number;
  items: ShopItem[];
}

export interface ShopPurchaseHistoryEntry {
  itemId: string;
  priceRelics?: number;
  priceWalnut?: number;
  priceCrystal?: number;
  purchasedAt: string;
}

export interface ShopInventoryResponse {
  currencies?: CurrenciesBalance;
  walnutBalance?: number;
  crystalBalance?: number;
  relicsBalance: number;
  unlockedItems: string[];
  equippedItems?: string[];
  equipped?: string[];
  equippedByCategory?: Record<string, string>;
  appearance?: Record<string, unknown>;
  purchaseHistory?: ShopPurchaseHistoryEntry[];
}

export interface ShopPurchaseResponse {
  purchasedItem: {
    id: string;
    category: ShopCategory;
    tier?: ShopTier;
    priceWalnut?: number;
    priceCrystal?: number;
    priceRelics?: number;
  };
  currencies?: CurrenciesBalance;
  walnutBalance?: number;
  crystalBalance?: number;
  relicsBalance: number;
  spent?: CurrenciesBalance;
  relicsSpent?: number;
  unlockedItems: string[];
  equipped: boolean;
  appliedPatch?: Record<string, unknown>;
  equippedByCategory?: Record<string, string>;
  appearance: Record<string, unknown>;
  message?: string;
}

export interface ShopEquipResponse {
  equippedItems?: string[];
  equipped?: string[];
  equippedByCategory?: Record<string, string>;
  appliedPatch?: Record<string, unknown>;
  appearance: Record<string, unknown>;
  message?: string;
}

export interface PlayerCharacterResponse {
  appearance: Record<string, unknown>;
  equippedByCategory?: Record<string, string>;
  equippedItems?: string[];
  unlockedItems?: string[];
  currencies?: CurrenciesBalance;
  walnutBalance?: number;
  crystalBalance?: number;
  message?: string;
}

export function normalizeShopTier(raw: unknown): ShopTier {
  const s = typeof raw === 'string' ? raw.toLowerCase().trim() : '';
  if (s === 'mythic' || s === 'legendary' || s === 'mitico' || s === 'mítico') return 'mythic';
  if (s === 'golden' || s === 'gold' || s === 'dorado') return 'golden';
  if (s === 'epic' || s === 'rare' || s === 'epico' || s === 'épico') return 'epic';
  return 'common';
}

export const SHOP_TIER_META: Record<ShopTier, ShopTierMeta> = {
  common: { id: 'common', label: 'Común', color: '#94a3b8', order: 1 },
  epic: { id: 'epic', label: 'Épico', color: '#a855f7', order: 2 },
  golden: { id: 'golden', label: 'Dorado', color: '#facc15', order: 3 },
  mythic: { id: 'mythic', label: 'Mítico', color: '#f43f5e', order: 4 },
};

function extractCurrencies(raw: any): CurrenciesBalance | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw.currencies && typeof raw.currencies === 'object' ? raw.currencies : null;
  const w =
    typeof c?.walnut === 'number'
      ? c.walnut
      : typeof raw.walnutBalance === 'number'
        ? raw.walnutBalance
        : typeof raw.relicsBalance === 'number'
          ? raw.relicsBalance
          : typeof raw.progress?.relicsBalance === 'number'
            ? raw.progress.relicsBalance
            : null;
  const cr =
    typeof c?.crystal === 'number'
      ? c.crystal
      : typeof raw.crystalBalance === 'number'
        ? raw.crystalBalance
        : null;
  if (w === null && cr === null) return null;
  return {
    walnut: Math.max(0, Math.floor(w ?? 0)),
    crystal: Math.max(0, Math.floor(cr ?? 0)),
  };
}

function normalizeShopItem(raw: any): ShopItem {
  const tier = normalizeShopTier(raw?.tier ?? raw?.rarity);
  const priceWalnut = Math.max(
    0,
    Math.floor(
      typeof raw?.priceWalnut === 'number'
        ? raw.priceWalnut
        : typeof raw?.price?.walnut === 'number'
          ? raw.price.walnut
          : typeof raw?.priceRelics === 'number'
            ? raw.priceRelics
            : 0
    )
  );
  const priceCrystal = Math.max(
    0,
    Math.floor(
      typeof raw?.priceCrystal === 'number'
        ? raw.priceCrystal
        : typeof raw?.price?.crystal === 'number'
          ? raw.price.crystal
          : 0
    )
  );
  const missingWalnut = Math.max(0, Math.floor(raw?.missingCurrencies?.walnut ?? 0));
  const missingCrystal = Math.max(0, Math.floor(raw?.missingCurrencies?.crystal ?? 0));
  return {
    id: String(raw?.id ?? ''),
    category: (raw?.category ?? 'accessory') as ShopCategory,
    name: String(raw?.name ?? ''),
    description: String(raw?.description ?? ''),
    tier,
    rarity: (raw?.rarity ? normalizeShopTier(raw.rarity) : tier) as ShopRarity,
    priceWalnut,
    priceCrystal,
    price: { walnut: priceWalnut, crystal: priceCrystal },
    priceRelics: typeof raw?.priceRelics === 'number' ? raw.priceRelics : priceWalnut,
    previewColor: String(raw?.previewColor ?? '#94a3b8'),
    appearancePatch: (raw?.appearancePatch && typeof raw.appearancePatch === 'object' ? raw.appearancePatch : {}) as Record<string, unknown>,
    owned: Boolean(raw?.owned),
    equipped: Boolean(raw?.equipped),
    canAfford: typeof raw?.canAfford === 'boolean' ? raw.canAfford : missingWalnut === 0 && missingCrystal === 0,
    missingCurrencies: { walnut: missingWalnut, crystal: missingCrystal },
  };
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  timeSeconds: number;
  collectiblesFound: number;
  relicsFound?: number;
  /** Level rating 0-1000, 0-3 stars and deaths of that run */
  score?: number;
  stars?: number;
  deaths?: number;
  createdAt?: string;
}

/** Ranking order: higher score first, then the faster time */
export function compareEntries(a: LeaderboardEntry, b: LeaderboardEntry): number {
  return (b.score ?? 0) - (a.score ?? 0) || a.timeSeconds - b.timeSeconds;
}

export interface RoomPlayerSummary {
  userId: string;
  id?: string;
  username: string;
  displayName?: string;
  name?: string;
  playerName?: string;
  levelId?: number;
  isFinished?: boolean;
  finishTimeSeconds?: number;
  rank?: number;
  isSpectating?: boolean;
  spectateTargetUserId?: string;
}

export interface RoomDetail {
  roomId: string;
  levelId: number;
  playerCount: number;
  maxPlayers: number;
  finishedCount: number;
  allFinished: boolean;
  spectatorCount: number;
  players: RoomPlayerSummary[];
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
    score?: number;
    stars?: number;
    deaths?: number;
    createdAt: string;
  };
  rank: number;
  isNewBest: boolean;
  progress: {
    maxUnlockedLevel: number;
    completedLevels: number[];
    totalCollectiblesFound: number;
    totalWalnutRelicsFound?: number;
    totalCrystalRelicsFound?: number;
    relicsBalance?: number;
  };
  currencies?: CurrenciesBalance;
  walnutBalance?: number;
  crystalBalance?: number;
  walnutRelicsEarned?: number;
  crystalRelicsEarned?: number;
  relicsBalance?: number;
  relicsEarned?: number;
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
  private cachedCurrencies: CurrenciesBalance | null = null;
  private currenciesListeners: Set<(currencies: CurrenciesBalance) => void> = new Set();
  private relicsListeners: Set<(balance: number) => void> = new Set();
  private isRefreshing: boolean = false;
  private refreshPromise: Promise<string | null> | null = null;

  constructor() {
    // Written literally so Vite can fill it in both in `npm run dev` and in production builds
    const envUrl = (import.meta.env.VITE_API_URL as string | undefined) || '/api/v1';
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
    const parsed = new URL(this.baseUrl.startsWith('http') ? this.baseUrl : `${window.location.origin}${this.baseUrl}`);
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

  public getCachedCurrencies(): CurrenciesBalance | null {
    return this.cachedCurrencies ? { ...this.cachedCurrencies } : null;
  }

  public setCachedCurrencies(currencies: Partial<CurrenciesBalance> | null | undefined) {
    if (!currencies || typeof currencies !== 'object') return;
    const prev = this.cachedCurrencies ?? { walnut: 0, crystal: 0 };
    const next: CurrenciesBalance = {
      walnut:
        typeof currencies.walnut === 'number' && Number.isFinite(currencies.walnut)
          ? Math.max(0, Math.floor(currencies.walnut))
          : prev.walnut,
      crystal:
        typeof currencies.crystal === 'number' && Number.isFinite(currencies.crystal)
          ? Math.max(0, Math.floor(currencies.crystal))
          : prev.crystal,
    };
    this.cachedCurrencies = next;
    for (const cb of this.currenciesListeners) {
      cb({ ...next });
    }
    for (const cb of this.relicsListeners) {
      cb(next.walnut);
    }
  }

  public onCurrenciesChange(cb: (currencies: CurrenciesBalance) => void): () => void {
    this.currenciesListeners.add(cb);
    if (this.cachedCurrencies !== null) {
      cb({ ...this.cachedCurrencies });
    }
    return () => {
      this.currenciesListeners.delete(cb);
    };
  }

  public async refreshCurrencies(): Promise<CurrenciesBalance | null> {
    try {
      if (this.accessToken && !this.accessToken.startsWith('offline_token_')) {
        try {
          const charState = await this.getPlayerCharacter();
          const c = extractCurrencies(charState);
          if (c) return c;
        } catch {
          // fallback to inventory/catalog
        }
        try {
          const inv = await this.getShopInventory();
          const c = extractCurrencies(inv);
          if (c) return c;
        } catch {
          // fallback to catalog
        }
      }
      const cat = await this.getShopCatalog();
      return cat.currencies ?? this.cachedCurrencies;
    } catch {
      return this.cachedCurrencies;
    }
  }

  public getCachedRelicsBalance(): number | null {
    return this.cachedCurrencies ? this.cachedCurrencies.walnut : null;
  }

  public setCachedRelicsBalance(balance: number | null | undefined) {
    if (typeof balance !== 'number' || !Number.isFinite(balance)) return;
    this.setCachedCurrencies({ walnut: balance });
  }

  public onRelicsChange(cb: (balance: number) => void): () => void {
    this.relicsListeners.add(cb);
    if (this.cachedCurrencies !== null) {
      cb(this.cachedCurrencies.walnut);
    }
    return () => {
      this.relicsListeners.delete(cb);
    };
  }

  public async refreshRelicsBalance(): Promise<number | null> {
    const c = await this.refreshCurrencies();
    return c ? c.walnut : null;
  }

  private clearSession() {
    this.currentUser = null;
    this.accessToken = null;
    this.refreshTokenVal = null;
    this.cachedCurrencies = null;
    for (const cb of this.currenciesListeners) {
      cb({ walnut: 0, crystal: 0 });
    }
    for (const cb of this.relicsListeners) {
      cb(0);
    }
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
    requireAuth: boolean | 'optional' = false
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    const sendAuth = Boolean(requireAuth && this.accessToken);
    if (sendAuth && this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    try {
      let response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include', // Include HttpOnly cookies for refresh
        cache: 'no-store',
      });

      // Handle token expiration: attempt automatic refresh once (supports both stored token and HttpOnly cookie)
      if (response.status === 401 && requireAuth && !this.isRefreshing && !endpoint.startsWith('/auth/')) {
        const newAccessToken = await this.refreshToken();
        if (newAccessToken) {
          headers['Authorization'] = `Bearer ${newAccessToken}`;
          response = await fetch(url, {
            ...options,
            headers,
            credentials: 'include',
            cache: 'no-store',
          });
        }
      }

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        const raw = json?.message || json?.error || '';
        const code = json?.code || response.status.toString();
        const err = new Error(typeof raw === 'string' ? raw : '') as Error & {
          code: string;
          status: number;
          details?: Record<string, unknown>;
        };
        err.code = code;
        err.status = response.status;
        if (json?.details && typeof json.details === 'object') {
          err.details = json.details as Record<string, unknown>;
        }
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
            ...(this.refreshTokenVal ? { refreshToken: this.refreshTokenVal } : {}),
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
    const curr = extractCurrencies(res.data);
    if (curr) {
      this.setCachedCurrencies(curr);
    }
    return res.data;
  }

  /**
   * GET /api/v1/player/character
   * Full customization editor state (appearance, equippedByCategory, unlockedItems, currencies)
   */
  public async getPlayerCharacter(): Promise<PlayerCharacterResponse> {
    const res = await this.request<{
      status: string;
      data: PlayerCharacterResponse;
    }>('/player/character', { method: 'GET' }, true);
    const data = res.data ?? (res as unknown as PlayerCharacterResponse);
    const curr = extractCurrencies(data);
    if (curr) this.setCachedCurrencies(curr);
    return data;
  }

  /**
   * PATCH /api/v1/player/character (with PUT fallback)
   * Updates appearance, equipItemIds, unequipCategories, or resetToDefault atomically without overwriting prior customization.
   */
  public async updatePlayerCharacter(params: {
    appearance?: Partial<CharacterAppearance>;
    equipItemIds?: string[];
    unequipCategories?: string[];
    resetToDefault?: boolean;
  }): Promise<PlayerCharacterResponse> {
    const bodyPayload: Record<string, unknown> = {};
    if (params.appearance) {
      bodyPayload.appearance = buildBackendAppearancePayload(params.appearance);
    }
    if (Array.isArray(params.equipItemIds) && params.equipItemIds.length > 0) {
      bodyPayload.equipItemIds = params.equipItemIds;
    }
    if (Array.isArray(params.unequipCategories) && params.unequipCategories.length > 0) {
      bodyPayload.unequipCategories = params.unequipCategories;
    }
    if (params.resetToDefault) {
      bodyPayload.resetToDefault = true;
    }

    let res: { status: string; data: PlayerCharacterResponse; message?: string };
    try {
      res = await this.request<{ status: string; data: PlayerCharacterResponse; message?: string }>(
        '/player/character',
        { method: 'PATCH', body: JSON.stringify(bodyPayload) },
        true
      );
    } catch (err: unknown) {
      const apiErr = err as { status?: number };
      if (apiErr?.status === 404 || apiErr?.status === 405) {
        // Fallback to PUT /player/character or /player/appearance if PATCH/character isn't mounted yet
        if (apiErr?.status === 405) {
          res = await this.request<{ status: string; data: PlayerCharacterResponse; message?: string }>(
            '/player/character',
            { method: 'PUT', body: JSON.stringify(bodyPayload) },
            true
          );
        } else {
          if (params.appearance) await this.updateAppearance(params.appearance);
          if (params.equipItemIds?.length) await this.equipShopItems(params.equipItemIds, params.appearance);
          return {
            appearance: bodyPayload.appearance as Record<string, unknown>,
            equippedItems: params.equipItemIds,
          };
        }
      } else {
        throw err;
      }
    }

    const data = res.data ?? (res as unknown as PlayerCharacterResponse);
    const curr = extractCurrencies(data);
    if (curr) this.setCachedCurrencies(curr);
    return { ...data, message: res.message || data.message };
  }

  /**
   * PATCH /api/v1/player/appearance (with PUT fallback)
   * Non-destructive: omitted fields are preserved on backend.
   */
  public async updateAppearance(appearance: Partial<CharacterAppearance>): Promise<void> {
    const payload = buildBackendAppearancePayload(appearance);
    try {
      await this.request(
        '/player/appearance',
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        },
        true
      );
    } catch (err: unknown) {
      const apiErr = err as { status?: number };
      if (apiErr?.status === 404 || apiErr?.status === 405) {
        await this.request(
          '/player/appearance',
          {
            method: 'PUT',
            body: JSON.stringify(payload),
          },
          true
        );
      } else {
        throw err;
      }
    }
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
   * Ensures the client has a valid session. If not logged in, registers an anonymous guest.
   */
  public async ensureAuthenticated(): Promise<User> {
    if (this.currentUser && this.accessToken) {
      return this.currentUser;
    }
    try {
      const rnd = Math.random().toString(36).substring(2, 7);
      const guestUser = `viajero_${rnd}`;
      const guestEmail = `viajero_${Date.now()}_${rnd}@cozyleap.local`;
      const guestPass = `CozyLeap${Math.floor(1000 + Math.random() * 9000)}!`;
      const res = await this.register({
        username: guestUser,
        displayName: `Viajero #${rnd.toUpperCase()}`,
        email: guestEmail,
        password: guestPass,
      });
      return res.user;
    } catch {
      // Offline fallback user
      const offlineUser: User = {
        _id: `offline_${Date.now()}`,
        username: 'viajero',
        displayName: 'Viajero',
        email: 'viajero@cozyleap.local',
        role: 'player',
        isActive: true,
      };
      this.currentUser = offlineUser;
      this.accessToken = `offline_token_${Date.now()}`;
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(offlineUser));
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, this.accessToken);
      }
      this.notifyAuthChange();
      return offlineUser;
    }
  }

  private getLocalRecords(): Record<string, LeaderboardEntry[]> {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem('cozyleap_local_records');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private saveLocalRecord(levelId: number, mode: string, entry: LeaderboardEntry) {
    if (typeof window === 'undefined') return;
    try {
      const all = this.getLocalRecords();
      const key = `${levelId}_${mode}`;
      const list = all[key] || [];
      const existing = list.find((item) => item.username === entry.username);
      if (existing) {
        if (compareEntries(entry, existing) <= 0) {
          existing.timeSeconds = entry.timeSeconds;
          existing.collectiblesFound = entry.collectiblesFound;
          existing.relicsFound = entry.relicsFound;
          existing.score = entry.score;
          existing.stars = entry.stars;
          existing.deaths = entry.deaths;
          existing.createdAt = entry.createdAt;
        }
      } else {
        list.push(entry);
      }
      list.sort(compareEntries);
      all[key] = list.slice(0, 50);
      localStorage.setItem('cozyleap_local_records', JSON.stringify(all));
    } catch (e) {
      console.warn('Failed to save local record:', e);
    }
  }

  /**
   * POST /api/v1/player/complete-level
   */
  public async completeLevel(params: {
    levelId: number;
    timeSeconds: number;
    walnutRelicsFound?: number;
    crystalRelicsFound?: number;
    relicsFound?: number;
    score?: number;
    stars?: number;
    deaths?: number;
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

    const minThresholds: Record<number, number> = {
      1: 4.6,
      2: 7.1,
      3: 10.1,
      4: 14.1,
      5: 18.1,
    };
    const minSecs = minThresholds[params.levelId] ?? 4.6;
    const timeSeconds = Math.max(minSecs, Number(params.timeSeconds.toFixed(2)));

    const walnutFound = Math.max(0, Math.floor(params.walnutRelicsFound ?? params.relicsFound ?? 0));
    const crystalFound = Math.max(0, Math.floor(params.crystalRelicsFound ?? 0));
    const totalRelicsFound = Math.max(0, Math.floor(params.relicsFound ?? walnutFound + crystalFound));

    // Ensure user session exists so records are always attached to a player
    await this.ensureAuthenticated().catch(() => {});
    const currentUsername = this.currentUser?.displayName || this.currentUser?.username || 'Viajero';
    const localEntry: LeaderboardEntry = {
      rank: 1,
      userId: this.currentUser?._id || 'local_user',
      username: currentUsername,
      timeSeconds,
      collectiblesFound: totalRelicsFound,
      relicsFound: totalRelicsFound,
      score: params.score ?? 0,
      stars: params.stars ?? 0,
      deaths: params.deaths ?? 0,
      createdAt: new Date().toISOString(),
    };
    this.saveLocalRecord(params.levelId, mode, localEntry);

    const buildOfflineResult = (): LevelCompletionResult => {
      const prev = this.cachedCurrencies ?? { walnut: 0, crystal: 0 };
      const updated = {
        walnut: prev.walnut + walnutFound,
        crystal: prev.crystal + crystalFound,
      };
      this.setCachedCurrencies(updated);
      return {
        record: {
          _id: `rec_${Date.now()}`,
          userId: localEntry.userId,
          username: localEntry.username,
          levelId: params.levelId,
          mode,
          timeSeconds,
          collectiblesFound: totalRelicsFound,
          createdAt: localEntry.createdAt || new Date().toISOString(),
        },
        rank: 1,
        isNewBest: true,
        walnutRelicsEarned: walnutFound,
        crystalRelicsEarned: crystalFound,
        relicsEarned: walnutFound + crystalFound,
        currencies: updated,
        walnutBalance: updated.walnut,
        crystalBalance: updated.crystal,
        relicsBalance: updated.walnut,
        progress: {
          maxUnlockedLevel: Math.max(params.levelId + 1, 2),
          completedLevels: [params.levelId],
          totalCollectiblesFound: totalRelicsFound,
          totalWalnutRelicsFound: walnutFound,
          totalCrystalRelicsFound: crystalFound,
        },
      };
    };

    if (this.accessToken?.startsWith('offline_token_')) {
      return buildOfflineResult();
    }

    const baseBody = {
      levelId: params.levelId,
      timeSeconds,
      walnutRelicsFound: walnutFound,
      crystalRelicsFound: crystalFound,
      relicsFound: totalRelicsFound,
      mode,
    };
    const fullBody = {
      ...baseBody,
      score: Math.round(params.score ?? 0),
      stars: Math.round(params.stars ?? 0),
      deaths: Math.round(params.deaths ?? 0),
    };

    try {
      let res: any;
      try {
        res = await this.request<any>(
          '/player/complete-level',
          {
            method: 'POST',
            body: JSON.stringify(fullBody),
          },
          true
        );
      } catch (innerErr: unknown) {
        const apiErr = innerErr as { status?: number };
        if (apiErr?.status === 400) {
          // Retry with strict spec-documented body in case backend rejects extra fields
          res = await this.request<any>(
            '/player/complete-level',
            {
              method: 'POST',
              body: JSON.stringify(baseBody),
            },
            true
          );
        } else {
          throw innerErr;
        }
      }

      const data = res?.data ?? res ?? {};
      const nextCurr = extractCurrencies(data);
      if (nextCurr) {
        this.setCachedCurrencies(nextCurr);
      } else {
        const prev = this.cachedCurrencies ?? { walnut: 0, crystal: 0 };
        const wEarned = typeof data?.walnutRelicsEarned === 'number' ? data.walnutRelicsEarned : walnutFound;
        const cEarned = typeof data?.crystalRelicsEarned === 'number' ? data.crystalRelicsEarned : crystalFound;
        this.setCachedCurrencies({
          walnut: prev.walnut + wEarned,
          crystal: prev.crystal + cEarned,
        });
      }

      if (data?.record) {
        this.saveLocalRecord(params.levelId, mode, {
          rank: data.rank ?? 1,
          userId: data.record.userId || localEntry.userId,
          username: data.record.username || localEntry.username,
          timeSeconds: data.record.timeSeconds || timeSeconds,
          collectiblesFound: data.record.collectiblesFound ?? totalRelicsFound,
          relicsFound: data.record.collectiblesFound ?? totalRelicsFound,
          score: data.record.score ?? localEntry.score,
          stars: data.record.stars ?? localEntry.stars,
          deaths: data.record.deaths ?? localEntry.deaths,
          createdAt: data.record.createdAt || localEntry.createdAt,
        });
      }
      return data;
    } catch (err) {
      const apiErr = err as { status?: number; code?: string };
      const isOffline =
        apiErr?.status === 0 ||
        apiErr?.code === 'SERVER_OFFLINE' ||
        Boolean(this.accessToken?.startsWith('offline_token_'));
      if (!isOffline) {
        throw err;
      }
      console.warn('Backend complete-level sync deferred while offline, using local storage:', err);
      return buildOfflineResult();
    }
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

    let raw: any = {};
    try {
      raw = await this.request<any>(
        `/leaderboard/${levelId}?mode=${canonicalMode}&limit=${limit}`,
        { method: 'GET' }
      );
    } catch (e) {
      console.warn('Leaderboard request failed, falling back to local records:', e);
      raw = { status: 'success', levelId, mode: canonicalMode, tables: {}, counts: {} };
    }

    const tables: LeaderboardTables = raw?.tables || raw?.rankings || {};
    const counts: LeaderboardCounts = raw?.counts || {};

    const mapEntry = (e: any): LeaderboardEntry => ({
      rank: e.rank ?? 0,
      userId: e.userId ?? '',
      username: e.username ?? 'Jugador',
      timeSeconds: e.timeSeconds ?? 0,
      collectiblesFound: e.collectiblesFound ?? e.relicsFound ?? 0,
      relicsFound: e.relicsFound ?? e.collectiblesFound ?? 0,
      score: typeof e.score === 'number' ? e.score : 0,
      stars: typeof e.stars === 'number' ? e.stars : 0,
      deaths: typeof e.deaths === 'number' ? e.deaths : 0,
      createdAt: e.createdAt,
    });

    const normalizedTables: LeaderboardTables = {};
    if (Array.isArray(tables.normal)) normalizedTables.normal = tables.normal.map(mapEntry);
    if (Array.isArray(tables.contrareloj)) normalizedTables.contrareloj = tables.contrareloj.map(mapEntry);
    if (Array.isArray(tables.persecucion)) normalizedTables.persecucion = tables.persecucion.map(mapEntry);

    // Merge any local records so the current player's latest runs always show up
    const localAll = this.getLocalRecords();
    (['normal', 'contrareloj', 'persecucion'] as const).forEach((m) => {
      const locList = localAll[`${levelId}_${m}`] || [];
      const currentList = normalizedTables[m] || [];
      const combined = [...currentList];
      for (const loc of locList) {
        if (!combined.some((c) => c.username === loc.username && Math.abs(c.timeSeconds - loc.timeSeconds) < 0.05)) {
          combined.push(loc);
        }
      }
      combined.sort(compareEntries);
      combined.forEach((entry, idx) => {
        entry.rank = idx + 1;
      });
      normalizedTables[m] = combined;
    });

    const effectiveCounts: LeaderboardCounts = {
      normal: normalizedTables.normal?.length ?? 0,
      contrareloj: normalizedTables.contrareloj?.length ?? 0,
      persecucion: normalizedTables.persecucion?.length ?? 0,
      total:
        (normalizedTables.normal?.length ?? 0) +
        (normalizedTables.contrareloj?.length ?? 0) +
        (normalizedTables.persecucion?.length ?? 0),
    };

    // Determine entries for the requested mode
    let entries: LeaderboardEntry[] = [];
    if (canonicalMode !== 'all' && normalizedTables[canonicalMode as keyof LeaderboardTables]) {
      entries = normalizedTables[canonicalMode as keyof LeaderboardTables]!;
    } else if (Array.isArray(raw?.leaderboard)) {
      entries = raw.leaderboard.map(mapEntry);
    } else if (normalizedTables.contrareloj && normalizedTables.contrareloj.length > 0) {
      entries = normalizedTables.contrareloj;
    } else if (normalizedTables.normal && normalizedTables.normal.length > 0) {
      entries = normalizedTables.normal;
    } else if (normalizedTables.persecucion && normalizedTables.persecucion.length > 0) {
      entries = normalizedTables.persecucion;
    }

    return {
      status: raw?.status || 'success',
      levelId: raw?.levelId ?? levelId,
      mode: raw?.mode || canonicalMode,
      count: entries.length,
      tables: normalizedTables,
      rankings: normalizedTables,
      counts: effectiveCounts,
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

  // --- Rooms Endpoints (/api/v1/rooms) ---

  /** POST /api/v1/rooms/create */
  public async createRoom(levelId: number = 1, customCode?: string): Promise<{ roomId: string; levelId: number }> {
    const res = await this.request<{
      status: string;
      data: { roomId: string; levelId: number };
    }>('/rooms/create', {
      method: 'POST',
      body: JSON.stringify({ levelId, ...(customCode ? { customCode } : {}) }),
    });
    return res.data;
  }

  /**
   * POST /api/v1/ai/skinwalker — the AI director (xAI on the server) decides what each copy of the
   * Skinwalker does next. Throws when the AI is off or busy; the game then uses its own rules.
   */
  public async aiSkinwalker(state: unknown): Promise<{ copies: { id: number; act: 'follow' | 'lure' | 'stare' | 'hide' | 'whisper' | 'strike' | 'gather'; say?: string }[] }> {
    const res = await this.request<{ status: string; data: { copies: { id: number; act: 'follow' | 'lure' | 'stare' | 'hide' | 'whisper' | 'strike' | 'gather'; say?: string }[] } }>(
      '/ai/skinwalker',
      { method: 'POST', body: JSON.stringify(state) },
      true
    );
    return res.data;
  }

  /** GET /api/v1/rooms */
  public async listRooms(): Promise<RoomDetail[]> {
    const res = await this.request<{
      status: string;
      totalActiveRooms: number;
      rooms: RoomDetail[];
    }>('/rooms', { method: 'GET' });
    return res.rooms ?? [];
  }

  /** GET /api/v1/rooms/my-room */
  public async getMyRoom(): Promise<RoomDetail | null> {
    try {
      const res = await this.request<{
        status: string;
        data: RoomDetail;
      }>('/rooms/my-room', { method: 'GET' }, true);
      return res.data ?? null;
    } catch {
      return null;
    }
  }

  /** GET /api/v1/rooms/:roomId */
  public async getRoom(roomId: string): Promise<RoomDetail | null> {
    const res = await this.request<{
      status: string;
      data: RoomDetail;
    }>(`/rooms/${encodeURIComponent(roomId)}`, { method: 'GET' });
    return res.data ?? null;
  }

  // --- Shop & Cosmetics Endpoints (/api/v1/shop) ---

  /**
   * GET /api/v1/shop/catalog
   * Sends Bearer token when signed in so owned/equipped/canAfford, missingCurrencies and dual currencies are accurate.
   */
  public async getShopCatalog(params?: {
    category?: string;
    tier?: string;
    rarity?: string;
    onlyOwned?: boolean;
  }): Promise<ShopCatalogResponse> {
    const query = new URLSearchParams();
    if (params?.category && params.category !== 'all') query.set('category', params.category);
    const tierFilter = params?.tier || params?.rarity;
    if (tierFilter && tierFilter !== 'all') query.set('tier', tierFilter);
    if (params?.onlyOwned) query.set('onlyOwned', 'true');
    const qs = query.toString();
    const res = await this.request<{
      status: string;
      data: any;
    }>(
      `/shop/catalog${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      this.accessToken ? 'optional' : false
    );
    const rawData = res.data ?? res ?? {};
    const currencies = extractCurrencies(rawData) ?? { walnut: 0, crystal: 0 };
    if (extractCurrencies(rawData)) {
      this.setCachedCurrencies(currencies);
    }
    const items = Array.isArray(rawData.items) ? rawData.items.map(normalizeShopItem) : [];
    const tiers = Array.isArray(rawData.tiers)
      ? rawData.tiers.map((t: any) => ({
          id: normalizeShopTier(t.id),
          label: String(t.label ?? SHOP_TIER_META[normalizeShopTier(t.id)].label),
          color: String(t.color ?? SHOP_TIER_META[normalizeShopTier(t.id)].color),
          order: typeof t.order === 'number' ? t.order : SHOP_TIER_META[normalizeShopTier(t.id)].order,
        }))
      : Object.values(SHOP_TIER_META);

    return {
      currency: rawData.currency,
      currencies,
      walnutBalance: currencies.walnut,
      crystalBalance: currencies.crystal,
      relicsBalance: currencies.walnut,
      tiers,
      categories: Array.isArray(rawData.categories) ? rawData.categories : [],
      totalItems: typeof rawData.totalItems === 'number' ? rawData.totalItems : items.length,
      items,
    };
  }

  /**
   * GET /api/v1/shop/inventory
   */
  public async getShopInventory(): Promise<ShopInventoryResponse> {
    const res = await this.request<{
      status: string;
      data: ShopInventoryResponse;
    }>('/shop/inventory', { method: 'GET' }, true);
    const data = res.data ?? (res as unknown as ShopInventoryResponse);
    const curr = extractCurrencies(data);
    if (curr) {
      this.setCachedCurrencies(curr);
    }
    return {
      ...data,
      currencies: curr ?? data.currencies,
      walnutBalance: curr?.walnut ?? data.walnutBalance ?? data.relicsBalance ?? 0,
      crystalBalance: curr?.crystal ?? data.crystalBalance ?? 0,
      relicsBalance: curr?.walnut ?? data.relicsBalance ?? 0,
    };
  }

  /**
   * POST /api/v1/shop/purchase
   * Preserves local character appearance when autoEquip is true by forwarding currentAppearance.
   */
  public async purchaseShopItem(
    itemId: string,
    autoEquip: boolean = true,
    currentAppearance?: Partial<CharacterAppearance>
  ): Promise<ShopPurchaseResponse> {
    const bodyPayload: Record<string, unknown> = { itemId, autoEquip };
    if (currentAppearance) {
      bodyPayload.currentAppearance = buildBackendAppearancePayload(currentAppearance);
    }
    const res = await this.request<{
      status: string;
      message?: string;
      data: ShopPurchaseResponse;
    }>(
      '/shop/purchase',
      {
        method: 'POST',
        body: JSON.stringify(bodyPayload),
      },
      true
    );
    const data = res.data ?? (res as unknown as ShopPurchaseResponse);
    const curr = extractCurrencies(data);
    if (curr) {
      this.setCachedCurrencies(curr);
    }
    return {
      ...data,
      currencies: curr ?? data.currencies,
      walnutBalance: curr?.walnut ?? data.walnutBalance ?? data.relicsBalance,
      crystalBalance: curr?.crystal ?? data.crystalBalance ?? 0,
      relicsBalance: curr?.walnut ?? data.relicsBalance ?? 0,
      message: res.message || data.message,
    };
  }

  /**
   * POST /api/v1/shop/equip
   * Merges item slot appearancePatch cleanly while optionally forwarding unsaved currentAppearance.
   */
  public async equipShopItems(
    itemIds: string | string[],
    currentAppearance?: Partial<CharacterAppearance>
  ): Promise<ShopEquipResponse> {
    const body: Record<string, unknown> = Array.isArray(itemIds) ? { itemIds } : { itemId: itemIds };
    if (currentAppearance) {
      body.currentAppearance = buildBackendAppearancePayload(currentAppearance);
    }
    const res = await this.request<{
      status: string;
      message?: string;
      data: ShopEquipResponse;
    }>(
      '/shop/equip',
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      true
    );
    const data = res.data ?? (res as unknown as ShopEquipResponse);
    return { ...data, message: res.message || data.message };
  }

  /**
   * POST /api/v1/shop/unequip
   * Removes accessory/slot categories cleanly without affecting the rest of the character.
   */
  public async unequipShopItems(params: {
    categories?: string[];
    category?: string;
    itemId?: string;
    currentAppearance?: Partial<CharacterAppearance>;
  }): Promise<ShopEquipResponse> {
    const body: Record<string, unknown> = {};
    if (params.categories) body.categories = params.categories;
    if (params.category) body.category = params.category;
    if (params.itemId) body.itemId = params.itemId;
    if (params.currentAppearance) {
      body.currentAppearance = buildBackendAppearancePayload(params.currentAppearance);
    }
    const res = await this.request<{
      status: string;
      message?: string;
      data: ShopEquipResponse;
    }>(
      '/shop/unequip',
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      true
    );
    const data = res.data ?? (res as unknown as ShopEquipResponse);
    return { ...data, message: res.message || data.message };
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
