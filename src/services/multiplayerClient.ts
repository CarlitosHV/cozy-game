/**
 * Socket.io Multiplayer Client for Cozy Leap Online
 * Spec sections 4–6: rooms, presence, party invites.
 */

import { io, Socket } from 'socket.io-client';
import { apiClient } from './apiClient';
import { CharacterAppearance } from '../game/character';

export interface RemotePlayer {
  userId: string;
  username: string;
  appearance?: CharacterAppearance;
  x: number;
  y: number;
  z: number;
  yaw: number;
  anim: 'idle' | 'walk' | 'run' | 'jump' | 'fall';
  action?: string;
  lastUpdate: number;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface InviteReceivedPayload {
  inviteId: string;
  fromUserId: string;
  fromUsername: string;
  levelId: number;
  expiresInSeconds: number;
}

export interface InviteSentPayload {
  inviteId: string;
  toUserId: string;
  levelId: number;
  expiresInSeconds: number;
}

export interface InviteResultPayload {
  inviteId: string;
  accepted: boolean;
  roomId?: string;
  levelId: number;
}

export interface SocketErrorPayload {
  code?: string;
  message: string;
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
/** Boss fights: something that happened to the shared boss/arena (damage, nets, candelabra…) */
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

class MultiplayerClient {
  private socket: Socket | null = null;
  private currentLevelId: number | null = null;
  private currentRoomId: string | null = null;
  private status: ConnectionStatus = 'disconnected';
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();

  public onRoomState?: (players: RemotePlayer[]) => void;
  public onPlayerJoined?: (player: RemotePlayer) => void;
  public onPlayerMoved?: (update: {
    userId: string;
    x: number;
    y: number;
    z: number;
    yaw: number;
    anim: 'idle' | 'walk' | 'run' | 'jump' | 'fall';
    action?: string;
  }) => void;
  public onPlayerLeft?: (data: {
    userId: string;
    username?: string;
    displayName?: string;
    reason?: 'leave' | 'disconnect';
  }) => void;
  public onPlayerLeftNotice?: (data: {
    userId: string;
    username?: string;
    displayName?: string;
    reason?: 'leave' | 'disconnect';
  }) => void;
  public onCompanionPower?: (data: {
    userId: string;
    username: string;
    powerType: string;
    position?: { x: number; y: number; z: number };
    timestamp?: string;
  }) => void;
  public onInviteReceived?: (data: InviteReceivedPayload) => void;
  public onInviteSent?: (data: InviteSentPayload) => void;
  public onInviteResult?: (data: InviteResultPayload) => void;
  public onSocketError?: (data: SocketErrorPayload) => void;
  /** Shared puzzle progress (see GameEngine): full state when joining, then live changes */
  public onWorldState?: (data: WorldStatePayload) => void;
  public onWorldOrb?: (data: WorldOrbPayload) => void;
  public onWorldBlock?: (data: WorldBlockPayload) => void;
  public onWorldEvent?: (data: WorldEventPayload) => void;

  /** Latest known shared progress of the party, so it can be re-applied after a restart */
  private world: { levelId: number; orbs: Set<number>; blocks: Map<number, WorldBlockPos>; events: WorldEventPayload[] } | null = null;
  private lastBlockSend = new Map<number, number>();

  private lastSyncTime: number = 0;
  private syncThrottleMs: number = 40;

