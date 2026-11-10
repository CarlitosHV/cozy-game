/**
 * RemotePlayersManager
 * Manages 3D avatars for other online players in the Three.js scene.
 * Receives multiplayerClient events, instantiates PlayerCharacterModel with lightweight remote optimizations,
 * manages billboard name tags with texture caching, and applies smooth linear (lerp) & angular interpolation.
 */

import * as THREE from 'three';
import { ProceduralTextures } from './textures';
import { sanitizeAppearance } from './character';
import { createPlayerCharacter, disposePlayerCharacter, PlayerCharacterModel } from './models';
import {
  multiplayerClient,
  RemotePlayer,
  normalizeRemotePlayer,
  getPlayerDisplayName,
  getPlayerId,
} from '../services/multiplayerClient';
import { apiClient } from '../services/apiClient';
import { createBoneCage } from './bossModels';
import type { CharacterAppearance } from './character';
import { makeLabel } from './combatFx';

interface RemotePlayerEntity {
  userId: string;
  username: string;
  appearanceKey: string;
  model: PlayerCharacterModel;
  nameTag: THREE.Sprite;
  currentPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  currentYaw: number;
  targetYaw: number;
  anim: 'idle' | 'walk' | 'run' | 'jump' | 'fall';
  lastSeen: number;
  /** Boss fights: caught by a dancing skeleton (shows a bone cage + "¡Ayuda!") */
  grabbed: boolean;
  cage?: THREE.Group;
  /** Boss fights: fainted, lying on the floor waiting for CPR */
  down: boolean;
  downLabel?: THREE.Sprite;
  /** Where and when they fell: if they walk away (the "get up" message got lost) they're up again */
  downPos?: THREE.Vector3;
  downAt?: number;
}

// Texture cache for billboard name tags to avoid per-player canvas redrawing
const nameTagTextureCache = new Map<string, { texture: THREE.CanvasTexture; aspect: number }>();

function getNameTagTexture(label: string): { texture: THREE.CanvasTexture; aspect: number } {
  const cached = nameTagTextureCache.get(label);
  if (cached) return cached;

  const trimmed = label.length > 18 ? `${label.slice(0, 17)}…` : label;
  const padX = 26;
  const canvas = document.createElement('canvas');
  const measure = canvas.getContext('2d');
  const font = 'bold 30px "Outfit", "Nunito", system-ui, sans-serif';
  let textW = 120;
  if (measure) {
    measure.font = font;
    textW = Math.ceil(measure.measureText(trimmed).width);
  }

  const dotR = 6;
  const gap = 12;
  const contentW = dotR * 2 + gap + textW;
  const w = Math.min(384, Math.max(160, contentW + padX * 2));
  const h = 56;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.clearRect(0, 0, w, h);

    const x = 4;
    const y = 4;
    const bw = w - 8;
    const bh = h - 8;
    const r = bh / 2;

    ctx.shadowColor = 'rgba(20, 28, 35, 0.35)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + bw, y, x + bw, y + bh, r);
    ctx.arcTo(x + bw, y + bh, x, y + bh, r);
    ctx.arcTo(x, y + bh, x, y, r);
    ctx.arcTo(x, y, x + bw, y, r);
    ctx.closePath();

    const fill = ctx.createLinearGradient(0, y, 0, y + bh);
    fill.addColorStop(0, 'rgba(255, 252, 246, 0.96)');
    fill.addColorStop(1, 'rgba(250, 238, 220, 0.94)');
    ctx.fillStyle = fill;
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = 'rgba(195, 165, 130, 0.85)';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    const cx = x + padX * 0.5 + dotR;
    const cy = y + bh / 2;
    ctx.fillStyle = '#10b981'; // vibrant online green dot
    ctx.beginPath();
    ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(cx - 1.5, cy - 1.5, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#2d3748';
    ctx.font = font;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(trimmed, cx + dotR + gap, cy + 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const entry = { texture, aspect: w / h };
  nameTagTextureCache.set(label, entry);
  return entry;
}

export function createNameTagSprite(username: string): THREE.Sprite {
  const label = (username || 'Explorador').trim() || 'Explorador';
  const { texture, aspect } = getNameTagTexture(label);

  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    sizeAttenuation: true,
  });

  const sprite = new THREE.Sprite(mat);
  const worldH = 0.22;
  const worldW = worldH * aspect;
  sprite.scale.set(worldW, worldH, 1);
  sprite.position.set(0, 1.55, 0); // Position comfortably above head and hats
  sprite.renderOrder = 10;
  return sprite;
}

export class RemotePlayersManager {
  private scene: THREE.Scene;
  private textures: ProceduralTextures;
  private players: Map<string, RemotePlayerEntity> = new Map();
  private windTime: number = 0;
  private unsubs: Array<() => void> = [];

