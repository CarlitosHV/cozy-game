/**
 * Game HUD & Shell: Title Screen, Low-Occlusion Status Clusters,
 * Collapsible Bottom Control Dock, Pause & Victory Modals,
 * and Ergonomic Mobile Touch Controls (360° Analog Joystick + Jump/Sprint Buttons).
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Sun,
  CloudRain,
  Flower2,
  Moon,
  Compass,
  MapPin,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Award,
  HelpCircle,
  X,
  ArrowUp,
  Zap,
  Smartphone,
  Camera,
  Download,
  Eye,
  EyeOff,
  Sliders,
  Palette,
  Layers,
  Image as ImageIcon,
  Check,
} from 'lucide-react';
import { GameEngine, GameState } from '../game/GameEngine';
import { WeatherType, soundManager } from '../audio/SoundtrackSynthesizer';

export type PhotoFilter =
  | 'natural'
  | 'golden_hour'
  | 'dreamy_pastel'
  | 'cozy_sunset'
  | 'starry_twilight'
  | 'vintage_sepia';

export type PhotoFrame = 'none' | 'polaroid' | 'cinematic' | 'postcard' | 'grid';

export const PHOTO_FILTERS: {
  id: PhotoFilter;
  name: string;
  color: string;
  desc: string;
  css: string;
}[] = [
  { id: 'natural', name: 'Natural', color: '#f8fafc', desc: 'Puro y nítido', css: 'none' },
  {
    id: 'golden_hour',
    name: 'Hora Dorada',
    color: '#f59e0b',
    desc: 'Luz ámbar cálida',
    css: 'sepia(0.28) saturate(1.4) brightness(1.05) contrast(1.05)',
  },
  {
    id: 'dreamy_pastel',
    name: 'Pastel Ensueño',
    color: '#a78bfa',
    desc: 'Etéreo y luminoso',
    css: 'brightness(1.12) saturate(1.15) hue-rotate(10deg) contrast(0.95)',
  },
  {
    id: 'cozy_sunset',
    name: 'Atardecer Cozy',
    color: '#f43f5e',
    desc: 'Melocotón y magenta',
    css: 'sepia(0.35) hue-rotate(-20deg) saturate(1.45) contrast(1.1)',
  },
  {
    id: 'starry_twilight',
    name: 'Noche Estelar',
    color: '#38bdf8',
    desc: 'Cielo índigo y cian',
    css: 'brightness(0.9) contrast(1.2) hue-rotate(185deg) saturate(1.3)',
  },
  {
    id: 'vintage_sepia',
    name: 'Película Vintage',
    color: '#d97706',
    desc: 'Sepia nostálgico',
    css: 'sepia(0.65) contrast(1.15) brightness(0.95) saturate(0.85)',
  },
];

export const PHOTO_FRAMES: { id: PhotoFrame; name: string; desc: string }[] = [
  { id: 'none', name: 'Sin Marco', desc: 'Composición limpia' },
  { id: 'polaroid', name: 'Polaroid', desc: 'Borde blanco clásico' },
  { id: 'cinematic', name: 'Cinemático', desc: 'Barras 2.39:1 y tipografía oro' },
  { id: 'postcard', name: 'Postal', desc: 'Sello aéreo y matasellos' },
  { id: 'grid', name: 'Guía 3x3', desc: 'Regla de los tercios' },
];

interface GameHUDProps {
  engine: GameEngine | null;
  gameState: GameState;
  checkpointName: string;
  checkpointIndex: number;
  collectedCount: number;
  totalCollectibles: number;
  currentWeather: WeatherType;
  isWeatherTransitioning?: boolean;
  weatherNotice?: {
    weather: WeatherType;
    title: string;
    desc: string;
    reason: 'milestone' | 'manual';
  } | null;
}


// --- 360° Analog Virtual Joystick for Mobile Devices ---
const VirtualJoystick: React.FC<{
  onMove: (forward: number, right: number) => void;
}> = ({ onMove }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [isActive, setIsActive] = useState(false);
  const touchIdRef = useRef<number | null>(null);

  const maxRadius = 45;

  const updateKnob = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);

    let clampedX = dx;
    let clampedY = dy;
    if (dist > maxRadius) {
      clampedX = (dx / dist) * maxRadius;
      clampedY = (dy / dist) * maxRadius;
    }

    setKnobPos({ x: clampedX, y: clampedY });

    // Normalized analog values (-1 to 1)
    const normRight = clampedX / maxRadius;
    const normForward = -clampedY / maxRadius;
    onMove(normForward, normRight);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (touchIdRef.current !== null) return;
    const touch = e.changedTouches[0];
    touchIdRef.current = touch.identifier;
    setIsActive(true);
    updateKnob(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === touchIdRef.current) {
        updateKnob(touch.clientX, touch.clientY);
        break;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchIdRef.current) {
        touchIdRef.current = null;
        setIsActive(false);
        setKnobPos({ x: 0, y: 0 });
        onMove(0, 0);
        break;
      }
    }
  };

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      className={`relative w-28 h-28 sm:w-32 sm:h-32 rounded-full border-2 transition-all select-none flex items-center justify-center ${
        isActive
          ? 'bg-amber-950/40 border-amber-400 shadow-xl shadow-amber-500/20'
          : 'bg-stone-900/70 border-stone-700/70 shadow-lg'
      }`}
      style={{ touchAction: 'none' }}
    >
      {/* Directional ticks */}
      <span className="absolute top-2 text-[9px] text-stone-500 font-mono">W</span>
      <span className="absolute bottom-2 text-[9px] text-stone-500 font-mono">S</span>
      <span className="absolute left-2 text-[9px] text-stone-500 font-mono">A</span>
      <span className="absolute right-2 text-[9px] text-stone-500 font-mono">D</span>

      {/* Interactive knob */}
      <div
        className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-md border-2 border-amber-200 pointer-events-none flex items-center justify-center"
        style={{
          transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
          transition: isActive ? 'none' : 'transform 0.15s ease-out',
        }}
      >
        <div className="w-4 h-4 rounded-full bg-amber-100/70" />
      </div>
    </div>
  );
};

