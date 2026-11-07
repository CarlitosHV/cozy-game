/**
 * Socket.io Multiplayer Client for Cozy Leap Online
 * Spec sections 4–6: rooms, presence, party invites (up to 10 players).
 */

import { io, Socket } from 'socket.io-client';
import { apiClient } from './apiClient';
import { CharacterAppearance, loadAppearance } from '../game/character';

export interface RemotePlayer {
  userId: string;
  id?: string;
  username: string;
  displayName?: string;
  name?: string;
  playerName?: string;
  tag?: string;
  label?: string;
  appearance?: CharacterAppearance;
  x: number;
  y: number;
  z: number;
  yaw: number;
  anim: 'idle' | 'walk' | 'run' | 'jump' | 'fall';
  action?: string;
  position?: { x: number; y: number; z: number; yaw?: number };
  lastUpdate: number;
  socketId?: string;
  levelId?: number;
}

export function getPlayerDisplayName(
  p?: Partial<RemotePlayer> | { displayName?: string; name?: string; playerName?: string; username?: string } | null
): string {
  if (!p) return 'Explorador';
  const name = p.displayName || p.name || p.playerName || p.username || 'Explorador';
  return name.trim() || 'Explorador';
}

export function getPlayerId(
  p?: Partial<RemotePlayer> | { userId?: string; id?: string; socketId?: string } | null
): string {
  if (!p) return '';
  return p.userId || p.id || p.socketId || '';
}