  /** Level the local player is on (players of the room who are elsewhere are hidden) */
  private levelGetter: (() => number) | null = null;

  constructor(scene: THREE.Scene, textures: ProceduralTextures) {
    this.scene = scene;
    this.textures = textures;
    this.setupNetworkCallbacks();
  }

  public setLevelGetter(fn: () => number) {
    this.levelGetter = fn;
  }

  /** False when we know the player is on another level than ours. */
  private onMyLevel(levelId: unknown): boolean {
    if (!this.levelGetter || typeof levelId !== 'number' || !Number.isFinite(levelId)) return true;
    return levelId === this.levelGetter();
  }

  private isLocalPlayer(player: { userId?: string; id?: string; username?: string }): boolean {
    const self = multiplayerClient.getSelf();
    const selfId = self?.userId || self?.id;
    const pId = player.userId || player.id;

    if (selfId && pId && selfId === pId) return true;

    const me = apiClient.getCurrentUser();
    if (me && pId && (pId === me._id || (me as unknown as { id?: string }).id === pId)) return true;

    // If both sides have IDs and they are different, it is NEVER local player
    if (pId && selfId && pId !== selfId) {
      return false;
    }

    // Only compare usernames if they are non-default and non-empty
    if (self?.username && player.username) {
      const u1 = self.username.trim().toLowerCase();
      const u2 = player.username.trim().toLowerCase();
      if (u1 && u2 && u1 !== 'explorador' && u1 !== 'viajero' && u1 !== 'viajera' && u1 === u2) {
        return true;
      }
    }

    if (me?.username && player.username) {
      const u1 = me.username.trim().toLowerCase();
      const u2 = player.username.trim().toLowerCase();
      if (u1 && u2 && u1 !== 'explorador' && u1 !== 'viajero' && u1 !== 'viajera' && u1 === u2) {
        return true;
      }
    }

    return false;
  }

  private setupNetworkCallbacks() {
    this.unsubs.push(
      multiplayerClient.addRoomStateListener((players) => {
        const seenIds = new Set<string>();

        for (const raw of players) {
          const p = normalizeRemotePlayer(raw);
          if (this.isLocalPlayer(p)) continue;
          const id = p.userId || p.id;
          if (!id || !this.onMyLevel(p.levelId)) continue;
          seenIds.add(id);
          this.addOrUpdatePlayer(p);
        }

        for (const [id] of this.players) {
          if (!seenIds.has(id)) {
            this.removePlayer(id);
          }
        }
      })
    );

    this.unsubs.push(
      multiplayerClient.addPlayerJoinedListener((raw) => {
        const p = normalizeRemotePlayer(raw);
        if (this.isLocalPlayer(p)) return;
        const id = p.userId || p.id;
        if (!id || !this.onMyLevel(p.levelId)) return;
        this.addOrUpdatePlayer(p);
      })
    );

    // New look or name of a party member
    this.unsubs.push(
      multiplayerClient.addPlayerProfileListener((data) => {
        if (this.isLocalPlayer({ userId: data.userId })) return;
        const entity = this.players.get(data.userId);
        if (!entity) return;
        this.addOrUpdatePlayer({
          userId: data.userId,
          username: data.displayName,
          displayName: data.displayName,
          appearance: data.appearance,
          x: entity.targetPos.x,
          y: entity.targetPos.y,
          z: entity.targetPos.z,
          yaw: entity.targetYaw,
          anim: entity.anim,
          lastUpdate: performance.now(),
        });
      })
    );

    this.unsubs.push(
      multiplayerClient.addPlayerMovedListener((update) => {
        if (!update.userId) return;
        if (this.isLocalPlayer({ userId: update.userId })) return;
        if (!this.onMyLevel(update.levelId)) {
          // Still on (or already moved to) another level: don't draw a ghost on our map
          if (this.players.has(update.userId)) this.removePlayer(update.userId);
          return;
        }

        let entity = this.players.get(update.userId);
        if (!entity) {
          // Look up party cache in case player metadata was received earlier
          const cached = multiplayerClient.getPartyPlayer(update.userId);
          const displayName = cached ? getPlayerDisplayName(cached) : 'Explorador';
          this.addOrUpdatePlayer({
            userId: update.userId,
            username: displayName,
            appearance: cached?.appearance,
            x: update.x,
            y: update.y,
            z: update.z,
            yaw: update.yaw,
            anim: update.anim,
            action: update.action,
            lastUpdate: performance.now(),
          });
          entity = this.players.get(update.userId);
        }

        if (entity) {
          entity.targetPos.set(update.x, update.y, update.z);
          entity.targetYaw = update.yaw;
          entity.anim = update.anim;
          entity.lastSeen = performance.now();
        }
      })
    );

    this.unsubs.push(
      multiplayerClient.addPlayerLeftListener((data) => {
        const id = data.userId || data.id;
        if (id) {
          this.removePlayer(id);
        }
      })
    );
  }

