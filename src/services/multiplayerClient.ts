/**
 * Socket.io Multiplayer Client for Cozy Leap Online
 * Adheres strictly to Specification 5 in API_ENDPOINTS_b196a80b.md:
 *  - Handshake: auth: { token: accessToken }
 *  - Client -> Server: room:join, player:sync (20-30Hz), companion:power
 *  - Server -> Client: room:state, player:joined, player:moved, player:left, companion:power:broadcast
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

class MultiplayerClient {
  private socket: Socket | null = null;
  private currentLevelId: number | null = null;
  private status: ConnectionStatus = 'disconnected';
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();

  // Callbacks for 3D engine
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
  public onPlayerLeft?: (userId: string) => void;
  public onCompanionPower?: (data: {
    userId: string;
    username: string;
    powerType: string;
    position?: { x: number; y: number; z: number };
    timestamp?: string;
  }) => void;

  // Throttle timer for 25Hz broadcast (every 40ms)
  private lastSyncTime: number = 0;
  private syncThrottleMs: number = 40;

  constructor() {
    // Listen to auth changes
    apiClient.onAuthChange((user) => {
      if (!user) {
        this.disconnect();
      } else if (this.currentLevelId !== null) {
        this.connect();
      }
    });
  }

  public getStatus(): ConnectionStatus {
    return this.status;
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
    const socketUrl = apiClient.getSocketUrl();

    this.setStatus('connecting');

    try {
      this.socket = io(socketUrl, {
        auth: { token: token || '' },
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
      this.socket.disconnect();
      this.socket = null;
    }
    this.setStatus('disconnected');
  }

  private setupListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.setStatus('connected');
      // If we already know what level we're in, rejoin room immediately
      if (this.currentLevelId !== null) {
        this.joinLevel(this.currentLevelId);
      }
    });

    this.socket.on('disconnect', () => {
      this.setStatus('disconnected');
    });

    this.socket.on('connect_error', () => {
      this.setStatus('error');
    });

    // Specification 5 Events:
    this.socket.on('room:state', (data: { levelId: number; players: RemotePlayer[]; yourSpawn?: unknown }) => {
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

    this.socket.on('player:left', (data: { userId: string } | string) => {
      const id = typeof data === 'string' ? data : data?.userId;
      if (this.onPlayerLeft && id) {
        this.onPlayerLeft(id);
      }
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
  }

  /**
   * Client -> Server: room:join
   */
  public joinLevel(levelId: number): void {
    this.currentLevelId = levelId;
    if (!this.socket || !this.socket.connected) {
      this.connect();
      return;
    }
    this.socket.emit('room:join', { levelId });
  }

  /**
   * Client -> Server: player:sync (Throttled at 20-30Hz)
   */
  public syncPlayer(
    x: number,
    y: number,
    z: number,
    yaw: number,
    anim: 'idle' | 'walk' | 'run' | 'jump' | 'fall',
    action?: string
  ): void {
    if (!this.socket || !this.socket.connected) return;

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

  /**
   * Client -> Server: companion:power
   */
  public triggerCompanionPower(powerType: string): void {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('companion:power', { powerType });
  }
}

export const multiplayerClient = new MultiplayerClient();