export function normalizeRemotePlayer(raw: any): RemotePlayer {
  const nested = raw?.position;
  const userId = getPlayerId(raw);
  const displayName = getPlayerDisplayName(raw);
  return {
    userId,
    id: raw?.id || userId,
    username: raw?.username || displayName,
    displayName,
    name: raw?.name || displayName,
    playerName: raw?.playerName || displayName,
    tag: raw?.tag,
    label: raw?.label,
    appearance: raw?.appearance,
    x: Number.isFinite(raw?.x) ? raw.x : Number(nested?.x) || 0,
    y: Number.isFinite(raw?.y) ? raw.y : Number(nested?.y) || 0,
    z: Number.isFinite(raw?.z) ? raw.z : Number(nested?.z) || 0,
    yaw: Number.isFinite(raw?.yaw) ? raw.yaw : Number(nested?.yaw) || 0,
    anim: raw?.anim || 'idle',
    action: raw?.action,
    position: {
      x: Number.isFinite(raw?.x) ? raw.x : Number(nested?.x) || 0,
      y: Number.isFinite(raw?.y) ? raw.y : Number(nested?.y) || 0,
      z: Number.isFinite(raw?.z) ? raw.z : Number(nested?.z) || 0,
      yaw: Number.isFinite(raw?.yaw) ? raw.yaw : Number(nested?.yaw) || 0,
    },
    lastUpdate: raw?.lastUpdate || performance.now(),
    socketId: raw?.socketId,
    levelId: raw?.levelId,
  };
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface RoomStatePayload {
  levelId: number;
  roomId?: string | null;
  players: RemotePlayer[];
  yourSpawn?: { x: number; y: number; z: number };
  self?: {
    userId?: string;
    id?: string;
    username?: string;
    displayName?: string;
    name?: string;
    playerName?: string;
    tag?: string;
    label?: string;
  };
}

export interface InviteReceivedPayload {
  inviteId: string;
  fromUserId: string;
  fromUsername: string;
  levelId: number;
  roomId?: string;
  expiresInSeconds: number;
}

export interface InviteSentPayload {
  inviteId: string;
  toUserId: string;
  levelId: number;
  roomId?: string;
  expiresInSeconds: number;
}

export interface InviteResultPayload {
  inviteId: string;
  accepted: boolean;
  roomId?: string;
  levelId: number;
  fromUserId?: string;
  toUserId?: string;
  fromUsername?: string;
  reason?: 'declined' | 'expired' | string;
}

export interface SocketErrorPayload {
  code?: string;
  message: string;
}

export interface PlayerMovedPayload {
  userId: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  anim: 'idle' | 'walk' | 'run' | 'jump' | 'fall';
  action?: string;
  /** Level the player is on (players of the same room can be on different levels for a moment) */
  levelId?: number;
}

/** A party member changed their character or its name. */
export interface PlayerProfilePayload {
  userId: string;
  displayName: string;
  appearance?: CharacterAppearance;
  levelId?: number;
}

export interface PlayerLeftPayload {
  userId: string;
  id?: string;
  username?: string;
  displayName?: string;
  reason?: 'leave' | 'disconnect';
}

/** Shared puzzle progress of the party on one level (orbs found, rocks moved). */
export interface WorldBlockPos {
  index: number;
  x: number;
  y: number;
  z: number;
}

export interface WorldStatePayload {
  levelId: number;
  orbs: number[];
  blocks: WorldBlockPos[];
  /** Boss fights: shared events so far (damage, heals…) */
  events?: WorldEventPayload[];
}

export interface WorldEventPayload {
  userId?: string;
  username?: string;
  levelId: number;
  kind: string;
  i?: number;
  v?: number;
  target?: string;
}

export interface WorldOrbPayload {
  userId: string;
  username: string;
  levelId: number;
  orbIndex: number;
}

export interface WorldBlockPayload {
  userId: string;
  levelId: number;
  blockIndex: number;
  x: number;
  y: number;
  z: number;
}

export interface SpectateActivePlayer {
  userId: string;
  id?: string;
  username: string;
  displayName?: string;
  name?: string;
  playerName?: string;
  position?: { x: number; y: number; z: number; yaw?: number };
}

export interface SpectateStartedPayload {
  isSpectating: boolean;
  targetUserId?: string;
  rank?: number;
  timeSeconds?: number;
  activePlayers?: SpectateActivePlayer[];
  message?: string;
}

export interface RoomPlayerFinishedPayload {
  userId: string;
  id?: string;
  username?: string;
  displayName?: string;
  name?: string;
  playerName?: string;
  timeSeconds?: number;
  /** Level rating (0-1000), stars (0-3) and deaths of that run */
  score?: number;
  stars?: number;
  deaths?: number;
  /** Did not reach the goal before the party timer ran out (passes with rating 0) */
  forfeited?: boolean;
  rank?: number;
  isSpectating?: boolean;
  allFinished?: boolean;
  finishedCount?: number;
  totalPlayers?: number;
  remainingPlayers?: Array<{ userId: string; displayName?: string; username?: string }>;
}

export interface RoomSummaryEntry {
  rank: number;
  userId: string;
  id?: string;
  username: string;
  displayName?: string;
  name?: string;
  playerName?: string;
  timeSeconds: number;
  score?: number;
  stars?: number;
  deaths?: number;
  forfeited?: boolean;
}

/** What a player still in the level sees (6 numbers per enemy), for friends spectating them */
export interface SpectateSnapPayload {
  userId: string;
  levelId: number;
  d: number[];
}

export interface RoomAllFinishedPayload {
  roomId: string;
  levelId: number;
  summary: RoomSummaryEntry[];
  canAdvance: boolean;
  nextLevelId: number;
  message?: string;
}

export interface RoomLevelChangedPayload {
  roomId: string;
  levelId: number;
  message?: string;
  players?: any[];
}

export interface SpectateSwitchedPayload {
  targetUserId: string;
}

class MultiplayerClient {
  private socket: Socket | null = null;
  private currentLevelId: number | null = null;
  private currentRoomId: string | null = null;
  private status: ConnectionStatus = 'disconnected';
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();

  private selfPlayer: { userId?: string; id?: string; username?: string; displayName?: string } | null = null;
  private lastYourSpawn: { x: number; y: number; z: number } | null = null;
  private partyPlayers: Map<string, RemotePlayer> = new Map();

  // Multi-listener sets to avoid callback clobbering across components
  private roomStateListeners: Set<(players: RemotePlayer[], raw: RoomStatePayload) => void> = new Set();
  private playerJoinedListeners: Set<(player: RemotePlayer) => void> = new Set();
  private playerMovedListeners: Set<(data: PlayerMovedPayload) => void> = new Set();
  private playerProfileListeners: Set<(data: PlayerProfilePayload) => void> = new Set();
  private playerLeftListeners: Set<(data: PlayerLeftPayload) => void> = new Set();
  private inviteReceivedListeners: Set<(data: InviteReceivedPayload) => void> = new Set();
  private inviteSentListeners: Set<(data: InviteSentPayload) => void> = new Set();
  private inviteResultListeners: Set<(data: InviteResultPayload) => void> = new Set();
  private socketErrorListeners: Set<(data: SocketErrorPayload) => void> = new Set();
  private companionPowerListeners: Set<(data: any) => void> = new Set();
  private worldStateListeners: Set<(data: WorldStatePayload) => void> = new Set();
  private worldOrbListeners: Set<(data: WorldOrbPayload) => void> = new Set();
  private worldBlockListeners: Set<(data: WorldBlockPayload) => void> = new Set();
  private worldEventListeners: Set<(data: WorldEventPayload) => void> = new Set();
  private spectateSnapListeners: Set<(data: SpectateSnapPayload) => void> = new Set();

  // Spectator and synchronized level progression listeners
  private spectateStartedListeners: Set<(data: SpectateStartedPayload) => void> = new Set();
  private playerFinishedNoticeListeners: Set<(data: RoomPlayerFinishedPayload) => void> = new Set();
  private roomAllFinishedListeners: Set<(data: RoomAllFinishedPayload) => void> = new Set();
  private roomLevelChangedListeners: Set<(data: RoomLevelChangedPayload) => void> = new Set();
  private spectateSwitchedListeners: Set<(data: SpectateSwitchedPayload) => void> = new Set();

  // Backward compatibility legacy properties
  public onRoomState?: (players: RemotePlayer[]) => void;
  public onPlayerJoined?: (player: RemotePlayer) => void;
  public onPlayerMoved?: (data: PlayerMovedPayload) => void;
  public onPlayerLeft?: (data: PlayerLeftPayload) => void;
  public onPlayerLeftNotice?: (data: PlayerLeftPayload) => void;
  public onInviteReceived?: (data: InviteReceivedPayload) => void;
  public onInviteSent?: (data: InviteSentPayload) => void;
  public onInviteResult?: (data: InviteResultPayload) => void;
  public onSocketError?: (data: SocketErrorPayload) => void;
  public onCompanionPower?: (data: any) => void;
  public onWorldState?: (data: WorldStatePayload) => void;
  public onWorldOrb?: (data: WorldOrbPayload) => void;
  public onWorldBlock?: (data: WorldBlockPayload) => void;
  public onWorldEvent?: (data: WorldEventPayload) => void;

  /** Latest known shared progress of the party, so it can be re-applied after a restart */
  private world: {
    levelId: number;
    orbs: Set<number>;
    blocks: Map<number, WorldBlockPos>;
    events: WorldEventPayload[];
  } | null = null;
  private lastBlockSend = new Map<number, number>();
  /** The character the player is wearing right now (sent when joining and when it changes) */
  private localLook: CharacterAppearance | null = null;
  private profileTimer: ReturnType<typeof setTimeout> | null = null;

  private lastSyncTime: number = 0;
  private syncThrottleMs: number = 33;

  private isPartyHost: boolean = false;

  constructor() {
    apiClient.onAuthChange((user) => {
      if (!user) {
        this.disconnect();
        this.currentLevelId = null;
        this.currentRoomId = null;
        this.partyPlayers.clear();
      } else {
        this.connect();
      }
    });
  }

  // --- Listener Registration Methods ---

  public addRoomStateListener(cb: (players: RemotePlayer[], raw: RoomStatePayload) => void): () => void {
    this.roomStateListeners.add(cb);
    return () => this.roomStateListeners.delete(cb);
  }

  public addPlayerProfileListener(cb: (data: PlayerProfilePayload) => void): () => void {
    this.playerProfileListeners.add(cb);
    return () => this.playerProfileListeners.delete(cb);
  }

  public addPlayerJoinedListener(cb: (player: RemotePlayer) => void): () => void {
    this.playerJoinedListeners.add(cb);
    return () => this.playerJoinedListeners.delete(cb);
  }

  public addPlayerMovedListener(cb: (data: PlayerMovedPayload) => void): () => void {
    this.playerMovedListeners.add(cb);
    return () => this.playerMovedListeners.delete(cb);
  }

  public addPlayerLeftListener(cb: (data: PlayerLeftPayload) => void): () => void {
    this.playerLeftListeners.add(cb);
    return () => this.playerLeftListeners.delete(cb);
  }

  public addInviteReceivedListener(cb: (data: InviteReceivedPayload) => void): () => void {
    this.inviteReceivedListeners.add(cb);
    return () => this.inviteReceivedListeners.delete(cb);
  }

  public addInviteSentListener(cb: (data: InviteSentPayload) => void): () => void {
    this.inviteSentListeners.add(cb);
    return () => this.inviteSentListeners.delete(cb);
  }

  public addInviteResultListener(cb: (data: InviteResultPayload) => void): () => void {
    this.inviteResultListeners.add(cb);
    return () => this.inviteResultListeners.delete(cb);
  }

  public addSocketErrorListener(cb: (data: SocketErrorPayload) => void): () => void {
    this.socketErrorListeners.add(cb);
    return () => this.socketErrorListeners.delete(cb);
  }

  public addWorldStateListener(cb: (data: WorldStatePayload) => void): () => void {
    this.worldStateListeners.add(cb);
    return () => this.worldStateListeners.delete(cb);
  }

  public addWorldOrbListener(cb: (data: WorldOrbPayload) => void): () => void {
    this.worldOrbListeners.add(cb);
    return () => this.worldOrbListeners.delete(cb);
  }

  public addWorldBlockListener(cb: (data: WorldBlockPayload) => void): () => void {
    this.worldBlockListeners.add(cb);
    return () => this.worldBlockListeners.delete(cb);
  }

  public addSpectateSnapListener(cb: (data: SpectateSnapPayload) => void): () => void {
    this.spectateSnapListeners.add(cb);
    return () => this.spectateSnapListeners.delete(cb);
  }

  /** Streams the enemies this player sees to the friends spectating (volatile: may be dropped) */
  public sendSpectateSnap(levelId: number, d: number[]): void {
    if (!this.socket?.connected || !this.isInPartyRoom()) return;
    this.socket.volatile.emit('spectate:snap', { levelId, d });
  }

  public addWorldEventListener(cb: (data: WorldEventPayload) => void): () => void {
    this.worldEventListeners.add(cb);
    return () => this.worldEventListeners.delete(cb);
  }

  public addSpectateStartedListener(cb: (data: SpectateStartedPayload) => void): () => void {
    this.spectateStartedListeners.add(cb);
    return () => this.spectateStartedListeners.delete(cb);
  }

  public addPlayerFinishedNoticeListener(cb: (data: RoomPlayerFinishedPayload) => void): () => void {
    this.playerFinishedNoticeListeners.add(cb);
    return () => this.playerFinishedNoticeListeners.delete(cb);
  }

  public addRoomAllFinishedListener(cb: (data: RoomAllFinishedPayload) => void): () => void {
    this.roomAllFinishedListeners.add(cb);
    return () => this.roomAllFinishedListeners.delete(cb);
  }

  public addRoomLevelChangedListener(cb: (data: RoomLevelChangedPayload) => void): () => void {
    this.roomLevelChangedListeners.add(cb);
    return () => this.roomLevelChangedListeners.delete(cb);
  }

  public addSpectateSwitchedListener(cb: (data: SpectateSwitchedPayload) => void): () => void {
    this.spectateSwitchedListeners.add(cb);
    return () => this.spectateSwitchedListeners.delete(cb);
  }

  // --- Getters & Status ---

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public getCurrentRoomId(): string | null {
    return this.currentRoomId;
  }

  public getSelf(): { userId?: string; id?: string; username?: string; displayName?: string } | null {
    return this.selfPlayer;
  }

  public getLastSpawn(): { x: number; y: number; z: number } | null {
    return this.lastYourSpawn;
  }

  public getPartyPlayers(): RemotePlayer[] {
    return Array.from(this.partyPlayers.values());
  }

  public getPartyPlayer(userId: string): RemotePlayer | undefined {
    if (!userId) return undefined;
    return (
      this.partyPlayers.get(userId) ||
      Array.from(this.partyPlayers.values()).find(
        (p) => p.userId === userId || p.id === userId || p.socketId === userId
      )
    );
  }

  public getPartyCount(): number {
    return Math.max(1, this.partyPlayers.size);
  }

  public isPartyHostRole(): boolean {
    return this.isPartyHost;
  }

  public setPartyHostRole(isHost: boolean): void {
    this.isPartyHost = isHost;
  }

  public onStatusChange(cb: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(cb);
    cb(this.status);
    return () => {
      this.statusListeners.delete(cb);
    };
  }

  private setStatus(status: ConnectionStatus) {
    this.status = status;
    for (const listener of this.statusListeners) {
      listener(status);
    }
  }

  // --- Connection ---

  public connect(): void {
    if (this.socket && this.socket.connected) return;

    const token = apiClient.getAccessToken();
    if (!token) return;

    const socketUrl = apiClient.getSocketUrl();
    this.setStatus('connecting');

    try {
      if (this.socket) {
        this.socket.removeAllListeners();
        this.socket.disconnect();
      }

      this.socket = io(socketUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
        timeout: 6000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1500,
      });

      this.setupListeners();
    } catch (e) {
      console.warn('Socket connection initialization error:', e);
      this.setStatus('error');
    }
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.partyPlayers.clear();
    this.setStatus('disconnected');
  }

  private setupListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.setStatus('connected');
      if (this.currentLevelId !== null && this.currentRoomId?.startsWith('party_')) {
        this.emitJoin(this.currentLevelId, this.currentRoomId);
      }
    });

    this.socket.on('disconnect', () => {
      this.setStatus('disconnected');
    });

    this.socket.on('connect_error', () => {
      this.setStatus('error');
    });

    // Backend Response: room:state
    this.socket.on('room:state', (raw: any) => {
      if (!raw) return;
      if (raw.roomId) this.currentRoomId = raw.roomId;
      if (raw.self) this.selfPlayer = raw.self;
      if (raw.yourSpawn && Number.isFinite(raw.yourSpawn.x) && Number.isFinite(raw.yourSpawn.y) && Number.isFinite(raw.yourSpawn.z)) {
        this.lastYourSpawn = { x: raw.yourSpawn.x, y: raw.yourSpawn.y, z: raw.yourSpawn.z };
      }

      const rawList = Array.isArray(raw.players) ? raw.players : [];
      const normalizedList: RemotePlayer[] = rawList.map(normalizeRemotePlayer);

      this.partyPlayers.clear();
      for (const p of normalizedList) {
        if (p.userId) {
          this.partyPlayers.set(p.userId, p);
        }
      }

      // Also ensure self is included in partyPlayers if provided
      if (raw.self) {
        const selfNorm = normalizeRemotePlayer(raw.self);
        if (selfNorm.userId && !this.partyPlayers.has(selfNorm.userId)) {
          this.partyPlayers.set(selfNorm.userId, selfNorm);
        }
      }

      const statePayload: RoomStatePayload = {
        levelId: raw.levelId ?? this.currentLevelId ?? 1,
        roomId: raw.roomId || this.currentRoomId,
        players: normalizedList,
        yourSpawn: this.lastYourSpawn || undefined,
        self: raw.self,
      };

      // Notify multi-listeners
      for (const listener of this.roomStateListeners) {
        try {
          listener(normalizedList, statePayload);
        } catch (e) {
          console.error('[MultiplayerClient] roomState listener error:', e);
        }
      }

      // Legacy callback
      if (this.onRoomState) {
        this.onRoomState(normalizedList);
      }
    });

    // Backend Response: player:joined
    this.socket.on('player:joined', (raw: any) => {
      if (!raw) return;
      const player = normalizeRemotePlayer(raw);
      if (player.userId) {
        this.partyPlayers.set(player.userId, player);
      }

      for (const listener of this.playerJoinedListeners) {
        try {
          listener(player);
        } catch (e) {
          console.error('[MultiplayerClient] playerJoined listener error:', e);
        }
      }

      if (this.onPlayerJoined) {
        this.onPlayerJoined(player);
      }
    });

    // Backend Response: player:moved
    this.socket.on('player:moved', (data: any) => {
      if (!data) return;
      const userId = getPlayerId(data);
      if (!userId) return;

      const payload: PlayerMovedPayload = {
        userId,
        levelId: Number.isFinite(data.levelId) ? data.levelId : undefined,
        x: Number.isFinite(data.x) ? data.x : Number(data.position?.x) || 0,
        y: Number.isFinite(data.y) ? data.y : Number(data.position?.y) || 0,
        z: Number.isFinite(data.z) ? data.z : Number(data.position?.z) || 0,
        yaw: Number.isFinite(data.yaw) ? data.yaw : Number(data.position?.yaw) || 0,
        anim: data.anim || 'idle',
        action: data.action,
      };

      // Update cached player
      const cached = this.partyPlayers.get(userId);
      if (cached) {
        if (payload.levelId !== undefined) cached.levelId = payload.levelId;
        cached.x = payload.x;
        cached.y = payload.y;
        cached.z = payload.z;
        cached.yaw = payload.yaw;
        cached.anim = payload.anim;
        cached.action = payload.action;
        cached.lastUpdate = performance.now();
      }

      for (const listener of this.playerMovedListeners) {
        try {
          listener(payload);
        } catch (e) {
          console.error('[MultiplayerClient] playerMoved listener error:', e);
        }
      }

      if (this.onPlayerMoved) {
        this.onPlayerMoved(payload);
      }
    });

    // Backend Response: player:profile (new look or name of a party member)
    this.socket.on('player:profile', (raw: any) => {
      if (!raw) return;
      const userId = getPlayerId(raw);
      if (!userId) return;
      const payload: PlayerProfilePayload = {
        userId,
        displayName: getPlayerDisplayName(raw),
        appearance: raw.appearance,
        levelId: Number.isFinite(raw.levelId) ? raw.levelId : undefined,
      };
      const cached = this.partyPlayers.get(userId);
      if (cached) {
        cached.displayName = payload.displayName;
        cached.name = payload.displayName;
        cached.playerName = payload.displayName;
        if (payload.appearance) cached.appearance = payload.appearance;
      }
      for (const listener of this.playerProfileListeners) {
        try {
          listener(payload);
        } catch (e) {
          console.error('[MultiplayerClient] playerProfile listener error:', e);
        }
      }
    });

    // Backend Response: player:left
    this.socket.on('player:left', (data: any) => {
      if (!data) return;
      const userId = typeof data === 'string' ? data : getPlayerId(data);
      if (!userId) return;

      const displayName = typeof data === 'object' ? getPlayerDisplayName(data) : undefined;
      const username = typeof data === 'object' ? data.username || displayName : undefined;
      const reason = typeof data === 'object' ? data.reason || 'leave' : 'leave';

      this.partyPlayers.delete(userId);

      const payload: PlayerLeftPayload = {
        userId,
        id: userId,
        username,
        displayName,
        reason,
      };

      for (const listener of this.playerLeftListeners) {
        try {
          listener(payload);
        } catch (e) {
          console.error('[MultiplayerClient] playerLeft listener error:', e);
        }
      }

      if (this.onPlayerLeft) {
        this.onPlayerLeft(payload);
      }
      if (this.onPlayerLeftNotice) {
        this.onPlayerLeftNotice(payload);
      }
    });

    // Companion power broadcast
    this.socket.on('companion:power:broadcast', (data: any) => {
      if (!data) return;
      for (const listener of this.companionPowerListeners) {
        try {
          listener(data);
        } catch (e) {
          console.error('[MultiplayerClient] companionPower listener error:', e);
        }
      }
      if (this.onCompanionPower) {
        this.onCompanionPower(data);
      }
    });

    // World state (puzzles, blocks, boss fights)
    this.socket.on('world:state', (data: WorldStatePayload) => {
      if (!data || typeof data.levelId !== 'number') return;
      this.world = {
        levelId: data.levelId,
        orbs: new Set(Array.isArray(data.orbs) ? data.orbs : []),
        blocks: new Map((Array.isArray(data.blocks) ? data.blocks : []).map((b) => [b.index, b])),
        events: Array.isArray(data.events) ? data.events.slice(-400) : [],
      };
      for (const listener of this.worldStateListeners) {
        try {
          listener(data);
        } catch (e) {
          console.error('[MultiplayerClient] worldState listener error:', e);
        }
      }
      this.onWorldState?.(data);
    });

    this.socket.on('spectate:snap', (data: SpectateSnapPayload) => {
      if (!data || typeof data.userId !== 'string' || !Array.isArray(data.d)) return;
      for (const listener of this.spectateSnapListeners) {
        try {
          listener(data);
        } catch (e) {
          console.error('[MultiplayerClient] spectateSnap listener error:', e);
        }
      }
    });

    this.socket.on('world:event', (data: WorldEventPayload) => {
      if (!data || typeof data.kind !== 'string' || typeof data.levelId !== 'number') return;
      this.remember(this.rememberWorld(data.levelId), data);
      for (const listener of this.worldEventListeners) {
        try {
          listener(data);
        } catch (e) {
          console.error('[MultiplayerClient] worldEvent listener error:', e);
        }
      }
      this.onWorldEvent?.(data);
    });

    this.socket.on('world:orb', (data: WorldOrbPayload) => {
      if (!data || typeof data.orbIndex !== 'number') return;
      this.rememberWorld(data.levelId).orbs.add(data.orbIndex);
      for (const listener of this.worldOrbListeners) {
        try {
          listener(data);
        } catch (e) {
          console.error('[MultiplayerClient] worldOrb listener error:', e);
        }
      }
      this.onWorldOrb?.(data);
    });

    this.socket.on('world:block', (data: WorldBlockPayload) => {
      if (!data || typeof data.blockIndex !== 'number') return;
      this.rememberWorld(data.levelId).blocks.set(data.blockIndex, {
        index: data.blockIndex,
        x: data.x,
        y: data.y,
        z: data.z,
      });
      for (const listener of this.worldBlockListeners) {
        try {
          listener(data);
        } catch (e) {
          console.error('[MultiplayerClient] worldBlock listener error:', e);
        }
      }
      this.onWorldBlock?.(data);
    });

    // Invites
    this.socket.on('invite:received', (data: InviteReceivedPayload) => {
      if (!data?.inviteId) return;
      for (const listener of this.inviteReceivedListeners) {
        try {
          listener(data);
        } catch (e) {
          console.error('[MultiplayerClient] inviteReceived listener error:', e);
        }
      }
      if (this.onInviteReceived) {
        this.onInviteReceived(data);
      }
    });

    this.socket.on('invite:sent', (data: InviteSentPayload) => {
      if (!data?.inviteId) return;
      for (const listener of this.inviteSentListeners) {
        try {
          listener(data);
        } catch (e) {
          console.error('[MultiplayerClient] inviteSent listener error:', e);
        }
      }
      if (this.onInviteSent) {
        this.onInviteSent(data);
      }
    });

    this.socket.on('invite:result', (data: InviteResultPayload) => {
      if (!data?.inviteId) return;
      for (const listener of this.inviteResultListeners) {
        try {
          listener(data);
        } catch (e) {
          console.error('[MultiplayerClient] inviteResult listener error:', e);
        }
      }
      if (this.onInviteResult) {
        this.onInviteResult(data);
      }
    });

    this.socket.on('error', (data: SocketErrorPayload) => {
      if (!data) return;
      for (const listener of this.socketErrorListeners) {
        try {
          listener(data);
        } catch (e) {
          console.error('[MultiplayerClient] socketError listener error:', e);
        }
      }
      if (this.onSocketError) {
        this.onSocketError(data);
      }
    });

    // --- Spectator & Room Synchronized Progression (Spec sections 3 & 4) ---

    this.socket.on('spectate:started', (data: SpectateStartedPayload) => {
      if (!data) return;
      for (const listener of this.spectateStartedListeners) {
        try {
          listener(data);
        } catch (e) {
          console.error('[MultiplayerClient] spectateStarted listener error:', e);
        }
      }
    });

    this.socket.on('room:player_finished', (data: RoomPlayerFinishedPayload) => {
      if (!data) return;
      for (const listener of this.playerFinishedNoticeListeners) {
        try {
          listener(data);
        } catch (e) {
          console.error('[MultiplayerClient] playerFinishedNotice listener error:', e);
        }
      }
    });

    this.socket.on('spectate:switched', (data: SpectateSwitchedPayload) => {
      if (!data) return;
      for (const listener of this.spectateSwitchedListeners) {
        try {
          listener(data);
        } catch (e) {
          console.error('[MultiplayerClient] spectateSwitched listener error:', e);
        }
      }
    });

    this.socket.on('room:all_finished', (data: RoomAllFinishedPayload) => {
      if (!data) return;
      for (const listener of this.roomAllFinishedListeners) {
        try {
          listener(data);
        } catch (e) {
          console.error('[MultiplayerClient] roomAllFinished listener error:', e);
        }
      }
    });

    this.socket.on('room:level_changed', (data: RoomLevelChangedPayload) => {
      if (!data || typeof data.levelId !== 'number') return;
      this.currentLevelId = data.levelId;
      if (data.roomId) this.currentRoomId = data.roomId;
      for (const listener of this.roomLevelChangedListeners) {
        try {
          listener(data);
        } catch (e) {
          console.error('[MultiplayerClient] roomLevelChanged listener error:', e);
        }
      }
    });
  }

  private emitJoin(levelId: number, roomId: string) {
    if (!this.socket || !this.socket.connected) return;
    // The character as it is right now, name included, so the party sees it as you made it
    const appearance = this.localLook || loadAppearance();
    this.socket.emit('room:join', {
      levelId,
      roomId,
      appearance,
      name: appearance?.name,
    });
  }

  /**
   * The player changed their character (Personalizar). Remembered for the next join and, while
   * in a party room, sent to the others (grouped: the creator changes it on every click).
   */
  public setLocalLook(appearance: CharacterAppearance): void {
    this.localLook = { ...appearance };
    if (!this.isInPartyRoom()) return;
    // Our own entry in the room list shows the new name right away
    const selfId = this.selfPlayer?.userId || this.selfPlayer?.id;
    const me = selfId ? this.partyPlayers.get(selfId) : undefined;
    const typed = (appearance.name || '').trim();
    if (me && typed && !/^(viajer[oa]|explorador[a]?)$/i.test(typed)) {
      me.displayName = typed;
      me.name = typed;
      me.playerName = typed;
    }
    if (this.profileTimer) clearTimeout(this.profileTimer);
    this.profileTimer = setTimeout(() => {
      this.profileTimer = null;
      if (!this.socket?.connected || !this.isInPartyRoom() || !this.localLook) return;
      this.socket.emit('player:profile', { appearance: this.localLook, name: this.localLook.name });
    }, 400);
  }

  /**
   * Client -> Server: room:join
   * Joins a private party room (`party_*`).
   */
  public joinLevel(levelId: number, roomId?: string | null): void {
    this.currentLevelId = levelId;
    if (!roomId || !roomId.startsWith('party_')) {
      this.leaveRoom();
      return;
    }
    this.currentRoomId = roomId;
    if (!this.socket || !this.socket.connected) {
      this.connect();
      return;
    }
    this.emitJoin(levelId, roomId);
  }

  private rememberWorld(levelId: number) {
    if (!this.world || this.world.levelId !== levelId) {
      this.world = { levelId, orbs: new Set(), blocks: new Map(), events: [] };
    }
    return this.world;
  }

  public getWorldState(levelId: number): WorldStatePayload | null {
    if (!this.isInPartyRoom() || !this.world || this.world.levelId !== levelId) return null;
    return {
      levelId,
      orbs: [...this.world.orbs],
      blocks: [...this.world.blocks.values()],
      events: [...this.world.events],
    };
  }

  private remember(world: { events: WorldEventPayload[] }, e: WorldEventPayload) {
    world.events.push(e);
    if (world.events.length > 400) world.events.splice(0, world.events.length - 400);
  }

  public sendEvent(levelId: number, kind: string, i?: number, v?: number, target?: string): void {
    if (!this.socket?.connected || !this.isInPartyRoom()) return;
    const e: WorldEventPayload = { levelId, kind };
    if (typeof i === 'number' && Number.isFinite(i)) e.i = Math.round(i);
    if (typeof v === 'number' && Number.isFinite(v)) e.v = +v.toFixed(3);
    if (typeof target === 'string') e.target = target;
    this.remember(this.rememberWorld(levelId), e);
    this.socket.emit('world:event', e);
  }

  public sendOrb(levelId: number, orbIndex: number): void {
    if (!this.socket?.connected || !this.isInPartyRoom()) return;
    this.rememberWorld(levelId).orbs.add(orbIndex);
    this.socket.emit('world:orb', { levelId, orbIndex });
  }

  public sendBlock(levelId: number, blockIndex: number, x: number, y: number, z: number, final = false): void {
    if (!this.socket?.connected || !this.isInPartyRoom()) return;
    const now = performance.now();
    if (!final && now - (this.lastBlockSend.get(blockIndex) ?? 0) < 50) return;
    this.lastBlockSend.set(blockIndex, now);
    const pos = { index: blockIndex, x: Number(x.toFixed(3)), y: Number(y.toFixed(3)), z: Number(z.toFixed(3)) };
    this.rememberWorld(levelId).blocks.set(blockIndex, pos);
    this.socket.emit('world:block', { levelId, blockIndex, x: pos.x, y: pos.y, z: pos.z });
  }

  public leaveRoom(): void {
    this.world = null;
    this.currentRoomId = null;
    this.isPartyHost = false;
    this.partyPlayers.clear();
    this.lastYourSpawn = null;
    if (this.socket?.connected) {
      this.socket.emit('room:leave');
    }
  }

  public clearPartyRoom(): void {
    this.leaveRoom();
  }

  public isInPartyRoom(): boolean {
    return Boolean(this.currentRoomId?.startsWith('party_'));
  }

  public setPartyRoomId(roomId: string | null): void {
    this.currentRoomId = roomId;
  }

  /**
   * Invites a friend to play. If already in a party room, invites them directly to that room
   * so up to 10 players can easily gather.
   */
  public sendInvite(toUserId: string, levelId: number, roomId?: string | null): void {
    if (!this.socket || !this.socket.connected) {
      this.connect();
    }
    const targetRoom = roomId || this.currentRoomId || undefined;
    if (!this.currentRoomId) {
      this.isPartyHost = true;
    }
    this.socket?.emit('invite:send', {
      toUserId,
      levelId,
      ...(targetRoom ? { roomId: targetRoom } : {}),
    });
  }

  public respondInvite(inviteId: string, accept: boolean, reason?: 'declined' | 'expired' | string): void {
    if (!this.socket || !this.socket.connected) {
      this.connect();
    }
    if (accept) {
      this.isPartyHost = false;
    }
    this.socket?.emit('invite:respond', { inviteId, accept, reason });
  }

  private lastSyncPos = { x: 0, y: 0, z: 0, yaw: 0, anim: 'idle' };

  public syncPlayer(
    x: number,
    y: number,
    z: number,
    yaw: number,
    anim: 'idle' | 'walk' | 'run' | 'jump' | 'fall',
    action?: string
  ): void {
    if (!this.socket || !this.socket.connected) return;
    if (!this.currentRoomId?.startsWith('party_')) return;

    const now = performance.now();
    const dt = now - this.lastSyncTime;
    if (dt < 48) return; // ~20 Hz standard multiplayer platformer cadence

    const dx = Math.abs(x - this.lastSyncPos.x);
    const dy = Math.abs(y - this.lastSyncPos.y);
    const dz = Math.abs(z - this.lastSyncPos.z);
    const dyaw = Math.abs(yaw - this.lastSyncPos.yaw);
    const isStationary =
      dx < 0.015 &&
      dy < 0.015 &&
      dz < 0.015 &&
      dyaw < 0.02 &&
      anim === this.lastSyncPos.anim &&
      !action;

    // When standing still, only send a heartbeat sync every 280ms
    if (isStationary && dt < 280) return;

    this.lastSyncTime = now;
    this.lastSyncPos.x = x;
    this.lastSyncPos.y = y;
    this.lastSyncPos.z = z;
    this.lastSyncPos.yaw = yaw;
    this.lastSyncPos.anim = anim;

    this.socket.emit('player:sync', {
      x: Number(x.toFixed(3)),
      y: Number(y.toFixed(3)),
      z: Number(z.toFixed(3)),
      yaw: Number(yaw.toFixed(3)),
      anim,
      action,
    });
  }

  public triggerCompanionPower(powerType: string): void {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('companion:power', { powerType });
  }

  // --- Spectator & Room Sync Emitters (Spec 3 & 4) ---

  /** Client notifies server that player finished the level */
  public emitPlayerFinish(
    levelId: number,
    timeSeconds: number,
    relicsFound: number = 0,
    rating?: { score: number; stars: number; deaths: number; forfeited?: boolean }
  ): void {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('room:player_finish', {
      levelId,
      timeSeconds: Number(timeSeconds.toFixed(2)),
      relicsFound,
      ...(rating
        ? { score: rating.score, stars: rating.stars, deaths: rating.deaths, forfeited: Boolean(rating.forfeited) }
        : {}),
    });
  }

  /** Spectator switches camera focus to another active player */
  public emitSpectateSwitch(targetUserId: string): void {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('spectate:switch', { targetUserId });
  }

  /** Requests all room members to advance together to the next level */
  public emitAdvanceLevel(): void {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('room:advance_level');
  }

  /** Requests room level change to a specific level (1-10) */
  public emitLevelChange(levelId: number): void {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('room:level_change', { levelId });
  }
}

export const multiplayerClient = new MultiplayerClient();