// --- High-Resolution Photo Compositor with Frames and Aesthetic Grading ---
function renderFinalPhotoWithFrame(
  rawImgSrc: string,
  filter: PhotoFilter,
  frame: PhotoFrame,
  checkpointName: string
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      const activeFilterObj = PHOTO_FILTERS.find((f) => f.id === filter);
      const filterCss = activeFilterObj ? activeFilterObj.css : 'none';

      if (frame === 'polaroid') {
        const borderX = Math.round(img.width * 0.05);
        const topY = Math.round(img.height * 0.05);
        const bottomY = Math.round(img.height * 0.18);
        canvas.width = img.width + borderX * 2;
        canvas.height = img.height + topY + bottomY;

        ctx.fillStyle = '#f8f5ee';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.filter = filterCss;
        ctx.drawImage(img, borderX, topY, img.width, img.height);
        ctx.filter = 'none';

        ctx.fillStyle = '#3a2d21';
        ctx.font = `600 ${Math.round(canvas.height * 0.04)}px 'Playfair Display', serif`;
        ctx.textAlign = 'center';
        ctx.fillText('Aether Leap · ' + checkpointName, canvas.width / 2, canvas.height - bottomY * 0.38);

        resolve(canvas.toDataURL('image/png'));
      } else if (frame === 'cinematic') {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.filter = filterCss;
        ctx.drawImage(img, 0, 0);
        ctx.filter = 'none';

        const barHeight = Math.round(canvas.height * 0.12);
        ctx.fillStyle = '#080808';
        ctx.fillRect(0, 0, canvas.width, barHeight);
        ctx.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);

        ctx.fillStyle = '#dfb15b';
        ctx.font = `600 ${Math.round(canvas.height * 0.026)}px 'Outfit', sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('AETHER LEAP · ' + checkpointName.toUpperCase(), canvas.width / 2, canvas.height - barHeight * 0.36);

        resolve(canvas.toDataURL('image/png'));
      } else if (frame === 'postcard') {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.filter = filterCss;
        ctx.drawImage(img, 0, 0);
        ctx.filter = 'none';

        // Postcard border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.round(canvas.width * 0.018);
        ctx.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);

        // Postal stamp
        const stampW = Math.round(canvas.width * 0.12);
        const stampH = Math.round(canvas.height * 0.14);
        ctx.fillStyle = '#d4a373';
        ctx.fillRect(canvas.width - stampW - 32, 32, stampW, stampH);
        ctx.strokeStyle = '#faedcd';
        ctx.lineWidth = 3;
        ctx.strokeRect(canvas.width - stampW - 32, 32, stampW, stampH);

        ctx.fillStyle = '#2b2118';
        ctx.font = `bold ${Math.round(canvas.height * 0.024)}px 'Outfit', sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('ISLES ☁️', canvas.width - stampW / 2 - 32, 32 + stampH * 0.58);

        resolve(canvas.toDataURL('image/png'));
      } else {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.filter = filterCss;
        ctx.drawImage(img, 0, 0);
        ctx.filter = 'none';
        resolve(canvas.toDataURL('image/png'));
      }
    };
    img.src = rawImgSrc;
  });
}

