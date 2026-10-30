/**
 * Central Three.js Game Engine for Cozy Parkour World
 * Full WebGL PBR setup, RoomEnvironment reflection, soft shadows,
 * damped third-person camera, input buffering, and software WebGL guard.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { soundManager, WeatherType } from '../audio/SoundtrackSynthesizer';
import { buildCozyParkourWorld, WorldBuildResult } from './levels';
import { createPlayerCharacter, PlayerCharacterModel } from './models';
import { ParkourPhysics, PlayerInput } from './physics';
import { createProceduralTextures, ProceduralTextures } from './textures';
import { WeatherSystem } from './weather';
import { AetherStalker } from './enemies';

export type GameMode = 'free' | 'time_trial' | 'chase';
export type GameState = 'title' | 'playing' | 'paused' | 'victory' | 'photo_mode' | 'game_over';

export interface WeatherNotice {
  weather: WeatherType;
  title: string;
  desc: string;
  reason: 'milestone' | 'manual';
}

export interface GameEngineCallbacks {
  onStateChange: (state: GameState) => void;
  onCheckpointChange: (name: string, index: number) => void;
  onCollectiblesChange: (collected: number, total: number) => void;
  onWeatherChange: (weather: WeatherType, isTransitioning?: boolean) => void;
  onWeatherNotice?: (notice: WeatherNotice) => void;
  onModeChange?: (mode: GameMode) => void;
  onTimeTrialTick?: (timeRemaining: number, bonusNotice?: { seconds: number; reason: string }) => void;
  onStalkerProximity?: (distance: number, warningLevel: 'none' | 'caution' | 'danger') => void;
}

export class GameEngine {
  private container: HTMLElement;
  private callbacks: GameEngineCallbacks;

  // Three.js core
  public renderer!: THREE.WebGLRenderer;
  public scene!: THREE.Scene;
  public camera!: THREE.PerspectiveCamera;
  private dirLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private clock!: THREE.Clock;
  private isSoftwareGl: boolean = false;

  // Systems
  public textures!: ProceduralTextures;
  public world!: WorldBuildResult;
  public playerModel!: PlayerCharacterModel;
  public physics!: ParkourPhysics;
  public weatherSystem!: WeatherSystem;

  // Game state & modes
  public gameState: GameState = 'title';
  public gameMode: GameMode = 'free';
  public timeRemaining: number = 90;
  public stalker: AetherStalker | null = null;
  private frameId: number = 0;
  private isDisposed: boolean = false;


  // Camera Orbit & Follow
  public cameraYaw: number = 0;
  public cameraPitch: number = 0.28; // slight downward angle
  public cameraDistance: number = 5.8;
  private targetCameraPos = new THREE.Vector3();
  private targetLookAt = new THREE.Vector3();
  private isMouseDragging: boolean = false;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;

  // Photo Mode State
  public photoModePaused: boolean = false;
  public photoFov: number = 55;
  public photoElevation: number = 0;
  public photoDistance: number = 5.0;
  public photoYaw: number = 0;
  public photoPitch: number = 0.25;
  public photoRoll: number = 0;
  public photoTarget = new THREE.Vector3();

  // Input state
  private rawKeys: Record<string, boolean> = {};
  public virtualInput: PlayerInput = {
    forward: 0,
    right: 0,
    jump: false,
    sprint: false,
    crouch: false,
  };
  public currentInput: PlayerInput = {
    forward: 0,
    right: 0,
    jump: false,
    sprint: false,
    crouch: false,
  };

  constructor(container: HTMLElement, callbacks: GameEngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.init();
  }

  private init() {
    // 1. Detect Software WebGL
    this.isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return false;
      }
    })();

    // 2. Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.container.appendChild(this.renderer.domElement);

    // 3. Scene & Camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      60,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      250
    );
    this.clock = new THREE.Clock();

    // 4. Procedural Studio Environment Reflection
    try {
      const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
      pmremGenerator.dispose();
    } catch {
      // fallback
    }

    // 5. Lighting Rig
    this.dirLight = new THREE.DirectionalLight(0xffa45c, 2.2);
    this.dirLight.position.set(25, 45, 20);
    this.dirLight.castShadow = !this.isSoftwareGl;
    if (this.dirLight.castShadow) {
      this.dirLight.shadow.mapSize.width = 1024;
      this.dirLight.shadow.mapSize.height = 1024;
      this.dirLight.shadow.camera.near = 0.5;
      this.dirLight.shadow.camera.far = 120;
      const d = 25;
      this.dirLight.shadow.camera.left = -d;
      this.dirLight.shadow.camera.right = d;
      this.dirLight.shadow.camera.top = d;
      this.dirLight.shadow.camera.bottom = -d;
      this.dirLight.shadow.bias = -0.0005;
      this.dirLight.shadow.normalBias = 0.02;
    }
    this.scene.add(this.dirLight);

    this.hemiLight = new THREE.HemisphereLight(0xffd29d, 0x5c715e, 1.1);
    this.scene.add(this.hemiLight);

    // 6. Textures & World Build
    const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createProceduralTextures(maxAnisotropy);

    this.world = buildCozyParkourWorld(this.scene, this.textures);
    this.playerModel = createPlayerCharacter(this.textures);
    this.scene.add(this.playerModel.group);

    // 7. Physics Controller
    this.physics = new ParkourPhysics(this.world, this.playerModel);

    // 8. Weather System
    this.weatherSystem = new WeatherSystem(this.scene, this.dirLight, this.hemiLight, this.textures);
    this.weatherSystem.onTransitionChange = (target, progress, finished) => {
      this.callbacks.onWeatherChange(target, !finished);
    };

    // 9. Input & Window Listeners
    this.setupListeners();

    // Initial compile to pre-warm shaders
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // Report initial state
    this.callbacks.onCollectiblesChange(0, this.physics.totalCollectibles);
    this.callbacks.onCheckpointChange('Sunrise Meadow', 1);

    // Start render loop
    this.startLoop();
  }

  public setGameMode(mode: GameMode) {
    this.gameMode = mode;
    if (mode === 'time_trial') {
      this.timeRemaining = 90;
      if (this.stalker) {
        this.stalker.dispose();
        this.stalker = null;
      }
      this.callbacks.onTimeTrialTick?.(this.timeRemaining);
    } else if (mode === 'chase') {
      if (!this.stalker) {
        this.stalker = new AetherStalker(this.scene, this.physics.position);
      } else {
        this.stalker.resetPosition(this.physics.position);
      }
    } else {
      if (this.stalker) {
        this.stalker.dispose();
        this.stalker = null;
      }
    }
    this.callbacks.onModeChange?.(mode);
  }

  public startGame(mode?: GameMode) {
    soundManager.init();
    soundManager.resume();
    if (mode) {
      this.setGameMode(mode);
    }
    this.gameState = 'playing';
    this.physics.hasReachedSummit = false;
    this.callbacks.onStateChange('playing');
    if (this.gameMode === 'time_trial') {
      this.timeRemaining = 90;
      this.callbacks.onTimeTrialTick?.(this.timeRemaining);
    } else if (this.gameMode === 'chase') {
      if (!this.stalker) {
        this.stalker = new AetherStalker(this.scene, this.physics.position);
      } else {
        this.stalker.resetPosition(this.physics.position);
      }
    }
    if (this.weatherSystem.currentWeather !== 'golden_hour') {
      this.transitionWeather('golden_hour', 2.5, 'milestone', 'Hora Dorada', 'Prado del Amanecer');
    }
  }

  public setPaused(paused: boolean) {
    if (this.gameState === 'title' || this.gameState === 'victory' || this.gameState === 'game_over') return;
    this.gameState = paused ? 'paused' : 'playing';
    this.callbacks.onStateChange(this.gameState);
  }

  public returnToTitle() {
    this.gameState = 'title';
    this.physics.respawnAtCheckpoint(0, true);
    if (this.stalker) {
      this.stalker.dispose();
      this.stalker = null;
    }
    this.callbacks.onStateChange('title');
  }

  /**
   * Smoothly transitions weather over duration seconds, synchronizing lighting,
   * sky color, fog, clouds, particles, and Web Audio synthesizer soundtrack.
   */
  public transitionWeather(
    weather: WeatherType,
    duration: number = 3.2,
    reason: 'milestone' | 'manual' = 'manual',
    customTitle?: string,
    customDesc?: string
  ) {
    this.weatherSystem.transitionTo(weather, duration);
    soundManager.setWeather(weather, duration);
    this.callbacks.onWeatherChange(weather, true);

    const descriptions: Record<WeatherType, { title: string; desc: string }> = {
      golden_hour: {
        title: 'Hora Dorada',
        desc: 'Luz ámbar cálida y polen resplandeciente',
      },
      sakura_breeze: {
        title: 'Brisa de Sakura',
        desc: 'Danza de pétalos al viento en el Dosel Ventoso',
      },
      cozy_rain: {
        title: 'Lluvia Acogedora',
        desc: 'Gotas suaves y niebla fresca en la Aguja Celestial',
      },
      starlit_night: {
        title: 'Noche Estrellada',
        desc: 'Cielo índigo cósmico y luciérnagas mágicas',
      },
    };

    const info = descriptions[weather];
    if (this.callbacks.onWeatherNotice) {
      this.callbacks.onWeatherNotice({
        weather,
        title: customTitle || info.title,
        desc: customDesc || info.desc,
        reason,
      });
    }
  }

  public setWeather(weather: WeatherType) {
    this.transitionWeather(weather, 3.2, 'manual');
  }

  public addTimeTrialBonus(seconds: number, reason: string) {
    if (this.gameMode !== 'time_trial') return;
    this.timeRemaining += seconds;
    soundManager.playTimeBonus();
    this.callbacks.onTimeTrialTick?.(this.timeRemaining, { seconds, reason });
  }

  public restartGame(mode?: GameMode) {
    if (mode) {
      this.setGameMode(mode);
    }
    this.physics.respawnAtCheckpoint(0, true);
    this.gameState = 'playing';
    this.physics.hasReachedSummit = false;
    this.callbacks.onStateChange('playing');
    if (this.gameMode === 'time_trial') {
      this.timeRemaining = 90;
      this.callbacks.onTimeTrialTick?.(this.timeRemaining);
    } else if (this.gameMode === 'chase') {
      if (!this.stalker) {
        this.stalker = new AetherStalker(this.scene, this.physics.position);
      } else {
        this.stalker.resetPosition(this.physics.position);
      }
    }
    this.transitionWeather('golden_hour', 2.5, 'milestone', 'Hora Dorada', 'Comienzo en el Prado del Amanecer');
  }

  public warpToCheckpoint(index: number) {
    this.physics.respawnAtCheckpoint(index, true);
    if (this.world.checkpoints[index]) {
      this.callbacks.onCheckpointChange(this.world.checkpoints[index].name, index + 1);
    }
    if (this.gameMode === 'chase' && this.stalker) {
      this.stalker.resetPosition(this.physics.position);
      this.stalker.setCheckpointSpeed(index + 1);
    }
    // Smoothly transition weather to match target zone milestone
    if (index === 0) {
      this.transitionWeather('golden_hour', 2.8, 'milestone', 'Hora Dorada', 'Retorno al Prado del Amanecer');
    } else if (index === 1) {
      this.transitionWeather('sakura_breeze', 2.8, 'milestone', 'Brisa de Sakura', 'Viaje al Dosel Ventoso');
    } else if (index === 2) {
      this.transitionWeather('cozy_rain', 2.8, 'milestone', 'Lluvia Acogedora', 'Viaje a la Aguja Celestial');
    }
    if (this.gameState === 'paused' || this.gameState === 'photo_mode' || this.gameState === 'game_over') {
      this.gameState = 'playing';
      this.callbacks.onStateChange('playing');
    }
  }

  // --- Photo Mode API ---
  public enterPhotoMode() {
    if (this.gameState === 'title') return;
    this.gameState = 'photo_mode';
    this.photoYaw = this.cameraYaw;
    this.photoPitch = this.cameraPitch;
    this.photoDistance = 5.2;
    this.photoFov = 55;
    this.photoRoll = 0;
    this.photoElevation = 0;
    this.photoTarget.copy(this.physics.position).add(new THREE.Vector3(0, 1.1, 0));
    this.camera.fov = this.photoFov;
    this.camera.updateProjectionMatrix();
    this.callbacks.onStateChange('photo_mode');
  }

  public exitPhotoMode() {
    if (this.gameState !== 'photo_mode') return;
    this.gameState = 'playing';
    this.camera.fov = 60;
    this.camera.up.set(0, 1, 0);
    this.camera.rotation.set(0, 0, 0);
    this.photoRoll = 0;
    this.camera.updateProjectionMatrix();
    this.callbacks.onStateChange('playing');
  }

  public setPhotoModePaused(paused: boolean) {
    this.photoModePaused = paused;
  }

  public setPhotoFov(fov: number) {
    this.photoFov = fov;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  public setPhotoDistance(dist: number) {
    this.photoDistance = Math.max(1.8, Math.min(16.0, dist));
  }

  public setPhotoElevation(elevation: number) {
    this.photoElevation = elevation;
  }

  public setPhotoRoll(roll: number) {
    this.photoRoll = roll;
  }

  public adjustPhotoYawPitch(dYaw: number, dPitch: number) {
    this.photoYaw += dYaw;
    this.photoPitch = Math.max(-0.45, Math.min(1.25, this.photoPitch + dPitch));
  }

  public panPhotoTarget(dx: number, dz: number) {
    const cosYaw = Math.cos(this.photoYaw);
    const sinYaw = Math.sin(this.photoYaw);
    this.photoTarget.x += cosYaw * dx - sinYaw * dz;
    this.photoTarget.z += sinYaw * dx + cosYaw * dz;
  }

  public captureScreenshot(): string {
    this.renderer.render(this.scene, this.camera);
    soundManager.playCameraShutter();
    return this.renderer.domElement.toDataURL('image/png');
  }

  // --- Input Management ---
  private setupListeners() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    window.addEventListener('resize', this.handleResize);

    const dom = this.renderer.domElement;
    dom.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);
    dom.addEventListener('wheel', this.handleWheel, { passive: true });

    // Touch support
    dom.addEventListener('touchstart', this.handleTouchStart, { passive: true });
    window.addEventListener('touchmove', this.handleTouchMove, { passive: true });
    window.addEventListener('touchend', this.handleTouchEnd);
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    soundManager.resume();
    this.rawKeys[e.code] = true;

    if (this.gameState === 'title') {
      if (e.code === 'Space' || e.code === 'Enter') {
        this.startGame();
      }
      return;
    }

    if (e.code === 'Escape') {
      if (this.gameState === 'photo_mode') {
        this.exitPhotoMode();
        return;
      }
      this.setPaused(this.gameState !== 'paused');
    }
    if (e.code === 'KeyP') {
      if (this.gameState === 'photo_mode') {
        this.exitPhotoMode();
      } else if (this.gameState === 'playing') {
        this.enterPhotoMode();
      }
    }
    if (e.code === 'KeyR') {
      if (this.gameState === 'photo_mode') return;
      this.physics.respawnAtCheckpoint();
    }
    if (e.code === 'KeyM') {
      soundManager.setMuted(!soundManager.getMuted());
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.rawKeys[e.code] = false;
  };

  private handleBlur = () => {
    this.rawKeys = {};
  };

  public handleResize = () => {
    if (!this.container || this.isDisposed) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    // In portrait orientation (w < h), widen FOV so mobile players have wide visibility of platforms
    if (w < h) {
      this.camera.fov = 74;
    } else {
      this.camera.fov = 60;
    }
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  public rotateCamera(deltaYaw: number) {
    this.cameraYaw += deltaYaw;
  }

  private handleMouseDown = (e: MouseEvent) => {
    if (e.button === 0 || e.button === 2) {
      this.isMouseDragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    }
  };

  private handleMouseMove = (e: MouseEvent) => {
    if (!this.isMouseDragging) return;
    const dx = e.clientX - this.lastMouseX;
    const dy = e.clientY - this.lastMouseY;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;

    if (this.gameState === 'photo_mode') {
      this.photoYaw += dx * 0.006;
      this.photoPitch = Math.max(-0.45, Math.min(1.25, this.photoPitch - dy * 0.005));
      return;
    }

    this.cameraYaw -= dx * 0.006;
    this.cameraPitch = Math.max(0.08, Math.min(1.2, this.cameraPitch + dy * 0.005));
  };

  private handleMouseUp = () => {
    this.isMouseDragging = false;
  };

  private handleWheel = (e: WheelEvent) => {
    if (this.gameState === 'photo_mode') {
      this.photoDistance = Math.max(1.8, Math.min(16.0, this.photoDistance + e.deltaY * 0.005));
      return;
    }
    this.cameraDistance = Math.max(3.0, Math.min(12.0, this.cameraDistance + e.deltaY * 0.005));
  };

  private touchId: number | null = null;
  private touchStartX = 0;
  private touchStartY = 0;
  private initialPinchDist = 0;

  private handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      // Two-finger pinch to zoom camera
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      this.initialPinchDist = Math.hypot(dx, dy);
      return;
    }

    // Touch camera look: only on right portion of viewport or upper half
    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches[i];
      // Avoid bottom-left zone reserved for virtual joystick (unless in photo mode)
      if (this.gameState === 'photo_mode' || t.clientX > window.innerWidth * 0.35 || t.clientY < window.innerHeight * 0.5) {
        this.touchId = t.identifier;
        this.touchStartX = t.clientX;
        this.touchStartY = t.clientY;
        this.isMouseDragging = true;
        break;
      }
    }
  };

  private handleTouchMove = (e: TouchEvent) => {
    // Handle pinch zoom
    if (e.touches.length === 2 && this.initialPinchDist > 0) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const pinchDelta = (this.initialPinchDist - dist) * 0.02;
      if (this.gameState === 'photo_mode') {
        this.photoDistance = Math.max(1.8, Math.min(16.0, this.photoDistance + pinchDelta));
      } else {
        this.cameraDistance = Math.max(3.0, Math.min(12.0, this.cameraDistance + pinchDelta));
      }
      this.initialPinchDist = dist;
      return;
    }

    if (!this.isMouseDragging) return;
    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches[i];
      if (t.identifier === this.touchId) {
        const dx = t.clientX - this.touchStartX;
        const dy = t.clientY - this.touchStartY;
        this.touchStartX = t.clientX;
        this.touchStartY = t.clientY;

        if (this.gameState === 'photo_mode') {
          this.photoYaw += dx * 0.007;
          this.photoPitch = Math.max(-0.45, Math.min(1.25, this.photoPitch - dy * 0.006));
        } else {
          this.cameraYaw -= dx * 0.007;
          this.cameraPitch = Math.max(0.08, Math.min(1.2, this.cameraPitch + dy * 0.005));
        }
        break;
      }
    }
  };

  private handleTouchEnd = (e: TouchEvent) => {
    if (e.touches.length < 2) {
      this.initialPinchDist = 0;
    }
    if (e.touches.length === 0) {
      this.isMouseDragging = false;
      this.touchId = null;
    }
  };

  // Allow virtual joystick or HUD buttons to feed input smoothly
  public setVirtualInput(input: Partial<PlayerInput>) {
    Object.assign(this.virtualInput, input);
  }

  private updateCombinedInput() {
    const k = this.rawKeys;
    let kForward = 0;
    let kRight = 0;

    if (k['KeyW'] || k['ArrowUp']) kForward += 1;
    if (k['KeyS'] || k['ArrowDown']) kForward -= 1;
    if (k['KeyD'] || k['ArrowRight']) kRight += 1;
    if (k['KeyA'] || k['ArrowLeft']) kRight -= 1;

    // Smooth keyboard camera rotation (Q/E)
    if (k['KeyQ']) this.cameraYaw += 0.04;
    if (k['KeyE']) this.cameraYaw -= 0.04;

    const hasKeyboardMove = kForward !== 0 || kRight !== 0;

    // Blend keyboard with analog mobile thumbstick
    this.currentInput.forward = hasKeyboardMove ? kForward : this.virtualInput.forward;
    this.currentInput.right = hasKeyboardMove ? kRight : this.virtualInput.right;
    this.currentInput.jump = Boolean(k['Space']) || this.virtualInput.jump;
    this.currentInput.sprint = Boolean(k['ShiftLeft'] || k['ShiftRight']) || this.virtualInput.sprint;
    this.currentInput.crouch = Boolean(k['KeyC']) || this.virtualInput.crouch;
  }

  // --- Render Loop ---
  private startLoop() {
    let frameId = 0;

    const afterDraw = (cb: () => void) => {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.isDisposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (this.isDisposed) return;

      const rawDt = this.clock.getDelta();
      const dt = Math.min(rawDt, 0.05); // Clamp dt to avoid physics tunnelling
      const elapsedTime = this.clock.getElapsedTime();

      this.update(dt, elapsedTime);
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      afterDraw(tick);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private update(dt: number, time: number) {
    // 1. Title Screen live-world camera pan
    if (this.gameState === 'title') {
      this.cameraYaw = time * 0.15;
      const camX = Math.sin(this.cameraYaw) * 12.0;
      const camZ = Math.cos(this.cameraYaw) * 12.0;
      this.camera.position.set(camX, 4.0, camZ);
      this.camera.lookAt(0, 1.2, 0);

      this.playerModel.updateAnimation(0, true, dt, time);
      this.weatherSystem.update(dt, new THREE.Vector3(0, 0, 0), time);
      return;
    }

    if (this.gameState === 'paused') {
      return;
    }

    // 1b. Photo Mode Update & Camera Orbit
    if (this.gameState === 'photo_mode') {
      if (!this.photoModePaused) {
        this.weatherSystem.update(dt, this.photoTarget, time);
        this.physics.updateMovingPlatforms(time, dt);
        for (const obs of this.world.obstacles) obs.update(time);
        if (this.world.pinwheels) for (const pin of this.world.pinwheels) pin.update(time);
        if (this.world.balanceLogs) for (const log of this.world.balanceLogs) log.update(time);
        if (this.world.steamVents) for (const vent of this.world.steamVents) vent.update(dt);
        for (const plat of this.world.platforms) {
          if (plat.bouncyModel) plat.bouncyModel.update(dt);
          if (plat.updraftModel) plat.updraftModel.update(dt);
        }
        for (const cp of this.world.checkpoints) cp.shrine.update(dt);
        for (const col of this.world.collectibles) col.update(dt);
        if (this.world.enemyManager) {
          this.world.enemyManager.update(dt, time, this.physics.position);
        }
        this.playerModel.updateAnimation(0, true, dt, time);
      }

      // Smooth Orbit & Framing Camera
      const cosPitch = Math.cos(this.photoPitch);
      const sinPitch = Math.sin(this.photoPitch);
      const offsetX = Math.sin(this.photoYaw) * cosPitch * this.photoDistance;
      const offsetZ = Math.cos(this.photoYaw) * cosPitch * this.photoDistance;
      const offsetY = sinPitch * this.photoDistance;

      this.targetCameraPos.set(
        this.photoTarget.x - offsetX,
        this.photoTarget.y + this.photoElevation + offsetY,
        this.photoTarget.z - offsetZ
      );

      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this.targetCameraPos.x, 12.0, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, this.targetCameraPos.y, 12.0, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, this.targetCameraPos.z, 12.0, dt);

      this.targetLookAt.set(this.photoTarget.x, this.photoTarget.y + this.photoElevation, this.photoTarget.z);
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(this.targetLookAt);
      if (Math.abs(this.photoRoll) > 0.001) {
        this.camera.rotateZ(this.photoRoll);
      }

      this.dirLight.position.set(this.photoTarget.x + 25, this.photoTarget.y + 45, this.photoTarget.z + 20);
      this.dirLight.target.position.copy(this.photoTarget);
      this.dirLight.target.updateMatrixWorld();
      return;
    }

    // 2. Poll Input (Keyboard + Mobile Virtual Controls)
    this.updateCombinedInput();

    // 3. Update Moving Platforms & Obstacles
    this.physics.updateMovingPlatforms(time, dt);
    for (const obs of this.world.obstacles) {
      obs.update(time);
    }
    if (this.world.pinwheels) {
      for (const pin of this.world.pinwheels) {
        pin.update(time);
      }
    }
    if (this.world.balanceLogs) {
      for (const log of this.world.balanceLogs) {
        log.update(time);
      }
    }
    if (this.world.steamVents) {
      for (const vent of this.world.steamVents) {
        vent.update(dt);
      }
    }

    // 4. Update Bouncy Mushrooms and Updrafts
    for (const plat of this.world.platforms) {
      if (plat.bouncyModel) {
        plat.bouncyModel.update(dt);
      }
      if (plat.updraftModel) {
        plat.updraftModel.update(dt);
      }
    }

    // 5. Update Shrines & Collectibles
    for (const cp of this.world.checkpoints) {
      cp.shrine.update(dt);
    }
    for (const col of this.world.collectibles) {
      col.update(dt);
    }

    // 5b. Game Mode Execution (Time Trial Countdown & Chase Stalker)
    if (this.gameMode === 'time_trial') {
      const prevSec = Math.floor(this.timeRemaining);
      this.timeRemaining -= dt;
      const curSec = Math.floor(this.timeRemaining);
      if (prevSec !== curSec) {
        this.callbacks.onTimeTrialTick?.(Math.max(0, this.timeRemaining));
        if (curSec <= 15 && curSec > 0) {
          soundManager.playTimeWarning();
        }
      }
      if (this.timeRemaining <= 0) {
        this.timeRemaining = 0;
        this.gameState = 'game_over';
        this.callbacks.onStateChange('game_over');
        soundManager.playGameOver();
        return;
      }
    } else if (this.gameMode === 'chase') {
      if (!this.stalker) {
        this.stalker = new AetherStalker(this.scene, this.physics.position);
      }
      this.stalker.update(dt, time, this.physics.position, () => {
        // Caught by Stalker! Respawn player at checkpoint with warning notice
        this.physics.respawnAtCheckpoint();
        this.callbacks.onWeatherNotice?.({
          weather: this.weatherSystem.currentWeather,
          title: '¡Acechador te atrapó!',
          desc: 'La sombra te lanzó al vacío. Reapareces en el santuario.',
          reason: 'manual',
        });
      });
      this.callbacks.onStalkerProximity?.(
        this.stalker.distanceToPlayer,
        this.stalker.warningLevel
      );
    }

    // 6. Physics Step
    const prevCollectibles = this.physics.collectedCount;
    this.physics.update(
      dt,
      this.currentInput,
      this.cameraYaw,
      (cpName) => {
        const cpIdx = this.physics.currentCheckpointIndex;
        this.callbacks.onCheckpointChange(cpName, cpIdx + 1);

        // Mode specific checkpoint bonuses
        if (this.gameMode === 'time_trial') {
          this.addTimeTrialBonus(15, 'Punto de Control (+15s)');
        } else if (this.gameMode === 'chase' && this.stalker) {
          this.stalker.setCheckpointSpeed(cpIdx + 1);
        }

        // Milestone-triggered smooth weather transitions
        if (cpIdx === 1) {
          // Checkpoint 2: Windy Canopy
          this.transitionWeather(
            'sakura_breeze',
            3.5,
            'milestone',
            'Brisa de Sakura',
            'Pétalos al viento al alcanzar el Dosel Ventoso'
          );
        } else if (cpIdx === 2) {
          // Checkpoint 3: Celestial Spire
          this.transitionWeather(
            'cozy_rain',
            3.5,
            'milestone',
            'Lluvia Acogedora',
            'Gotas suaves y niebla en la Aguja Celestial'
          );
        }
      },
      () => {
        // Milestone: Summit Victory!
        this.gameState = 'victory';
        this.callbacks.onStateChange('victory');
        soundManager.playVictory();
        if (this.stalker) {
          this.stalker.isStunned = true;
          this.stalker.stunTimer = 999;
        }
        this.transitionWeather(
          'starlit_night',
          4.5,
          'milestone',
          'Noche Estrellada',
          '¡Cima alcanzada en el Mirador Celestial!'
        );
      }
    );

    if (this.physics.collectedCount !== prevCollectibles) {
      this.callbacks.onCollectiblesChange(
        this.physics.collectedCount,
        this.physics.totalCollectibles
      );
      if (this.gameMode === 'time_trial') {
        this.addTimeTrialBonus(8, 'Reliquia (+8s)');
      }
    }

    // 7. Update Weather & Background Clouds
    this.weatherSystem.update(dt, this.physics.position, time);

    // 8. Damped Third-Person Camera Follow
    const playerPos = this.physics.position;
    this.targetLookAt.set(playerPos.x, playerPos.y + 1.1, playerPos.z);

    const cosPitch = Math.cos(this.cameraPitch);
    const sinPitch = Math.sin(this.cameraPitch);
    const offsetX = Math.sin(this.cameraYaw) * cosPitch * this.cameraDistance;
    const offsetZ = Math.cos(this.cameraYaw) * cosPitch * this.cameraDistance;
    const offsetY = sinPitch * this.cameraDistance;

    this.targetCameraPos.set(
      playerPos.x - offsetX,
      playerPos.y + 1.1 + offsetY,
      playerPos.z - offsetZ
    );

    // Exponential camera damping for buttery smooth motion
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this.targetCameraPos.x, 10.0, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, this.targetCameraPos.y, 10.0, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, this.targetCameraPos.z, 10.0, dt);

    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.targetLookAt);

    // Follow light with player
    this.dirLight.position.set(playerPos.x + 25, playerPos.y + 45, playerPos.z + 20);
    this.dirLight.target.position.copy(playerPos);
    this.dirLight.target.updateMatrixWorld();
  }

  public dispose() {
    this.isDisposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    window.removeEventListener('resize', this.handleResize);

    const dom = this.renderer.domElement;
    dom.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);
    dom.removeEventListener('wheel', this.handleWheel);

    this.stalker?.dispose();
    this.world.enemyManager?.dispose();
    this.weatherSystem.dispose();
    this.renderer.dispose();
    if (dom.parentElement) {
      dom.parentElement.removeChild(dom);
    }
  }
}