  private addOrUpdatePlayer(p: RemotePlayer) {
    const userId = p.userId || p.id;
    if (!userId) return;
    if (this.isLocalPlayer(p)) return;

    let entity = this.players.get(userId);
    const displayName = getPlayerDisplayName(p);
    const appearance = sanitizeAppearance(p.appearance, undefined, true);
    const appearanceKey = JSON.stringify(appearance);

    if (!entity) {
      try {
        // Instantiate character in lightweight remote mode (reduced shadow casters)
        const model = createPlayerCharacter(this.textures, appearance, true);
        const nameTag = createNameTagSprite(displayName);
        model.group.add(nameTag);

        const pos = new THREE.Vector3(
          Number.isFinite(p.x) ? p.x : 0,
          Number.isFinite(p.y) ? p.y : 0,
          Number.isFinite(p.z) ? p.z : 0
        );
        model.group.position.copy(pos);
        model.group.rotation.y = Number.isFinite(p.yaw) ? p.yaw : 0;
        this.scene.add(model.group);

        entity = {
          userId,
          username: displayName,
          appearanceKey,
          model,
          nameTag,
          currentPos: pos.clone(),
          targetPos: pos.clone(),
          currentYaw: Number.isFinite(p.yaw) ? p.yaw : 0,
          targetYaw: Number.isFinite(p.yaw) ? p.yaw : 0,
          anim: p.anim || 'idle',
          lastSeen: performance.now(),
          grabbed: false,
          down: false,
        };
        this.players.set(userId, entity);
      } catch (err) {
        console.error('[RemotePlayers] Failed to spawn remote player', userId, err);
        return;
      }
    } else {
      // Re-add to scene if it was detached during level change or reconnect
      if (entity.model.group.parent !== this.scene) {
        this.scene.add(entity.model.group);
      }
      entity.model.group.visible = true;

      // Update appearance if new appearance data arrived or changed
      const hasRealAppearance = Boolean(p.appearance && Object.keys(p.appearance).length > 0);
      if (hasRealAppearance && entity.appearanceKey !== appearanceKey) {
        try {
          // Dispose old model
          disposePlayerCharacter(entity.model);
          this.scene.remove(entity.model.group);

          // Build updated model with real appearance
          const newModel = createPlayerCharacter(this.textures, appearance, true);
          newModel.group.position.copy(entity.currentPos);
          newModel.group.rotation.y = entity.currentYaw;

          // Re-attach nameTag
          newModel.group.add(entity.nameTag);
          this.scene.add(newModel.group);

          entity.model = newModel;
          entity.appearanceKey = appearanceKey;
        } catch (err) {
          console.warn('[RemotePlayers] Could not update model appearance:', err);
        }
      }

      // Update name tag if name changed from placeholder to real username
      if (displayName && displayName !== entity.username && displayName !== 'Explorador') {
        entity.model.group.remove(entity.nameTag);
        entity.nameTag.material.dispose();
        entity.nameTag = createNameTagSprite(displayName);
        entity.model.group.add(entity.nameTag);
        entity.username = displayName;
      }

      if (Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)) {
        entity.targetPos.set(p.x, p.y, p.z);
      }
      if (Number.isFinite(p.yaw)) entity.targetYaw = p.yaw;
      if (p.anim) entity.anim = p.anim;
      entity.lastSeen = performance.now();
    }
  }

  private removePlayer(userId: string) {
    const entity = this.players.get(userId);
    if (entity) {
      if (entity.downLabel) {
        this.scene.remove(entity.downLabel);
        entity.downLabel.material.dispose();
      }
      if (entity.cage) {
        this.scene.remove(entity.cage);
      }
      this.scene.remove(entity.model.group);
      disposePlayerCharacter(entity.model);
      entity.nameTag.material.dispose();
      this.players.delete(userId);
    }
  }

  /** Positions of everyone else in the room (boss fights: rescues, host choice). */
  public getPlayersInfo(): { userId: string; username: string; pos: THREE.Vector3; grabbed: boolean; down: boolean; look: CharacterAppearance }[] {
    return [...this.players.values()].map((e) => ({
      userId: e.userId,
      username: e.username,
      pos: e.currentPos,
      grabbed: e.grabbed,
      down: e.down,
      look: e.model.appearance,
    }));
  }

  public getPlayerEntity(userId: string): RemotePlayerEntity | undefined {
    return this.players.get(userId);
  }

  public getActivePlayers(): { userId: string; username: string; pos: THREE.Vector3 }[] {
    return [...this.players.values()].map((e) => ({
      userId: e.userId,
      username: e.username,
      pos: e.currentPos,
    }));
  }

  public getNextSpectateTarget(currentUserId?: string | null, dir: 1 | -1 = 1): { userId: string; username: string } | null {
    const active = this.getActivePlayers();
    if (active.length === 0) return null;
    if (!currentUserId) return { userId: active[0].userId, username: active[0].username };
    const idx = active.findIndex((p) => p.userId === currentUserId);
    if (idx === -1) return { userId: active[0].userId, username: active[0].username };
    const nextIdx = (idx + dir + active.length) % active.length;
    return { userId: active[nextIdx].userId, username: active[nextIdx].username };
  }

  /** A friend fainted in a boss fight: lay them down with a "¡RCP!" sign until revived. */
  public setDown(userId: string, on: boolean) {
    const e = this.players.get(userId);
    if (!e) return;
    e.down = on;
    if (on) {
      e.downPos = e.targetPos.clone();
      e.downAt = performance.now();
    }
    if (on && !e.downLabel) {
      e.downLabel = makeLabel('¡Hazme RCP!');
      this.scene.add(e.downLabel);
    }
    if (e.downLabel) e.downLabel.visible = on;
    e.nameTag.visible = !on;
    if (!on) {
      e.model.group.rotation.x = 0;
      e.model.group.rotation.order = 'XYZ';
    }
  }

  /** Shows/hides the bone cage on a friend caught by a skeleton. */
  public setGrabbed(userId: string, on: boolean) {
    const e = this.players.get(userId);
    if (!e) return;
    e.grabbed = on;
    if (on && !e.cage) {
      const cage = createBoneCage(0.7, 1.9);
      const label = makeLabel('¡Ayuda!');
      label.position.y = 2.9;
      cage.add(label);
      e.model.group.add(cage);
      e.cage = cage;
    }
    if (e.cage) e.cage.visible = on;
  }

  /** Leaving a boss fight: nobody is caged or lying down any more. */
  public clearCombatMarks() {
    for (const [id, e] of this.players) {
      if (e.grabbed) this.setGrabbed(id, false);
      if (e.down) this.setDown(id, false);
    }
  }

  public clearAll() {
    for (const [id] of this.players) {
      this.removePlayer(id);
    }
    this.players.clear();
  }

  public dispose() {
    this.clearAll();
    for (const unsub of this.unsubs) {
      unsub();
    }
    this.unsubs = [];
  }

  public update(dt: number) {
    this.windTime += dt;
    const lerpFactor = Math.min(1.0, dt * 14);

    for (const [, entity] of this.players) {
      // Linear position interpolation
      entity.currentPos.lerp(entity.targetPos, lerpFactor);
      entity.model.group.position.copy(entity.currentPos);

      // Branchless shortest-arc angular yaw interpolation
      const dyaw = Math.atan2(
        Math.sin(entity.targetYaw - entity.currentYaw),
        Math.cos(entity.targetYaw - entity.currentYaw)
      );
      entity.currentYaw += dyaw * lerpFactor;
      entity.model.group.rotation.y = entity.currentYaw;

      // Safety net: the "get up" message can get lost (lag, a dropped packet, a rejoin). A friend
      // who is moving around again, or has been lying longer than any faint lasts, is clearly up.
      if (
        entity.down &&
        ((entity.downPos && entity.targetPos.distanceTo(entity.downPos) > 1.2) ||
          (entity.downAt !== undefined && performance.now() - entity.downAt > 32000) ||
          entity.anim === 'walk' ||
          entity.anim === 'run' ||
          entity.anim === 'jump')
      ) {
        this.setDown(entity.userId, false);
      }

      if (entity.down) {
        entity.model.group.rotation.order = 'YXZ';
        entity.model.group.rotation.x = -Math.PI / 2;
        entity.model.group.position.y += 0.3;
        if (entity.downLabel) {
          entity.downLabel.position.set(
            entity.currentPos.x,
            entity.currentPos.y + 1.6 + Math.sin(this.windTime * 4) * 0.08,
            entity.currentPos.z
          );
        }
      }

      // Animate limbs & companion
      let speed = 0;
      let isGrounded = true;

      if (entity.anim === 'walk') {
        speed = 5.0;
      } else if (entity.anim === 'run') {
        speed = 10.0;
      } else if (entity.anim === 'jump') {
        speed = 6.0;
        isGrounded = false;
      } else if (entity.anim === 'fall') {
        speed = 3.0;
        isGrounded = false;
      }

      entity.model.updateAnimation(speed, isGrounded, dt, this.windTime);
    }
  }
}