export const GameHUD: React.FC<GameHUDProps> = ({
  engine,
  gameState,
  checkpointName,
  checkpointIndex,
  collectedCount,
  totalCollectibles,
  currentWeather,
  isWeatherTransitioning = false,
  weatherNotice = null,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isDockCollapsed, setIsDockCollapsed] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isSprintActive, setIsSprintActive] = useState(false);

  // Photo Mode Studio State
  const [photoFilter, setPhotoFilter] = useState<PhotoFilter>('natural');
  const [photoFrame, setPhotoFrame] = useState<PhotoFrame>('none');
  const [photoFov, setPhotoFov] = useState(55);
  const [photoDistance, setPhotoDistance] = useState(5.0);
  const [photoElevation, setPhotoElevation] = useState(0);
  const [photoRoll, setPhotoRoll] = useState(0);
  const [isPhotoPaused, setIsPhotoPaused] = useState(false);
  const [hidePhotoUI, setHidePhotoUI] = useState(false);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [photoActiveTab, setPhotoActiveTab] = useState<'camera' | 'filters' | 'frames'>('camera');
  const [isFlashing, setIsFlashing] = useState(false);

  // Auto-detect mobile touch screen or allow explicit toggle
  const [touchControlsEnabled, setTouchControlsEnabled] = useState(() => {
    return typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth < 850);
  });

  // Auto-switch between Keyboard and Touch controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const gameKeys = [
        'KeyW', 'KeyA', 'KeyS', 'KeyD',
        'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
        'Space', 'ShiftLeft', 'ShiftRight',
        'KeyQ', 'KeyE', 'KeyR', 'KeyC', 'Escape'
      ];
      if (gameKeys.includes(e.code)) {
        setTouchControlsEnabled(false);
      }
    };

    const handleTouchStart = () => {
      setTouchControlsEnabled(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('touchstart', handleTouchStart);
    };
  }, []);

  // Timer
  useEffect(() => {
    if (gameState !== 'playing') return;
    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [gameState]);

  // Live Canvas Filter in Photo Mode
  useEffect(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    if (gameState === 'photo_mode') {
      const activeFilter = PHOTO_FILTERS.find((f) => f.id === photoFilter);
      canvas.style.filter = activeFilter ? activeFilter.css : 'none';
      canvas.style.transition = 'filter 0.25s ease';
    } else {
      canvas.style.filter = 'none';
    }
  }, [gameState, photoFilter]);

  // Keyboard shortcut 'H' for dock collapse or photo mode UI toggle, and Space for snap
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyH') {
        if (gameState === 'photo_mode') {
          setHidePhotoUI((prev) => !prev);
        } else {
          setIsDockCollapsed((prev) => !prev);
        }
      }
      if (gameState === 'photo_mode' && (e.code === 'Space' || e.code === 'Enter') && !capturedPhotoUrl) {
        handleSnapPhoto();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gameState, photoFilter, photoFrame, capturedPhotoUrl]);

  const handleSnapPhoto = async () => {
    if (!engine) return;
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 180);

    const rawUrl = engine.captureScreenshot();
    const finalUrl = await renderFinalPhotoWithFrame(
      rawUrl,
      photoFilter,
      photoFrame,
      checkpointName
    );
    setCapturedPhotoUrl(finalUrl);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundManager.setMuted(next);
  };

  const handleStartGame = () => {
    if (engine) engine.startGame();
  };

  const handleRestart = () => {
    setElapsedTime(0);
    if (engine) engine.restartGame();
  };

  const handleWeatherSelect = (w: WeatherType) => {
    if (engine) engine.setWeather(w);
  };

  const handleWarpCheckpoint = (idx: number) => {
    if (engine) engine.warpToCheckpoint(idx);
  };

  const handleJoystickMove = (forward: number, right: number) => {
    if (engine) {
      engine.setVirtualInput({ forward, right });
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-10 overflow-hidden font-['Outfit',sans-serif]">
      {/* ======================================================== */}
      {/* 1. TITLE SCREEN OVERLAY                                  */}
      {/* ======================================================== */}
      {gameState === 'title' && (
        <div className="absolute inset-0 flex flex-col items-center justify-between pointer-events-auto bg-stone-900/40 text-stone-100 p-6 sm:p-12 transition-opacity duration-700">
          {/* Top subtle badge */}
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-stone-900/75 border border-stone-700/60 text-xs tracking-widest text-amber-300 font-medium uppercase mt-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Cozy Floating Archipelago</span>
          </div>

          {/* Central bespoke inline SVG Title Lockup */}
          <div className="flex flex-col items-center text-center max-w-xl">
            <svg
              className="w-full max-w-md h-auto drop-shadow-md mb-2"
              viewBox="0 0 500 120"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M100,75 C90,75 80,68 80,55 C80,42 92,35 105,37 C115,22 140,15 160,28 C175,18 200,20 210,32 C225,24 245,28 250,42 C265,38 280,48 280,60 C290,62 300,70 295,80 C275,85 120,85 100,75 Z"
                fill="rgba(255, 255, 255, 0.12)"
              />
              <text
                x="250"
                y="58"
                textAnchor="middle"
                className="font-serif font-bold text-4xl sm:text-5xl"
                fill="#fffbf0"
                style={{
                  fontFamily: "'Playfair Display', serif",
                  letterSpacing: '0.08em',
                  filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.4))',
                }}
              >
                AETHER LEAP
              </text>
              <text
                x="250"
                y="88"
                textAnchor="middle"
                className="text-xs sm:text-sm font-light tracking-[0.3em] uppercase"
                fill="#ffd166"
              >
                Parkour Relajante en las Nubes
              </text>
            </svg>

            <p className="text-stone-300 text-xs sm:text-sm max-w-md font-light leading-relaxed mb-6 px-4">
              Salta por plataformas flotantes, rebota en hongos gigantes, surca corrientes de viento y supera obstáculos físicos hasta el Mirador Celestial.
            </p>

            {/* Start CTA Button */}
            <button
              onClick={handleStartGame}
              className="group flex items-center gap-3 px-8 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-base transition-all transform active:scale-95 shadow-lg shadow-amber-950/40 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-stone-950" />
              <span>Comenzar Viaje / Start</span>
              <span className="hidden sm:inline-block text-xs px-2 py-0.5 rounded bg-amber-600/40 text-stone-900 border border-amber-600/60 font-mono">
                Space / Enter
              </span>
            </button>
          </div>

          {/* Bottom Flat Control Hint Line */}
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs text-stone-400 border-t border-stone-800/80 pt-3 px-4 text-center">
            <span className="text-stone-300">WASD / Stick <span className="text-stone-500">Mover</span></span>
            <span className="text-stone-600">·</span>
            <span className="text-stone-300">Espacio / Botón A <span className="text-stone-500">Saltar</span></span>
            <span className="text-stone-600">·</span>
            <span className="text-stone-300">Shift / Botón <span className="text-stone-500">Correr</span></span>
            <span className="text-stone-600">·</span>
            <span className="text-stone-300">Arrastrar / Q-E <span className="text-stone-500">Girar Cámara</span></span>
            <span className="text-stone-600">·</span>
            <span className="text-stone-300">R <span className="text-stone-500">Reiniciar</span></span>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. PLAYING / ACTIVE STATUS CLUSTERS (World-Matched UI)  */}
      {/* ======================================================== */}
      {gameState === 'playing' && (
        <>
          {/* Top-Left Cluster: Checkpoint & Collectibles */}
          <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-auto">
            {/* Stage & Checkpoint Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-900/80 border border-stone-800/80 text-stone-200 text-xs shadow-md">
              <MapPin className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] text-stone-400 font-medium uppercase tracking-wider">
                  Punto {checkpointIndex}/3
                </span>
                <span className="font-semibold text-stone-100 text-xs sm:text-sm">{checkpointName}</span>
              </div>
            </div>

            {/* Sun Crystals / Acorns Collectibles & Timer */}
            <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-stone-900/80 border border-stone-800/80 text-xs text-stone-300 shadow-md">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="tabular-nums font-semibold text-amber-300">
                  {collectedCount} / {totalCollectibles}
                </span>
              </div>
              <div className="w-[1px] h-3 bg-stone-700/60" />
              <div className="flex items-center gap-1 font-mono text-stone-300">
                <span>{formatTime(elapsedTime)}</span>
              </div>
            </div>
          </div>

          {/* Top-Right Cluster: Quick Actions (Photo Mode, Mute, Mobile Touch Toggle, Help, Reset) */}
          <div className="absolute top-4 right-4 flex items-center gap-2 pointer-events-auto">
            {/* Photo Mode Trigger */}
            <button
              onClick={() => engine?.enterPhotoMode()}
              title="Entrar al Modo Foto (Tecla P)"
              className="flex items-center gap-1.5 px-3 py-2 sm:py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 transition-all shadow-md cursor-pointer text-xs font-semibold"
            >
              <Camera className="w-4 h-4 text-amber-300" />
              <span className="hidden sm:inline">Modo Foto (P)</span>
            </button>

            <button
              onClick={() => setTouchControlsEnabled(!touchControlsEnabled)}
              title={touchControlsEnabled ? 'Ocultar Controles Táctiles' : 'Mostrar Controles Táctiles'}
              className={`p-2 sm:p-2.5 rounded-xl border transition-colors shadow-md cursor-pointer ${
                touchControlsEnabled
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                  : 'bg-stone-900/80 text-stone-300 border-stone-800 hover:bg-stone-800'
              }`}
            >
              <Smartphone className="w-4 h-4" />
            </button>
            <button
              onClick={toggleMute}
              title={isMuted ? 'Activar Sonido' : 'Silenciar (M)'}
              className="p-2 sm:p-2.5 rounded-xl bg-stone-900/80 border border-stone-800 hover:bg-stone-800 text-stone-200 transition-colors shadow-md cursor-pointer"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
            </button>
            <button
              onClick={() => setShowHelpModal(true)}
              title="Guía y Controles"
              className="p-2 sm:p-2.5 rounded-xl bg-stone-900/80 border border-stone-800 hover:bg-stone-800 text-sky-400 transition-colors shadow-md cursor-pointer"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            <button
              onClick={() => engine?.physics.respawnAtCheckpoint()}
              title="Reiniciar en Punto de Control (R)"
              className="p-2 sm:p-2.5 rounded-xl bg-stone-900/80 border border-stone-800 hover:bg-stone-800 text-stone-300 transition-colors shadow-md cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Weather Transition & Milestone Toast */}
          {weatherNotice && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 pointer-events-none z-30 transition-all duration-500 ease-out animate-in fade-in slide-in-from-top-4">
              <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-stone-900/95 border border-amber-500/40 text-stone-100 shadow-2xl backdrop-blur-md">
                <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                <div className="flex flex-col">
                  <span className="text-[10px] text-amber-300 font-medium uppercase tracking-wider">
                    {weatherNotice.reason === 'milestone' ? 'Hito Alcanzado' : 'Transición de Clima'}
                  </span>
                  <span className="text-xs font-semibold text-white">
                    {weatherNotice.title} · {weatherNotice.desc}
                  </span>
                </div>
                {isWeatherTransitioning && (
                  <span className="text-[10px] text-stone-400 font-mono ml-1 px-1.5 py-0.5 rounded bg-stone-800">
                    Transicionando...
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 3. MOBILE ON-SCREEN TOUCH CONTROLS                       */}
          {/* ======================================================== */}
          {touchControlsEnabled && (
            <>
              {/* Bottom-Left 360° Analog Joystick */}
              <div className="absolute bottom-6 left-6 pointer-events-auto z-20">
                <VirtualJoystick onMove={handleJoystickMove} />
              </div>

              {/* Bottom-Right Action Buttons (Jump & Sprint) */}
              <div className="absolute bottom-6 right-6 flex flex-col items-end gap-3 pointer-events-auto z-20">
                {/* Sprint Toggle Button */}
                <button
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    const next = !isSprintActive;
                    setIsSprintActive(next);
                    engine?.setVirtualInput({ sprint: next });
                  }}
                  onClick={() => {
                    const next = !isSprintActive;
                    setIsSprintActive(next);
                    engine?.setVirtualInput({ sprint: next });
                  }}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold shadow-lg transition-transform active:scale-95 cursor-pointer touch-none select-none ${
                    isSprintActive
                      ? 'bg-amber-400 text-stone-950 border-2 border-amber-200'
                      : 'bg-stone-900/80 text-stone-200 border border-stone-700/80'
                  }`}
                  style={{ touchAction: 'none' }}
                >
                  <Zap className={`w-4 h-4 ${isSprintActive ? 'fill-stone-950' : 'text-amber-400'}`} />
                  <span>{isSprintActive ? 'CORRIENDO' : 'CORRER'}</span>
                </button>

                {/* Big Round Jump Button */}
                <button
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    engine?.setVirtualInput({ jump: true });
                  }}
                  onTouchEnd={(e) => {
                    e.stopPropagation();
                    engine?.setVirtualInput({ jump: false });
                  }}
                  onMouseDown={() => engine?.setVirtualInput({ jump: true })}
                  onMouseUp={() => engine?.setVirtualInput({ jump: false })}
                  className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 active:from-amber-500 active:to-amber-700 text-stone-950 font-extrabold flex flex-col items-center justify-center shadow-xl shadow-amber-950/50 border-2 border-amber-200 active:scale-90 transition-transform cursor-pointer touch-none select-none"
                  style={{ touchAction: 'none' }}
                  title="Saltar / Jump"
                >
                  <ArrowUp className="w-7 h-7 stroke-[3]" />
                  <span className="text-[10px] tracking-wider uppercase -mt-0.5">SALTAR</span>
                </button>
              </div>
            </>
          )}

          {/* ======================================================== */}
          {/* 4. COLLAPSIBLE BOTTOM DOCK (Weather, Warps, Zen Mode)    */}
          {/* ======================================================== */}
          <div
            className={`absolute bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2 pointer-events-auto flex flex-col items-center transition-transform duration-300 ease-out max-w-[94vw] z-10 ${
              isDockCollapsed ? 'translate-y-[calc(100%-28px)]' : 'translate-y-0'
            }`}
          >
            {/* Collapse / Expand Tab Handle */}
            <button
              onClick={() => setIsDockCollapsed(!isDockCollapsed)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-t-lg bg-stone-900/90 border-t border-x border-stone-800 text-[11px] text-stone-400 hover:text-stone-200 cursor-pointer shadow-md"
            >
              {isDockCollapsed ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>Clima / Dock (H)</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>Modo Zen (H)</span>
                </>
              )}
            </button>

            {/* Main Dock Container */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl bg-stone-900/90 border border-stone-800/90 shadow-xl">
              {/* Weather Presets */}
              <div className="flex items-center gap-1 bg-stone-950/60 p-1 rounded-xl border border-stone-800/60">
                <button
                  onClick={() => handleWeatherSelect('golden_hour')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    currentWeather === 'golden_hour'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                  title="Hora Dorada: Luz cálida y polen brillante"
                >
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Dorado</span>
                </button>

                <button
                  onClick={() => handleWeatherSelect('cozy_rain')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    currentWeather === 'cozy_rain'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                  title="Lluvia Acogedora: Gotas suaves y sonido relajante"
                >
                  <CloudRain className="w-3.5 h-3.5 text-sky-400" />
                  <span className="hidden sm:inline">Lluvia</span>
                </button>

                <button
                  onClick={() => handleWeatherSelect('sakura_breeze')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    currentWeather === 'sakura_breeze'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                  title="Brisa de Sakura: Pétalos flotantes al viento"
                >
                  <Flower2 className="w-3.5 h-3.5 text-rose-400" />
                  <span className="hidden sm:inline">Sakura</span>
                </button>

                <button
                  onClick={() => handleWeatherSelect('starlit_night')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    currentWeather === 'starlit_night'
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                  title="Noche Estrellada: Luciérnagas y cielo índigo"
                >
                  <Moon className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="hidden sm:inline">Noche</span>
                </button>
              </div>

              {/* Checkpoint Warp Buttons */}
              <div className="hidden lg:flex items-center gap-1.5 text-xs text-stone-400">
                <span className="text-[11px] text-stone-500 uppercase font-medium">Ir a:</span>
                <button
                  onClick={() => handleWarpCheckpoint(0)}
                  className={`px-2 py-1 rounded-lg border text-xs cursor-pointer ${
                    checkpointIndex === 1
                      ? 'bg-stone-800 text-stone-100 border-stone-600'
                      : 'bg-stone-950/50 text-stone-400 border-stone-800 hover:text-stone-200'
                  }`}
                >
                  Prado
                </button>
                <button
                  onClick={() => handleWarpCheckpoint(1)}
                  className={`px-2 py-1 rounded-lg border text-xs cursor-pointer ${
                    checkpointIndex === 2
                      ? 'bg-stone-800 text-stone-100 border-stone-600'
                      : 'bg-stone-950/50 text-stone-400 border-stone-800 hover:text-stone-200'
                  }`}
                >
                  Puentes
                </button>
                <button
                  onClick={() => handleWarpCheckpoint(2)}
                  className={`px-2 py-1 rounded-lg border text-xs cursor-pointer ${
                    checkpointIndex === 3
                      ? 'bg-stone-800 text-stone-100 border-stone-600'
                      : 'bg-stone-950/50 text-stone-400 border-stone-800 hover:text-stone-200'
                  }`}
                >
                  Cúspide
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ======================================================== */}
      {/* 4b. PHOTO MODE STUDIO (Viewfinder, Filters & Framing)     */}
      {/* ======================================================== */}
      {gameState === 'photo_mode' && (
        <div className="absolute inset-0 pointer-events-none select-none z-30">
          {/* Shutter White Flash Animation */}
          {isFlashing && (
            <div className="absolute inset-0 bg-white pointer-events-none z-50 animate-out fade-out duration-200" />
          )}

          {/* Frame Overlays */}
          {photoFrame === 'grid' && (
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none z-10 opacity-30">
              <div className="border-r border-b border-white" />
              <div className="border-r border-b border-white" />
              <div className="border-b border-white" />
              <div className="border-r border-b border-white" />
              <div className="border-r border-b border-white" />
              <div className="border-b border-white" />
              <div className="border-r border-white" />
              <div className="border-r border-white" />
              <div />
            </div>
          )}

          {photoFrame === 'cinematic' && (
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none z-10">
              <div className="w-full h-[12vh] bg-stone-950/95 border-b border-stone-800 flex items-center justify-center">
                <span className="text-[10px] text-amber-400/60 font-mono tracking-[0.25em] uppercase">
                  2.39:1 Anamorphic Widescreen
                </span>
              </div>
              <div className="w-full h-[12vh] bg-stone-950/95 border-t border-stone-800 flex items-center justify-center">
                <span className="text-xs text-amber-200/90 font-serif tracking-widest uppercase">
                  Aether Leap · {checkpointName}
                </span>
              </div>
            </div>
          )}

          {photoFrame === 'polaroid' && (
            <div className="absolute inset-4 sm:inset-10 border-[16px] sm:border-[24px] border-b-[56px] sm:border-b-[72px] border-stone-100/95 shadow-2xl rounded-sm pointer-events-none z-10 flex items-end justify-center pb-2">
              <span className="text-stone-800 font-serif italic text-sm sm:text-base tracking-wide">
                Aether Leap · {checkpointName} ☁️
              </span>
            </div>
          )}

          {photoFrame === 'postcard' && (
            <div className="absolute inset-4 sm:inset-8 border-4 border-dashed border-white/60 pointer-events-none z-10">
              <div className="absolute top-3 right-3 px-3 py-1.5 bg-amber-600/80 border border-amber-300 text-stone-100 text-[10px] font-bold rounded">
                ISLES ☁️
              </div>
            </div>
          )}

          {/* Photo Mode HUD (Toggled with 'H' or icon) */}
          {!hidePhotoUI && (
            <>
              {/* Top Viewfinder Bar */}
              <div className="absolute top-4 inset-x-4 flex items-center justify-between pointer-events-auto z-20">
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-stone-900/90 border border-amber-500/40 text-stone-200 text-xs shadow-xl backdrop-blur-md">
                  <Camera className="w-4 h-4 text-amber-400" />
                  <span className="font-bold text-amber-300 tracking-wider">MODO FOTO</span>
                  <span className="text-stone-500">|</span>
                  <span className="text-stone-300 font-mono text-[11px]">
                    {photoFov}° Lente · {photoDistance.toFixed(1)}m
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Pause / Play Action Toggle */}
                  <button
                    onClick={() => {
                      const next = !isPhotoPaused;
                      setIsPhotoPaused(next);
                      engine?.setPhotoModePaused(next);
                    }}
                    title={isPhotoPaused ? 'Reanudar Movimiento' : 'Pausar Mundo para Foto'}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold shadow-md cursor-pointer backdrop-blur-md transition-colors ${
                      isPhotoPaused
                        ? 'bg-amber-500/20 text-amber-300 border-amber-400/50'
                        : 'bg-stone-900/90 text-stone-300 border-stone-800 hover:bg-stone-800'
                    }`}
                  >
                    {isPhotoPaused ? <Play className="w-3.5 h-3.5 fill-amber-300" /> : <Pause className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{isPhotoPaused ? 'Mundo Pausado' : 'Pausar Mundo'}</span>
                  </button>

                  {/* Hide UI Toggle */}
                  <button
                    onClick={() => setHidePhotoUI(true)}
                    title="Ocultar Interfaz (H)"
                    className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-stone-900/90 border border-stone-800 hover:bg-stone-800 text-stone-300 text-xs font-medium transition-colors shadow-md cursor-pointer backdrop-blur-md flex items-center gap-1.5"
                  >
                    <EyeOff className="w-4 h-4" />
                    <span className="hidden sm:inline">Ocultar UI (H)</span>
                  </button>

                  {/* Exit Photo Mode */}
                  <button
                    onClick={() => engine?.exitPhotoMode()}
                    title="Salir del Modo Foto (Esc / P)"
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-stone-900/90 border border-stone-800 hover:bg-stone-800 text-stone-200 text-xs font-semibold shadow-md cursor-pointer backdrop-blur-md"
                  >
                    <X className="w-4 h-4" />
                    <span className="hidden sm:inline">Salir</span>
                  </button>
                </div>
              </div>

              {/* Bottom Photo Studio Drawer */}
              <div className="absolute bottom-4 inset-x-4 max-w-2xl mx-auto flex flex-col items-center gap-3 pointer-events-auto z-20">
                {/* Control Box */}
                <div className="w-full rounded-3xl bg-stone-950/90 border border-stone-800/90 p-4 shadow-2xl backdrop-blur-xl flex flex-col gap-3">
                  {/* Category Tabs & Shutter Action */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-800/80 pb-2.5">
                    <div className="flex items-center gap-1 sm:gap-2">
                      <button
                        onClick={() => setPhotoActiveTab('camera')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          photoActiveTab === 'camera'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'text-stone-400 hover:text-stone-200'
                        }`}
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>Cámara</span>
                      </button>
                      <button
                        onClick={() => setPhotoActiveTab('filters')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          photoActiveTab === 'filters'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'text-stone-400 hover:text-stone-200'
                        }`}
                      >
                        <Palette className="w-3.5 h-3.5" />
                        <span>Filtros ({PHOTO_FILTERS.find((f) => f.id === photoFilter)?.name})</span>
                      </button>
                      <button
                        onClick={() => setPhotoActiveTab('frames')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          photoActiveTab === 'frames'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'text-stone-400 hover:text-stone-200'
                        }`}
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Marcos</span>
                      </button>
                    </div>

                    {/* Snap Shutter Button */}
                    <button
                      onClick={handleSnapPhoto}
                      className="flex items-center gap-2 px-5 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-extrabold text-xs shadow-lg shadow-amber-950/50 active:scale-95 transition-all cursor-pointer"
                    >
                      <Camera className="w-4 h-4 fill-stone-950" />
                      <span>CAPTURAR (Espacio)</span>
                    </button>
                  </div>

                  {/* Tab Panels */}
                  {photoActiveTab === 'camera' && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-stone-300">
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[11px] text-stone-400 font-medium">
                          <span>Zoom / Distancia</span>
                          <span className="font-mono text-amber-300">{photoDistance.toFixed(1)}m</span>
                        </div>
                        <input
                          type="range"
                          min="2.0"
                          max="14.0"
                          step="0.2"
                          value={photoDistance}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setPhotoDistance(val);
                            engine?.setPhotoDistance(val);
                          }}
                          className="accent-amber-500 cursor-pointer h-1.5 bg-stone-800 rounded-lg"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[11px] text-stone-400 font-medium">
                          <span>Altura / Elevación</span>
                          <span className="font-mono text-amber-300">{photoElevation.toFixed(1)}m</span>
                        </div>
                        <input
                          type="range"
                          min="-1.5"
                          max="3.5"
                          step="0.1"
                          value={photoElevation}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setPhotoElevation(val);
                            engine?.setPhotoElevation(val);
                          }}
                          className="accent-amber-500 cursor-pointer h-1.5 bg-stone-800 rounded-lg"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[11px] text-stone-400 font-medium">
                          <span>Lente (FOV)</span>
                          <span className="font-mono text-amber-300">{photoFov}°</span>
                        </div>
                        <input
                          type="range"
                          min="28"
                          max="85"
                          step="1"
                          value={photoFov}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setPhotoFov(val);
                            engine?.setPhotoFov(val);
                          }}
                          className="accent-amber-500 cursor-pointer h-1.5 bg-stone-800 rounded-lg"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[11px] text-stone-400 font-medium">
                          <span>Inclinación (Roll)</span>
                          <span className="font-mono text-amber-300">{(photoRoll * 57.3).toFixed(0)}°</span>
                        </div>
                        <input
                          type="range"
                          min="-0.4"
                          max="0.4"
                          step="0.02"
                          value={photoRoll}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setPhotoRoll(val);
                            engine?.setPhotoRoll(val);
                          }}
                          className="accent-amber-500 cursor-pointer h-1.5 bg-stone-800 rounded-lg"
                        />
                      </div>
                    </div>
                  )}

                  {photoActiveTab === 'filters' && (
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {PHOTO_FILTERS.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setPhotoFilter(f.id)}
                          className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl border text-center transition-all cursor-pointer ${
                            photoFilter === f.id
                              ? 'bg-amber-500/20 border-amber-400 text-stone-100 shadow-md'
                              : 'bg-stone-900/70 border-stone-800/80 text-stone-400 hover:text-stone-200'
                          }`}
                        >
                          <div
                            className="w-5 h-5 rounded-full border border-stone-600 shadow-inner"
                            style={{ backgroundColor: f.color }}
                          />
                          <span className="text-[11px] font-bold leading-tight">{f.name}</span>
                          <span className="text-[9px] text-stone-500 hidden sm:inline">{f.desc}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {photoActiveTab === 'frames' && (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {PHOTO_FRAMES.map((fm) => (
                        <button
                          key={fm.id}
                          onClick={() => setPhotoFrame(fm.id)}
                          className={`flex flex-col items-center gap-1 p-2 rounded-2xl border text-center transition-all cursor-pointer ${
                            photoFrame === fm.id
                              ? 'bg-amber-500/20 border-amber-400 text-stone-100 shadow-md'
                              : 'bg-stone-900/70 border-stone-800/80 text-stone-400 hover:text-stone-200'
                          }`}
                        >
                          <span className="text-xs font-bold text-stone-200">{fm.name}</span>
                          <span className="text-[9px] text-stone-400">{fm.desc}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sub-hint bar */}
                <div className="text-[11px] text-stone-400 flex items-center gap-3 sm:gap-4 bg-stone-950/70 px-4 py-1 rounded-full border border-stone-800/60 shadow-md">
                  <span>Arrastrar para rotar</span>
                  <span>·</span>
                  <span>Rueda para zoom</span>
                  <span>·</span>
                  <span>H para ocultar menú</span>
                </div>
              </div>
            </>
          )}

          {/* Floating Show UI Pill if UI is hidden */}
          {hidePhotoUI && (
            <button
              onClick={() => setHidePhotoUI(false)}
              className="absolute bottom-6 right-6 pointer-events-auto px-4 py-2 rounded-2xl bg-stone-900/90 border border-stone-700 hover:bg-stone-800 text-amber-300 text-xs font-bold shadow-2xl flex items-center gap-2 cursor-pointer backdrop-blur-md"
            >
              <Eye className="w-4 h-4" />
              <span>Mostrar Menú (H)</span>
            </button>
          )}

          {/* Captured Photo Lightbox Modal */}
          {capturedPhotoUrl && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-stone-950/85 p-4 sm:p-6 z-50 backdrop-blur-sm">
              <div className="w-full max-w-lg rounded-3xl bg-stone-900 border border-amber-500/40 p-5 sm:p-6 text-stone-100 shadow-2xl flex flex-col items-center text-center max-h-[95vh] overflow-y-auto">
                <div className="w-full flex items-center justify-between mb-3 border-b border-stone-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-bold text-amber-200">¡Foto Capturada!</span>
                  </div>
                  <button
                    onClick={() => setCapturedPhotoUrl(null)}
                    className="p-1 rounded-lg text-stone-400 hover:text-stone-100 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Photo Preview Image */}
                <div className="w-full rounded-2xl overflow-hidden border border-stone-800 shadow-xl bg-stone-950 flex items-center justify-center mb-4">
                  <img
                    src={capturedPhotoUrl}
                    alt="Captured Scene"
                    className="w-full h-auto max-h-[55vh] object-contain rounded-xl"
                  />
                </div>

                {/* Actions */}
                <div className="w-full flex flex-col sm:flex-row items-center gap-2.5">
                  <a
                    href={capturedPhotoUrl}
                    download={`aether-leap-${checkpointName.toLowerCase().replace(/\s+/g, '-')}.png`}
                    className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                  >
                    <Download className="w-4 h-4 stroke-[2.5]" />
                    <span>Descargar Foto (PNG)</span>
                  </a>
                  <button
                    onClick={() => setCapturedPhotoUrl(null)}
                    className="w-full sm:w-auto py-3 px-5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-sm font-medium transition-colors cursor-pointer"
                  >
                    Tomar Otra
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. PAUSE MODAL                                           */}
      {/* ======================================================== */}
      {gameState === 'paused' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-stone-950/70 p-6 z-30">
          <div className="w-full max-w-sm rounded-3xl bg-stone-900 border border-stone-800 p-6 text-stone-100 shadow-2xl flex flex-col items-center text-center">
            <h2 className="text-2xl font-serif font-bold text-amber-200 mb-1">Pausa</h2>
            <p className="text-xs text-stone-400 mb-6">Tómate un respiro y disfruta la melodía.</p>

            <div className="w-full flex flex-col gap-2.5 mb-6">
              <button
                onClick={() => engine?.setPaused(false)}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm transition-colors cursor-pointer"
              >
                Reanudar / Resume
              </button>
              <button
                onClick={() => engine?.physics.respawnAtCheckpoint()}
                className="w-full py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-sm font-medium transition-colors cursor-pointer"
              >
                Reiniciar en Punto de Control
              </button>
              <button
                onClick={handleRestart}
                className="w-full py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-sm font-medium transition-colors cursor-pointer"
              >
                Comenzar desde el Inicio
              </button>
            </div>

            <div className="flex items-center gap-3 text-xs text-stone-400">
              <button onClick={toggleMute} className="flex items-center gap-1.5 hover:text-stone-200 cursor-pointer">
                {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
                <span>{isMuted ? 'Silenciado' : 'Sonido Activo'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. VICTORY MODAL (Summit Gazebo Reached)                  */}
      {/* ======================================================== */}
      {gameState === 'victory' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-stone-950/75 p-6 z-30">
          <div className="w-full max-w-md rounded-3xl bg-stone-900 border border-amber-500/40 p-8 text-stone-100 shadow-2xl flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 mb-4">
              <Award className="w-8 h-8" />
            </div>

            <h2 className="text-3xl font-serif font-bold text-amber-200 mb-2">¡Cúspide Alcanzada!</h2>
            <p className="text-sm text-stone-300 font-light max-w-xs mb-6">
              Has navegado con éxito los jardines flotantes y llegado al Mirador Celestial. Disfruta la vista panorámica de las nubes y las estrellas.
            </p>

            {/* Run Statistics */}
            <div className="w-full grid grid-cols-2 gap-3 mb-6 p-4 rounded-2xl bg-stone-950/60 border border-stone-800">
              <div className="flex flex-col items-center">
                <span className="text-[11px] text-stone-400 uppercase font-medium">Tiempo Transcurrido</span>
                <span className="text-xl font-bold font-mono text-amber-300">{formatTime(elapsedTime)}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[11px] text-stone-400 uppercase font-medium">Reliquias Halladas</span>
                <span className="text-xl font-bold font-mono text-emerald-400">
                  {collectedCount} / {totalCollectibles}
                </span>
              </div>
            </div>

            <div className="w-full flex flex-col gap-2.5">
              <button
                onClick={() => {
                  if (engine) {
                    engine.gameState = 'playing';
                  }
                }}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm transition-colors cursor-pointer"
              >
                Explorar Libremente
              </button>
              <button
                onClick={handleRestart}
                className="w-full py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-sm font-medium transition-colors cursor-pointer"
              >
                Jugar de Nuevo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 7. HELP & CONTROLS MODAL (Spanish & English Detailed)    */}
      {/* ======================================================== */}
      {showHelpModal && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-stone-950/75 p-4 sm:p-6 z-40">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-stone-900 border border-stone-800 p-6 text-stone-100 shadow-2xl relative">
            <button
              onClick={() => setShowHelpModal(false)}
              className="absolute top-5 right-5 text-stone-400 hover:text-stone-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-serif font-bold text-amber-200 mb-4 flex items-center gap-2">
              <Compass className="w-5 h-5 text-amber-400" />
              <span>Guía de Controles y Físicas</span>
            </h3>

            {/* Keyboard Section */}
            <div className="mb-4">
              <span className="text-[11px] text-amber-300 font-bold uppercase tracking-wider block mb-2">
                🎮 Controles en Teclado
              </span>
              <div className="space-y-2 text-xs text-stone-300">
                <div className="flex justify-between items-center py-1 border-b border-stone-800">
                  <span className="text-stone-400">Moverse (Snappy / Ágil)</span>
                  <span className="font-mono bg-stone-800 px-2 py-0.5 rounded text-amber-300">W A S D / Flechas</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-stone-800">
                  <span className="text-stone-400">Saltar (Variable / Súper Salto)</span>
                  <span className="font-mono bg-stone-800 px-2 py-0.5 rounded text-amber-300">Espacio</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-stone-800">
                  <span className="text-stone-400">Correr / Sprint</span>
                  <span className="font-mono bg-stone-800 px-2 py-0.5 rounded text-amber-300">Shift</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-stone-800">
                  <span className="text-stone-400">Girar Cámara</span>
                  <span className="font-mono bg-stone-800 px-2 py-0.5 rounded text-amber-300">Arrastrar Ratón / Q, E</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-stone-800">
                  <span className="text-stone-400">Zoom Cámara</span>
                  <span className="font-mono bg-stone-800 px-2 py-0.5 rounded text-amber-300">Rueda del Ratón</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-stone-800">
                  <span className="text-stone-400">Reiniciar en Punto de Control</span>
                  <span className="font-mono bg-stone-800 px-2 py-0.5 rounded text-amber-300">R</span>
                </div>
              </div>
            </div>

            {/* Mobile Touch Section */}
            <div className="mb-4">
              <span className="text-[11px] text-sky-300 font-bold uppercase tracking-wider block mb-2">
                📱 Controles Móviles (Pantalla Táctil)
              </span>
              <div className="space-y-2 text-xs text-stone-300">
                <div className="flex justify-between items-center py-1 border-b border-stone-800">
                  <span className="text-stone-400">Joystick 360° (Abajo a la Izquierda)</span>
                  <span className="text-stone-200">Mueve en cualquier dirección</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-stone-800">
                  <span className="text-stone-400">Botón Saltar (Abajo a la Derecha)</span>
                  <span className="text-stone-200">Salto y rebotes altos</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-stone-800">
                  <span className="text-stone-400">Botón Correr (Sprint)</span>
                  <span className="text-stone-200">Acelera el paso</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-stone-800">
                  <span className="text-stone-400">Girar Cámara / Zoom</span>
                  <span className="text-stone-200">Deslizar con 1 dedo / Pellizcar con 2</span>
                </div>
              </div>
            </div>

            {/* Enhanced Object Physics & Varied Obstacles Section */}
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200/90 leading-relaxed mb-3">
              <strong className="text-amber-300">🎪 Obstáculos y Físicas del Mundo:</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li><strong>Levitador Térmico (+16m):</strong> Columnas de aire ascendente súper altas que te elevan hacia las nubes con planeador asistido para alcanzar las siguientes plataformas sin esfuerzo.</li>
                <li><strong>Molinos Florales Giratorios (Pinwheels):</strong> Aspas de madera pastel que rotan sobre puentes; sincroniza tu paso o esquívalas.</li>
                <li><strong>Troncos Rodantes de Equilibrio (Balance Logs):</strong> Troncos cubiertos de musgo que giran sobre su eje, requiriendo equilibrio ágil o sprint veloz.</li>
                <li><strong>Géiseres de Esporas Cálidas:</strong> Calderas volcánicas que erupcionan ráfagas rítmicas de vapor para impulsarte en el aire.</li>
                <li><strong>Hongos Elásticos:</strong> Pulsa Saltar justo al caer sobre ellos para activar un <em>Súper Rebote</em> vertical.</li>
                <li><strong>Pelotas de Lana Rodantes:</strong> Rebotan dinámicamente con inercia rotacional y transfieren masa al chocar.</li>
                <li><strong>Plataformas Quebradizas:</strong> Tiemblan y se hunden bajo tu peso, cayendo tras 1.6s y regenerándose después.</li>
              </ul>
            </div>

            {/* Photo Mode Guide */}
            <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-[11px] text-sky-200/90 leading-relaxed mb-3">
              <strong className="text-sky-300">📸 Modo Foto (Tecla P / Botón Cámara):</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li><strong>Cámara Libre:</strong> Ajusta zoom, altura, ángulo de lente (FOV) e inclinación (Roll) con vista en 360°.</li>
                <li><strong>Pausar Acción:</strong> Congela el tiempo para capturar poses en el aire o deja correr la brisa.</li>
                <li><strong>6 Filtros Artísticos:</strong> Hora Dorada, Pastel Ensueño, Atardecer Cozy, Noche Estelar, Vintage Sepia y Natural.</li>
                <li><strong>Marcos Estilizados:</strong> Polaroid con texto, Cinemático 2.39:1 con barras negras, Tarjeta Postal aérea y Guía 3x3.</li>
                <li><strong>Descarga en Alta Resolución:</strong> Captura y descarga instantáneamente tu fotografía en formato PNG.</li>
              </ul>
            </div>

            {/* Cozy Enemies Guide */}
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-200/90 leading-relaxed mb-4">
              <strong className="text-emerald-300">🌿 Criaturas y Enemigos Cozy:</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>
                  <strong>Sproutlings (Duendes Bellota):</strong> Pequeños seres de musgo con casco de bellota, mejillas sonrojadas y hélices de hoja. Patrullan sobre las islas. ¡Salta sobre su cabeza para usarlos de trampolín hacia saltos gigantes! Si chocas de lado, te darán un suave empujoncito.
                </li>
                <li>
                  <strong>Zephyr Puffs (Nubes Sopladoras):</strong> Nubes flotantes con alas doradas y trompeta de latón. Inflan sus mejillas y soplan ráfagas de brisa con anillos de viento que ponen a prueba tu equilibrio en los saltos.
                </li>
              </ul>
            </div>

            <button
              onClick={() => setShowHelpModal(false)}
              className="w-full py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold cursor-pointer"
            >
              Entendido / Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