  constructor() {
    apiClient.onAuthChange((user) => {
      if (!user) {
        this.disconnect();
        this.currentLevelId = null;
        this.currentRoomId = null;
      } else {
        this.connect();
      }
    });
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public getCurrentRoomId(): string | null {
    return this.currentRoomId;
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

    this.socket.on('room:state', (data: {
      levelId: number;
      roomId?: string | null;
      players: RemotePlayer[];
      yourSpawn?: unknown;
    }) => {
      if (data?.roomId) this.currentRoomId = data.roomId;
      if (this.onRoomState && Array.isArray(data?.players)) {
        this.onRoomState(data.players);
      }
    });

    this.socket.on('player:joined', (player: RemotePlayer) => {
      if (this.onPlayerJoined && player) {
        this.onPlayerJoined(player);
      }
    });

    this.socket.on('player:moved', (data: {
      userId: string;
      x: number;
      y: number;
      z: number;
      yaw: number;
      anim: 'idle' | 'walk' | 'run' | 'jump' | 'fall';
      action?: string;
    }) => {
      if (this.onPlayerMoved && data?.userId) {
        this.onPlayerMoved(data);
      }
    });

    this.socket.on('player:left', (data: {
      userId: string;
      username?: string;
      displayName?: string;
      reason?: 'leave' | 'disconnect';
    } | string) => {
      const payload =
        typeof data === 'string'
          ? { userId: data, reason: 'leave' as const }
          : data?.userId
            ? data
            : null;
      if (!payload) return;
      this.onPlayerLeft?.(payload);
      this.onPlayerLeftNotice?.(payload);
    });

    this.socket.on('companion:power:broadcast', (data: {
      userId: string;
      username: string;
      powerType: string;
      position?: { x: number; y: number; z: number };
      timestamp?: string;
    }) => {
      if (this.onCompanionPower && data) {
        this.onCompanionPower(data);
      }
    });

    this.socket.on('world:state', (data: WorldStatePayload) => {
      if (!data || typeof data.levelId !== 'number') return;
      this.world = {
        levelId: data.levelId,
        orbs: new Set(Array.isArray(data.orbs) ? data.orbs : []),
        blocks: new Map((Array.isArray(data.blocks) ? data.blocks : []).map((b) => [b.index, b])),
        events: Array.isArray(data.events) ? data.events.slice(-400) : [],
      };
      this.onWorldState?.(data);
    });

    this.socket.on('world:event', (data: WorldEventPayload) => {
      if (!data || typeof data.kind !== 'string' || typeof data.levelId !== 'number') return;
      this.remember(this.rememberWorld(data.levelId), data);
      this.onWorldEvent?.(data);
    });

    this.socket.on('world:orb', (data: WorldOrbPayload) => {
      if (!data || typeof data.orbIndex !== 'number') return;
      this.rememberWorld(data.levelId).orbs.add(data.orbIndex);
      this.onWorldOrb?.(data);
    });

    this.socket.on('world:block', (data: WorldBlockPayload) => {
      if (!data || typeof data.blockIndex !== 'number') return;
      this.rememberWorld(data.levelId).blocks.set(data.blockIndex, { index: data.blockIndex, x: data.x, y: data.y, z: data.z });
      this.onWorldBlock?.(data);
    });

    this.socket.on('invite:received', (data: InviteReceivedPayload) => {
      if (this.onInviteReceived && data?.inviteId) {
        this.onInviteReceived(data);
      }
    });

    this.socket.on('invite:sent', (data: InviteSentPayload) => {
      if (this.onInviteSent && data?.inviteId) {
        this.onInviteSent(data);
      }
    });

    this.socket.on('invite:result', (data: InviteResultPayload) => {
      if (this.onInviteResult && data?.inviteId) {
        this.onInviteResult(data);
      }
    });

    this.socket.on('error', (data: SocketErrorPayload) => {
      if (this.onSocketError && data) {
        this.onSocketError(data);
      }
    });
  }

  private emitJoin(levelId: number, roomId: string) {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('room:join', { levelId, roomId });
  }

  /**
   * Client -> Server: room:join
   * Only private party rooms (`party_*`) are allowed. Without roomId, leaves any room.
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
    if (!this.world || this.world.levelId !== levelId) this.world = { levelId, orbs: new Set(), blocks: new Map(), events: [] };
    return this.world;
  }

  /** Shared progress known for a level while in a party (null when there is none). */
  public getWorldState(levelId: number): WorldStatePayload | null {
    if (!this.isInPartyRoom() || !this.world || this.world.levelId !== levelId) return null;
    return { levelId, orbs: [...this.world.orbs], blocks: [...this.world.blocks.values()], events: [...this.world.events] };
  }

  private remember(world: { events: WorldEventPayload[] }, e: WorldEventPayload) {
    world.events.push(e);
    if (world.events.length > 400) world.events.splice(0, world.events.length - 400);
  }

  /** Client -> Server: world:event — boss fight events shared with the party */
  public sendEvent(levelId: number, kind: string, i?: number, v?: number, target?: string): void {
    if (!this.socket?.connected || !this.isInPartyRoom()) return;
    const e: WorldEventPayload = { levelId, kind };
    if (typeof i === 'number' && Number.isFinite(i)) e.i = Math.round(i);
    if (typeof v === 'number' && Number.isFinite(v)) e.v = +v.toFixed(3);
    if (typeof target === 'string') e.target = target;
    this.remember(this.rememberWorld(levelId), e);
    this.socket.emit('world:event', e);
  }

  /** Client -> Server: world:orb — this player found an orb */
  public sendOrb(levelId: number, orbIndex: number): void {
    if (!this.socket?.connected || !this.isInPartyRoom()) return;
    this.rememberWorld(levelId).orbs.add(orbIndex);
    this.socket.emit('world:orb', { levelId, orbIndex });
  }

  /** Client -> Server: world:block — this player is moving a rock (throttled unless `final`) */
  public sendBlock(levelId: number, blockIndex: number, x: number, y: number, z: number, final = false): void {
    if (!this.socket?.connected || !this.isInPartyRoom()) return;
    const now = performance.now();
    if (!final && now - (this.lastBlockSend.get(blockIndex) ?? 0) < 60) return;
    this.lastBlockSend.set(blockIndex, now);
    const pos = { index: blockIndex, x: Number(x.toFixed(3)), y: Number(y.toFixed(3)), z: Number(z.toFixed(3)) };
    this.rememberWorld(levelId).blocks.set(blockIndex, pos);
    this.socket.emit('world:block', { levelId, blockIndex, x: pos.x, y: pos.y, z: pos.z });
  }

  public leaveRoom(): void {
    this.world = null;
    this.currentRoomId = null;
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

  private isPartyHost: boolean = false;

  public isPartyHostRole(): boolean {
    return this.isPartyHost;
  }

  public setPartyHostRole(isHost: boolean): void {
    this.isPartyHost = isHost;
  }

  public sendInvite(toUserId: string, levelId: number): void {
    if (!this.socket || !this.socket.connected) {
      this.connect();
    }
    this.isPartyHost = true;
    this.socket?.emit('invite:send', { toUserId, levelId });
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
    if (now - this.lastSyncTime < this.syncThrottleMs) return;
    this.lastSyncTime = now;

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
}

export const multiplayerClient = new MultiplayerClient();
