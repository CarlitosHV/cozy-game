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

  public leaveRoom(): void {
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

  public sendInvite(toUserId: string, levelId: number): void {
    if (!this.socket || !this.socket.connected) {
      this.connect();
    }
    this.socket?.emit('invite:send', { toUserId, levelId });
  }

  public respondInvite(inviteId: string, accept: boolean): void {
    if (!this.socket || !this.socket.connected) {
      this.connect();
    }
    this.socket?.emit('invite:respond', { inviteId, accept });
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
