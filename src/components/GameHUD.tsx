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
  ChevronLeft,
  ChevronRight,
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
  Maximize,
  Minimize,
  RotateCw,
  Undo2,
  Redo2,
  Timer,
  Ghost,
  Flame,
  Clock,
  AlertTriangle,
  ShieldAlert,
  UserRound,
  Backpack as BackpackIcon,
  Trash2,
  ArrowRight,
} from 'lucide-react';
import { GameEngine, GameState, GameMode } from '../game/GameEngine';
import {
  isLevelCompleted,
  isLevelUnlocked,
  levelInfo,
  levelHowTo,
  maxPlayableLevel,
  highestCompleted,
  nextCompanionUnlock,
  ThemeId,
} from '../game/progress';
import { CompanionStyle } from '../game/character';

const THEME_COMPANION: Record<ThemeId, CompanionStyle> = {
  cozy: 'nube',
  cosmic: 'estrella',
  swamp: 'luciernaga',
  aero: 'catarina',
  garden: 'hada',
  castle: 'serpiente',
};
import { INVENTORY_SIZE, ITEM_INFO, InventoryStatus } from '../game/items';
import { CharacterCreator, COMPANION_ICONS } from './CharacterCreator';
import { COMPANION_POWERS, CompanionPowerStatus } from '../game/companionPowers';
import { BodyType, CharacterAppearance, loadAppearance, loadRoster } from '../game/character';
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
    name: 'Hora dorada',
    color: '#f59e0b',
    desc: 'Luz ámbar cálida',
    css: 'sepia(0.28) saturate(1.4) brightness(1.05) contrast(1.05)',
  },
  {
    id: 'dreamy_pastel',
    name: 'Pastel ensueño',
    color: '#a78bfa',
    desc: 'Etéreo y luminoso',
    css: 'brightness(1.12) saturate(1.15) hue-rotate(10deg) contrast(0.95)',
  },
  {
    id: 'cozy_sunset',
    name: 'Atardecer cálido',
    color: '#f43f5e',
    desc: 'Tonos melocotón suaves',
    css: 'sepia(0.35) hue-rotate(-20deg) saturate(1.45) contrast(1.1)',
  },
  {
    id: 'starry_twilight',
    name: 'Noche estelar',
    color: '#38bdf8',
    desc: 'Cielo índigo apacible',
    css: 'brightness(0.9) contrast(1.2) hue-rotate(185deg) saturate(1.3)',
  },
  {
    id: 'vintage_sepia',
    name: 'Película clásica',
    color: '#d97706',
    desc: 'Sepia nostálgico',
    css: 'sepia(0.65) contrast(1.15) brightness(0.95) saturate(0.85)',
  },
];

const VICTORY_TEXT: Record<number, string> = {
  1: 'Has navegado con éxito los jardines flotantes y llegado al Mirador Celestial. Disfruta la vista panorámica de las nubes y las estrellas.',
  2: 'Saltaste entre asteroides y anillos planetarios hasta el Observatorio Estelar. ¡Estelita brilla de alegría!',
  3: 'Cruzaste la bruma del pantano y escalaste la Torre de la Bruja hasta el Santuario de las Luciérnagas.',
  4: 'Cruzaste la pradera, las cascadas y la ciudad de cristal hasta la Plaza del Globo. ¡Los glitches no pudieron contigo!',
};

export const PHOTO_FRAMES: { id: PhotoFrame; name: string; desc: string }[] = [
  { id: 'none', name: 'Sin marco', desc: 'Composición limpia' },
  { id: 'polaroid', name: 'Polaroid', desc: 'Borde blanco clásico' },
  { id: 'cinematic', name: 'Cinemático', desc: 'Barras panorámicas' },
  { id: 'postcard', name: 'Postal', desc: 'Sello aéreo y matasellos' },
  { id: 'grid', name: 'Guía 3×3', desc: 'Regla de los tercios' },
];

interface GameHUDProps {
  engine: GameEngine | null;
  gameState: GameState;
  gameMode?: GameMode;
  timeRemaining?: number;
  timeBonus?: { amount: number; reason: string; timestamp: number } | null;
  stalkerDistance?: number;
  stalkerWarningLevel?: 'none' | 'caution' | 'danger';
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
  onDismissWeatherNotice?: () => void;
  isFullscreen?: boolean;
  toggleFullscreen?: () => void;
  isPortrait?: boolean;
  showEasterEgg?: boolean;
  onDismissEasterEgg?: () => void;
}

// --- 360° Analog Virtual Joystick for Mobile Devices ---
const VirtualJoystick: React.FC<{
  onMove: (forward: number, right: number) => void;
  compact?: boolean;
}> = ({ onMove, compact = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [isActive, setIsActive] = useState(false);
  const touchIdRef = useRef<number | null>(null);

  const maxRadius = compact ? 34 : 45;

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

  useEffect(() => {
    const handleReset = () => {
      touchIdRef.current = null;
      setIsActive(false);
      setKnobPos({ x: 0, y: 0 });
      onMove(0, 0);
    };

    window.addEventListener('resize', handleReset);
    window.addEventListener('blur', handleReset);
    window.addEventListener('orientationchange', handleReset);

    return () => {
      window.removeEventListener('resize', handleReset);
      window.removeEventListener('blur', handleReset);
      window.removeEventListener('orientationchange', handleReset);
      onMove(0, 0);
    };
  }, [onMove]);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      className={`relative rounded-full border-2 transition-all select-none flex items-center justify-center ${
        compact ? 'w-22 h-22 w-[5.5rem] h-[5.5rem]' : 'w-28 h-28 sm:w-32 sm:h-32'
      } ${
        isActive
          ? 'bg-amber-950/40 border-amber-400 shadow-xl shadow-amber-500/20'
          : 'bg-stone-900/55 border-stone-700/60 shadow-lg backdrop-blur-sm'
      }`}
      style={{ touchAction: 'none' }}
    >
      {!compact && (
        <>
          <span className="absolute top-2 text-[9px] text-stone-500 font-mono">W</span>
          <span className="absolute bottom-2 text-[9px] text-stone-500 font-mono">S</span>
          <span className="absolute left-2 text-[9px] text-stone-500 font-mono">A</span>
          <span className="absolute right-2 text-[9px] text-stone-500 font-mono">D</span>
        </>
      )}

      <div
        className={`rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-md border-2 border-amber-200 pointer-events-none flex items-center justify-center ${
          compact ? 'w-10 h-10' : 'w-12 h-12 sm:w-14 sm:h-14'
        }`}
        style={{
          transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
          transition: isActive ? 'none' : 'transform 0.15s ease-out',
        }}
      >
        <div className={`rounded-full bg-amber-100/70 ${compact ? 'w-3 h-3' : 'w-4 h-4'}`} />
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
        ctx.fillText('Cozy Leap · ' + checkpointName, canvas.width / 2, canvas.height - bottomY * 0.38);

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
        ctx.fillText('COZY LEAP · ' + checkpointName.toUpperCase(), canvas.width / 2, canvas.height - barHeight * 0.36);

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
  gameMode = 'free',
  timeRemaining = 90,
  timeBonus = null,
  stalkerDistance = 999,
  stalkerWarningLevel = 'none',
  checkpointName,
  checkpointIndex,
  collectedCount,
  totalCollectibles,
  currentWeather,
  isWeatherTransitioning = false,
  weatherNotice = null,
  onDismissWeatherNotice,
  isFullscreen = false,
  toggleFullscreen,
  isPortrait = false,
  showEasterEgg = false,
  onDismissEasterEgg,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [selectedMode, setSelectedMode] = useState<GameMode>('free');
  type TitleStep = 'main' | 'select_level' | 'game_modes' | 'select_character';
  const [titleStep, setTitleStep] = useState<TitleStep>('main');
  const [pendingLevel, setPendingLevel] = useState<number>(() => maxPlayableLevel());
  const [pendingMode, setPendingMode] = useState<GameMode>('free');
  const [previousTitleStep, setPreviousTitleStep] = useState<'main' | 'select_level' | 'game_modes'>('main');

  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showLevelBrief, setShowLevelBrief] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isSprintActive, setIsSprintActive] = useState(false);
  const [dismissPortraitHint, setDismissPortraitHint] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [viewportNarrow, setViewportNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 900 : false
  );
  const briefLevelRef = useRef<number | null>(null);

  useEffect(() => {
    const onResize = () => setViewportNarrow(window.innerWidth < 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!isPortrait) setDismissPortraitHint(false);
  }, [isPortrait]);

  useEffect(() => {
    if (gameState !== 'playing' || !engine) return;
    const lvl = engine.currentLevel;
    if (briefLevelRef.current === lvl) return;
    briefLevelRef.current = lvl;
    setShowLevelBrief(true);
  }, [gameState, engine, engine?.currentLevel]);

  useEffect(() => {
    if (gameState === 'title') briefLevelRef.current = null;
  }, [gameState]);

  // Character Generator
  const [showCreator, setShowCreator] = useState(false);
  const [appearance, setAppearance] = useState<CharacterAppearance>(() => engine?.playerAppearance ?? loadAppearance());

  const openCreator = () => {
    setShowCreator(true);
    engine?.setCharacterPreview(true);
  };

  const closeCreator = () => {
    setShowCreator(false);
    if (titleStep !== 'select_character') {
      engine?.setCharacterPreview(false);
    }
  };

  const handleAppearanceChange = (next: CharacterAppearance) => {
    setAppearance(next);
    engine?.setPlayerAppearance(next);
  };

  // Chico / Chica: each keeps its own saved customization
  const handleSwitchBody = (body: BodyType) => {
    const next = loadRoster()[body];
    setAppearance(next);
    engine?.setPlayerAppearance(next);
  };

  // The creator only lives on the title screen
  useEffect(() => {
    if (gameState !== 'title' && showCreator) {
      setShowCreator(false);
      engine?.setCharacterPreview(false);
    }
  }, [gameState, showCreator, engine]);

  const showToast = (msg: string, ms: number = 1200) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, ms);
  };

  // Companion power status (polled from the engine while playing)
  const [power, setPower] = useState<CompanionPowerStatus | null>(null);
  const lastPowerEventRef = useRef<number>(0);
  useEffect(() => {
    if (!engine || gameState !== 'playing') return;
    const read = () => {
      const st = engine.companionPowers?.getStatus();
      if (!st) return;
      setPower((prev) =>
        prev &&
        prev.state === st.state &&
        prev.companion === st.companion &&
        prev.eventId === st.eventId &&
        Math.abs(prev.timeLeft - st.timeLeft) < 0.1
          ? prev
          : st
      );
      if (st.eventId !== lastPowerEventRef.current) {
        lastPowerEventRef.current = st.eventId;
        if (st.eventText) showToast(st.eventText, 2200);
      }
    };
    read();
    const id = window.setInterval(read, 100);
    return () => window.clearInterval(id);
  }, [engine, gameState]);
  const powerInfo = power ? COMPANION_POWERS[power.companion] : undefined;

  // Backpack (5 slots) status, polled with the same rhythm
  // Open-world levels: orbs found / total
  const [orbs, setOrbs] = useState<{ have: number; total: number; summitOpen: boolean }>({ have: 0, total: 0, summitOpen: false });
  useEffect(() => {
    if (!engine || gameState !== 'playing') return;
    const read = () => {
      const st = engine.puzzleSystem?.getOrbStatus();
      if (!st) return;
      setOrbs((prev) => (prev.have === st.have && prev.total === st.total && prev.summitOpen === st.summitOpen ? prev : st));
    };
    read();
    const id = window.setInterval(read, 200);
    return () => window.clearInterval(id);
  }, [engine, gameState]);

  const [inventory, setInventory] = useState<InventoryStatus | null>(null);
  const [showBackpack, setShowBackpack] = useState(false);
  const lastItemEventRef = useRef<number>(0);
  useEffect(() => {
    if (!engine || gameState !== 'playing') return;
    const read = () => {
      const st = engine.itemSystem?.getStatus();
      if (!st) return;
      setInventory((prev) =>
        prev &&
        prev.eventId === st.eventId &&
        prev.slots.every((v, i) => v === st.slots[i]) &&
        Math.ceil(prev.superJumpLeft) === Math.ceil(st.superJumpLeft)
          ? prev
          : st
      );
      if (st.eventId !== lastItemEventRef.current) {
        lastItemEventRef.current = st.eventId;
        if (st.eventText) showToast(st.eventText, 2200);
      }
    };
    read();
    const id = window.setInterval(read, 100);
    return () => window.clearInterval(id);
  }, [engine, gameState]);

  // Toggle backpack panel with the I key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.code === 'KeyI' && gameState === 'playing') setShowBackpack((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gameState]);

  // Level selection on the title screen (the world behind the menu switches too)
  // Default to the furthest level reached ("continue")
  const [selectedLevel, setSelectedLevel] = useState<number>(() => maxPlayableLevel());
  const pickLevel = (id: number) => {
    setSelectedLevel(id);
    engine?.loadLevel(id);
  };
  // Show the selected level behind the title menu once the engine exists
  useEffect(() => {
    if (engine && gameState === 'title' && engine.currentLevel !== selectedLevel && isLevelUnlocked(selectedLevel)) {
      engine.loadLevel(selectedLevel);
    }
  }, [engine, gameState]);

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

  // Freeze and lock player movement when any modal, pause, or victory screen is active
  const isAnyModalOpen =
    showHelpModal ||
    showLevelBrief ||
    showEasterEgg ||
    showBackpack ||
    showCreator ||
    Boolean(capturedPhotoUrl) ||
    gameState === 'paused' ||
    gameState === 'victory' ||
    gameState === 'game_over' ||
    gameState === 'photo_mode';

  const currentHowTo = levelHowTo(engine?.currentLevel ?? pendingLevel);

  useEffect(() => {
    if (engine) {
      engine.setUIModalOpen(isAnyModalOpen);
    }
  }, [engine, isAnyModalOpen]);

  // Auto-detect mobile touch screen based on touch capabilities (not window size)
  const [touchControlsEnabled, setTouchControlsEnabled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      'ontouchstart' in window ||
      (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ||
      (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches)
    );
  });
  const [isTouchDevice] = useState(() =>
    typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
  );

  const isMobileUi = touchControlsEnabled || isTouchDevice || viewportNarrow;
  const isPortraitPlay = isPortrait;
  const compactControls = isMobileUi && isPortraitPlay;
  const filledSlots = inventory?.slots.filter(Boolean).length ?? 0;
  const showPortraitHint =
    isMobileUi &&
    isPortraitPlay &&
    !dismissPortraitHint &&
    !showCreator &&
    (gameState === 'playing' || gameState === 'title');

  // Switch dynamically if user uses touch or keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const gameKeys = [
        'KeyW', 'KeyA', 'KeyS', 'KeyD',
        'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
        'Space', 'ShiftLeft', 'ShiftRight',
        'KeyQ', 'KeyE', 'KeyR', 'KeyC', 'KeyG', 'KeyI', 'Escape'
      ];
      if (gameKeys.includes(e.code)) {
        if (isTouchDevice) return;
        if (typeof window.matchMedia === 'function' && !window.matchMedia('(pointer: coarse)').matches) {
          setTouchControlsEnabled(false);
        }
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
  }, [isTouchDevice]);

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

  // Global Keyboard shortcuts: H (photo UI), Space (snap), F (fullscreen)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Ignore shortcuts while typing (e.g. the character name field)
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.code === 'KeyH') {
        if (gameState === 'photo_mode') {
          setHidePhotoUI((prev) => !prev);
        }
      }
      if (e.code === 'KeyF') {
        if (toggleFullscreen) {
          toggleFullscreen();
          showToast(!isFullscreen ? 'Pantalla Completa' : 'Modo Ventana');
        }
      }
      if (gameState === 'photo_mode' && (e.code === 'Space' || e.code === 'Enter') && !capturedPhotoUrl) {
        handleSnapPhoto();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gameState, photoFilter, photoFrame, capturedPhotoUrl, isFullscreen, toggleFullscreen]);

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
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundManager.setMuted(next);
  };

  const handleStartGame = (modeToStart?: GameMode, levelToStart?: number) => {
    const targetMode = modeToStart ?? pendingMode;
    const targetLevel = levelToStart ?? pendingLevel;
    if (engine) {
      engine.setCharacterPreview(false);
      engine.startGame(targetMode, targetLevel);
    }
  };

  const handleRestart = (modeToRestart?: GameMode) => {
    setElapsedTime(0);
    const targetMode = modeToRestart ?? gameMode;
    if (engine) engine.restartGame(targetMode);
  };

  const handleReturnToTitle = () => {
    setElapsedTime(0);
    setTitleStep('main');
    if (engine) {
      engine.setCharacterPreview(false);
      engine.returnToTitle();
    }
  };

  const handleWeatherSelect = (w: WeatherType) => {
    if (engine) engine.setWeather(w);
  };

  const handleWarpCheckpoint = (idx: number) => {
    if (engine) engine.warpToCheckpoint(idx);
  };

  const handleJoystickMove = React.useCallback((forward: number, right: number) => {
    if (engine) {
      engine.setVirtualInput({ forward, right });
    }
  }, [engine]);

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-10 overflow-hidden font-['Outfit',sans-serif]">
      {showPortraitHint && (
        <div className="absolute inset-0 z-[60] pointer-events-auto flex items-end sm:items-center justify-center p-4 pt-safe pb-safe bg-stone-950/55 backdrop-blur-[2px]">
          <div className="w-full max-w-sm rounded-3xl bg-stone-900/95 border border-amber-500/35 shadow-2xl p-5 text-stone-100 flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-amber-300 animate-[tilt-phone_1.6s_ease-in-out_infinite]">
              <Smartphone className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-serif font-bold text-amber-200 mb-1">Gira tu dispositivo</h3>
              <p className="text-xs text-stone-300 leading-relaxed">
                Cozy Leap se ve y se controla mucho mejor en horizontal. Activa la rotación del móvil y gira la pantalla físicamente.
              </p>
            </div>
            <div className="w-full flex flex-col gap-2">
              {toggleFullscreen && (
                <button
                  type="button"
                  onClick={() => {
                    toggleFullscreen();
                    showToast(!isFullscreen ? 'Pantalla Completa' : 'Modo Ventana');
                  }}
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm cursor-pointer flex items-center justify-center gap-2"
                >
                  {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                  {isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setDismissPortraitHint(true)}
                className="w-full py-2.5 rounded-xl bg-stone-950/50 border border-stone-700 text-stone-300 hover:text-stone-100 hover:border-stone-500 text-xs font-semibold cursor-pointer"
              >
                Continuar en vertical
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. TITLE SCREEN OVERLAY                                  */}
      {/* ======================================================== */}
      {gameState === 'title' && showCreator && (
        <CharacterCreator
          appearance={appearance}
          onChange={handleAppearanceChange}
          onSwitchBody={handleSwitchBody}
          onClose={closeCreator}
          portrait={isPortrait}
        />
      )}

      {gameState === 'title' && !showCreator && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-gradient-to-t from-stone-950/85 via-stone-950/45 to-stone-950/20 text-stone-100 p-3 sm:p-6 pt-safe pb-safe transition-opacity duration-500 overflow-y-auto font-['Outfit',sans-serif]">
          {isMobileUi && toggleFullscreen && (
            <div className="absolute top-safe right-0 pt-3 pr-3 pr-safe flex items-center gap-1.5 z-20">
              <button
                type="button"
                onClick={() => {
                  toggleFullscreen();
                  showToast(!isFullscreen ? 'Pantalla Completa' : 'Modo Ventana');
                }}
                title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
                className="p-2 rounded-xl bg-stone-900/80 border border-stone-700 text-amber-300 cursor-pointer"
              >
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>
            </div>
          )}
          <div className="w-full max-w-sm rounded-3xl bg-stone-950/90 border border-stone-800/90 p-5 sm:p-6 shadow-2xl backdrop-blur-xl flex flex-col my-auto transition-all animate-in fade-in zoom-in-95">

            {/* ======================================================== */}
            {/* STEP 1: MENÚ PRINCIPAL (Limpio, Mobile-First)             */}
            {/* ======================================================== */}
            {titleStep === 'main' && (
              <div className="flex flex-col items-center text-center">
                {/* Header Lockup */}
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-900/80 border border-amber-600/30 text-[10px] text-amber-200 font-semibold tracking-wider mb-2">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Parkour en las nubes</span>
                </div>

                <h1
                  className="font-serif font-black text-3xl sm:text-4xl text-amber-100 tracking-wide drop-shadow-md mb-1"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  Cozy Leap
                </h1>
                <p className="text-xs text-stone-400 font-light tracking-wide mb-6">
                  Parkour en las nubes
                </p>

                {/* Main Action Buttons */}
                <div className="w-full flex flex-col gap-2.5">
                  {/* 1. Continuar aventura (Sólo si tiene más de 1 nivel desbloqueado) */}
                  {maxPlayableLevel() > 1 && (
                    <button
                      onClick={() => {
                        const lvl = maxPlayableLevel();
                        setPendingLevel(lvl);
                        setPendingMode('free');
                        engine?.loadLevel(lvl);
                        engine?.setCharacterPreview(true);
                        setPreviousTitleStep('main');
                        setTitleStep('select_character');
                      }}
                      className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/40 to-stone-900/90 hover:from-emerald-900/50 hover:to-stone-850 border border-emerald-700/50 shadow-lg text-left transition-all active:scale-[0.98] cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-emerald-900/50 border border-emerald-600/40 flex items-center justify-center text-emerald-300 shrink-0">
                          <Play className="w-5 h-5 fill-emerald-300" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-emerald-100">Continuar aventura</span>
                          <span className="text-[10px] text-stone-300 truncate font-medium">
                            Nivel {maxPlayableLevel()} · {levelInfo(maxPlayableLevel()).name}
                          </span>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-emerald-300 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  )}

                  {/* 2. Nueva partida / Comenzar aventura */}
                  <button
                    onClick={() => {
                      setPendingLevel(1);
                      setPendingMode('free');
                      engine?.loadLevel(1);
                      engine?.setCharacterPreview(true);
                      setPreviousTitleStep('main');
                      setTitleStep('select_character');
                    }}
                    className={`w-full flex items-center justify-between p-3.5 rounded-2xl transition-all active:scale-[0.98] shadow-lg cursor-pointer group ${
                      maxPlayableLevel() > 1
                        ? 'bg-stone-900/90 hover:bg-stone-850 border border-stone-800 hover:border-amber-500/40'
                        : 'bg-amber-600 hover:bg-amber-500 text-stone-950 shadow-amber-950/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          maxPlayableLevel() > 1 ? 'bg-amber-500/20 border border-amber-500/30 text-amber-300' : 'bg-stone-950/20 text-stone-950'
                        }`}
                      >
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col text-left">
                        <span className={`text-sm font-bold ${maxPlayableLevel() > 1 ? 'text-stone-100' : 'text-stone-950 font-extrabold'}`}>
                          {maxPlayableLevel() > 1 ? 'Nueva aventura' : 'Comenzar aventura'}
                        </span>
                        <span className={`text-[10px] ${maxPlayableLevel() > 1 ? 'text-stone-400' : 'text-stone-900/80 font-medium'}`}>
                          Nivel 1: Archipiélago Acogedor
                        </span>
                      </div>
                    </div>
                    <ArrowRight className={`w-4 h-4 shrink-0 group-hover:translate-x-0.5 transition-transform ${maxPlayableLevel() > 1 ? 'text-stone-400' : 'text-stone-950'}`} />
                  </button>

                  {/* 3. Seleccionar nivel */}
                  <button
                    onClick={() => setTitleStep('select_level')}
                    className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-stone-900/90 hover:bg-stone-850 border border-stone-800 hover:border-amber-600/40 transition-all active:scale-[0.98] cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-900/20 border border-amber-700/30 flex items-center justify-center text-amber-300 shrink-0">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="text-sm font-bold text-stone-100">Seleccionar nivel</span>
                        <span className="text-[10px] text-stone-400">{maxPlayableLevel()} {maxPlayableLevel() === 1 ? 'nivel desbloqueado' : 'niveles desbloqueados'}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  {/* 4. Modos de juego */}
                  <button
                    onClick={() => setTitleStep('game_modes')}
                    className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-stone-900/90 hover:bg-stone-850 border border-stone-800 hover:border-amber-600/40 transition-all active:scale-[0.98] cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-950/40 border border-orange-800/40 flex items-center justify-center text-orange-400 shrink-0">
                        <Flame className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="text-sm font-bold text-stone-100">Modos de juego</span>
                        <span className="text-[10px] text-stone-400">Contrarreloj y persecución</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>

                {/* Subtle mobile hint */}
                <p className="text-[10px] text-stone-500 mt-5">
                  Toca para explorar · Compatible con control táctil y teclado
                </p>
              </div>
            )}

            {/* ======================================================== */}
            {/* STEP 2: SELECCIONAR NIVEL                                */}
            {/* ======================================================== */}
            {titleStep === 'select_level' && (
              <div className="flex flex-col">
                {/* Step Header */}
                <div className="flex items-center justify-between border-b border-stone-800 pb-3 mb-3">
                  <button
                    onClick={() => setTitleStep('main')}
                    className="flex items-center gap-1 text-xs font-semibold text-amber-300 hover:text-amber-200 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Volver</span>
                  </button>
                  <span className="text-sm font-bold text-stone-100 font-serif">Seleccionar nivel</span>
                  <span className="text-[10px] text-stone-400 font-mono">{maxPlayableLevel()} disp.</span>
                </div>

                {/* Level Cards List */}
                <div className="flex flex-col gap-2 max-h-[56vh] overflow-y-auto pr-1">
                  {Array.from({ length: maxPlayableLevel() }, (_, i) => i + 1).map((lvl) => {
                    const info = levelInfo(lvl);
                    const completed = isLevelCompleted(lvl);
                    return (
                      <button
                        key={lvl}
                        onClick={() => {
                          setPendingLevel(lvl);
                          setPendingMode('free');
                          engine?.loadLevel(lvl);
                          engine?.setCharacterPreview(true);
                          setPreviousTitleStep('select_level');
                          setTitleStep('select_character');
                        }}
                        className="flex items-center gap-3 p-3 rounded-2xl bg-stone-900/85 hover:bg-stone-850 border border-stone-800 hover:border-amber-500/40 transition-all text-left cursor-pointer active:scale-[0.98] group"
                      >
                        <span
                          className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0"
                          style={{ backgroundColor: `${info.accent}25`, color: info.accent }}
                        >
                          {lvl}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-stone-100 truncate">{info.name}</div>
                          <div className="text-[10px] text-stone-400 truncate">{info.desc}</div>
                        </div>
                        {completed ? (
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-700/40 shrink-0">
                            ✓ Hecho
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-600/40 shrink-0">
                            Jugar →
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* STEP 3: MODOS DE JUEGO                                   */}
            {/* ======================================================== */}
            {titleStep === 'game_modes' && (
              <div className="flex flex-col">
                {/* Step Header */}
                <div className="flex items-center justify-between border-b border-stone-800 pb-3 mb-3">
                  <button
                    onClick={() => setTitleStep('main')}
                    className="flex items-center gap-1 text-xs font-semibold text-amber-300 hover:text-amber-200 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Volver</span>
                  </button>
                  <span className="text-sm font-bold text-stone-100 font-serif">Modos de juego</span>
                  <span className="w-10" />
                </div>

                <p className="text-[11px] text-stone-400 text-center mb-3">
                  Elige el desafío que deseas conquistar
                </p>

                <div className="flex flex-col gap-3">
                  {/* Mode 1: Contrarreloj */}
                  <button
                    onClick={() => {
                      setPendingMode('time_trial');
                      setPendingLevel(maxPlayableLevel());
                      engine?.loadLevel(maxPlayableLevel());
                      engine?.setCharacterPreview(true);
                      setPreviousTitleStep('game_modes');
                      setTitleStep('select_character');
                    }}
                    className="flex flex-col p-3.5 rounded-2xl bg-stone-900/90 hover:bg-stone-850 border border-stone-800 hover:border-amber-500/40 transition-all text-left cursor-pointer active:scale-[0.98] group"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 text-amber-400">
                        <Clock className="w-5 h-5" />
                        <span className="text-sm font-bold text-stone-100">Contrarreloj</span>
                      </div>
                      <span className="text-[10px] font-bold text-amber-300 bg-amber-950/70 border border-amber-600/40 px-2 py-0.5 rounded-full">
                        90s
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-300 leading-snug">
                      Empiezas con 90s. Consigue +8s por reliquia y +15s por punto de control. ¿Llegarás a la cima antes de que el reloj marque 0?
                    </p>
                  </button>

                  {/* Mode 2: Persecución */}
                  <button
                    onClick={() => {
                      setPendingMode('chase');
                      setPendingLevel(maxPlayableLevel());
                      engine?.loadLevel(maxPlayableLevel());
                      engine?.setCharacterPreview(true);
                      setPreviousTitleStep('game_modes');
                      setTitleStep('select_character');
                    }}
                    className="flex flex-col p-3.5 rounded-2xl bg-stone-900/90 hover:bg-stone-850 border border-stone-800 hover:border-orange-600/40 transition-all text-left cursor-pointer active:scale-[0.98] group"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 text-orange-400">
                        <Ghost className="w-5 h-5" />
                        <span className="text-sm font-bold text-stone-100">Persecución</span>
                      </div>
                      <span className="text-[10px] font-bold text-orange-300 bg-stone-950/70 border border-orange-700/40 px-2 py-0.5 rounded-full">
                        Acechador
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-300 leading-snug">
                      Un Acechador Sombrío te persigue por todo el archipiélago. Si te alcanza, te expulsará de la plataforma.
                    </p>
                  </button>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* STEP 4: SELECCIONAR PERSONAJE (Procedural)               */}
            {/* ======================================================== */}
            {titleStep === 'select_character' && (
              <div className="flex flex-col text-center">
                {/* Step Header */}
                <div className="flex items-center justify-between border-b border-stone-800 pb-3 mb-3">
                  <button
                    onClick={() => {
                      engine?.setCharacterPreview(false);
                      setTitleStep(previousTitleStep);
                    }}
                    className="flex items-center gap-1 text-xs font-semibold text-amber-300 hover:text-amber-200 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Atrás</span>
                  </button>
                  <span className="text-xs font-semibold text-stone-300 truncate max-w-[11rem]">
                    {pendingMode === 'time_trial'
                      ? '⏱️ Contrarreloj'
                      : pendingMode === 'chase'
                      ? '👁️ Persecución'
                      : `Nivel ${pendingLevel}`}
                  </span>
                </div>

                <h2 className="text-xl font-serif font-bold text-amber-200 mb-1">Elige a tu personaje</h2>
                <p className="text-[11px] text-stone-400 mb-4">
                  Selecciona a tu viajero antes de saltar al mundo
                </p>

                {/* 1-Tap Body Switcher (Chico / Chica) */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-stone-900 rounded-2xl border border-stone-800 mb-4">
                  <button
                    type="button"
                    onClick={() => handleSwitchBody('chico')}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                      appearance.bodyType === 'chico'
                        ? 'bg-amber-600 text-stone-950 shadow-md'
                        : 'text-stone-300 hover:text-white'
                    }`}
                  >
                    <span>👦 Chico</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchBody('chica')}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                      appearance.bodyType === 'chica'
                        ? 'bg-amber-600 text-stone-950 shadow-md'
                        : 'text-stone-300 hover:text-white'
                    }`}
                  >
                    <span>👧 Chica</span>
                  </button>
                </div>

                {/* Character Snapshot & Details Button */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-900/90 border border-stone-800 mb-5">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-10 h-10 rounded-xl flex items-center justify-center border border-stone-950/40 shadow-inner shrink-0"
                      style={{ background: `linear-gradient(135deg, ${appearance.sweaterColor}, ${appearance.scarfColor})` }}
                    >
                      <UserRound className="w-5 h-5 text-stone-950" />
                    </span>
                    <div className="flex flex-col text-left min-w-0">
                      <span className="text-xs font-bold text-stone-100 truncate">
                        {appearance.name || (appearance.bodyType === 'chico' ? 'Viajero' : 'Viajera')}
                      </span>
                      <span className="text-[10px] text-amber-300 font-medium capitalize truncate">
                        {appearance.companion !== 'ninguno' ? `Compañero: ${appearance.companion}` : 'Sin compañero'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={openCreator}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-300 text-xs font-semibold cursor-pointer transition-colors border border-stone-700 shrink-0"
                  >
                    <Palette className="w-3.5 h-3.5" />
                    <span>Editar aspecto</span>
                  </button>
                </div>

                {/* Big Final Start CTA */}
                <button
                  type="button"
                  onClick={() => handleStartGame(pendingMode, pendingLevel)}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-sm sm:text-base transition-all active:scale-[0.98] shadow-xl shadow-amber-950/50 cursor-pointer"
                >
                  <Play className="w-5 h-5 fill-stone-950" />
                  <span>
                    {previousTitleStep === 'main' && maxPlayableLevel() > 1 && pendingLevel === maxPlayableLevel()
                      ? '¡Continuar viaje!'
                      : '¡Comenzar viaje!'}
                  </span>
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. PLAYING / ACTIVE STATUS CLUSTERS (World-Matched UI)  */}
      {/* ======================================================== */}
      {gameState === 'playing' && (
        <>
          {/* Top-Left Cluster: Mode Badge, Checkpoint, Collectibles, Time/Radar */}
          <div className={`absolute top-safe left-0 flex flex-col gap-1.5 sm:gap-2 pointer-events-auto pl-safe ${isMobileUi ? 'pt-2 pl-2 max-w-[58vw] sm:max-w-none' : 'top-4 left-4 pl-4 pt-4'}`}>
            {/* Stage & Checkpoint Badge */}
            <div className={`flex items-center gap-2 rounded-xl bg-stone-900/85 border border-stone-800/80 text-stone-200 text-xs shadow-md backdrop-blur-md ${isMobileUi ? 'px-2 py-1' : 'px-3 py-1.5'}`}>
              <MapPin className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] text-stone-400 font-medium uppercase tracking-wider truncate">
                  Nivel {engine?.currentLevel ?? 1} · {orbs.total > 0 ? 'Mundo abierto' : `Punto ${checkpointIndex}/3`}
                </span>
                <span className={`font-semibold text-stone-100 truncate ${isMobileUi ? 'text-[11px]' : 'text-xs sm:text-sm'}`}>{checkpointName}</span>
              </div>
            </div>

            {/* Open-world objective: orbs */}
            {orbs.total > 0 && (
              <div
                className={`flex items-center gap-2 rounded-xl border text-xs shadow-md backdrop-blur-md ${
                  isMobileUi ? 'px-2 py-1' : 'px-3 py-1.5'
                } ${
                  orbs.summitOpen ? 'bg-amber-950/85 border-amber-400/70 text-amber-100' : 'bg-violet-950/80 border-violet-400/50 text-violet-100'
                }`}
              >
                <span className="text-base leading-none">{orbs.summitOpen ? '🌪️' : '🔮'}</span>
                <div className="flex flex-col min-w-0">
                  <span className="text-[9px] uppercase tracking-wider opacity-75 font-semibold">
                    {orbs.summitOpen ? '¡Cima abierta!' : 'Orbes'}
                  </span>
                  <span className={`font-semibold tabular-nums ${isMobileUi ? 'text-[11px] truncate' : ''}`}>
                    {orbs.summitOpen
                      ? isMobileUi
                        ? '¡Sube a la cima!'
                        : 'La fortaleza está abierta: ¡sube a la cima!'
                      : `${orbs.have}/${orbs.total}`}
                  </span>
                </div>
              </div>
            )}

            {/* Mode-Specific Status Banner */}
            {gameMode === 'time_trial' && (
              <div
                className={`relative flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-colors shadow-md backdrop-blur-md ${
                  timeRemaining <= 20
                    ? 'bg-red-950/90 border-red-500/80 text-red-200 animate-pulse'
                    : 'bg-amber-950/80 border-amber-500/50 text-amber-200'
                }`}
              >
                <Clock className={`w-3.5 h-3.5 ${timeRemaining <= 20 ? 'text-red-400' : 'text-amber-400'}`} />
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">Tiempo:</span>
                  <span className="font-mono font-black text-sm tracking-wide">
                    {timeRemaining > 0 ? `${timeRemaining}s` : '0s'}
                  </span>
                </div>

                {/* Animated Time Bonus Pill */}
                {timeBonus && (
                  <div className="absolute left-full ml-2 px-2.5 py-0.5 rounded-full bg-emerald-500 text-stone-950 text-[11px] font-extrabold shadow-lg animate-bounce whitespace-nowrap">
                    +{timeBonus.amount}s {timeBonus.reason}
                  </div>
                )}
              </div>
            )}

            {gameMode === 'chase' && (
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all shadow-md backdrop-blur-md ${
                  stalkerWarningLevel === 'danger'
                    ? 'bg-rose-950/95 border-rose-500 text-rose-200 animate-pulse ring-2 ring-rose-500/50'
                    : stalkerWarningLevel === 'caution'
                    ? 'bg-amber-950/85 border-amber-500/60 text-amber-200'
                    : 'bg-stone-900/85 border-stone-800 text-stone-300'
                }`}
              >
                {stalkerWarningLevel === 'danger' ? (
                  <Flame className="w-4 h-4 text-rose-400 animate-bounce" />
                ) : (
                  <Ghost className="w-3.5 h-3.5 text-rose-400" />
                )}
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold uppercase tracking-wider">
                    {stalkerWarningLevel === 'danger'
                      ? '🚨 ¡Acechador cerca!'
                      : stalkerWarningLevel === 'caution'
                      ? '⚠️ Acechador próximo'
                      : 'Acechador Sombrío'}
                  </span>
                  <span className="font-mono text-xs font-semibold">
                    {stalkerDistance < 100 ? `${stalkerDistance.toFixed(1)}m` : 'Buscándote...'}
                  </span>
                </div>
              </div>
            )}

            {/* Sun Crystals / Acorns Collectibles & Timer */}
            <div className={`flex items-center rounded-xl bg-stone-900/85 border border-stone-800/80 text-xs text-stone-300 shadow-md backdrop-blur-md ${isMobileUi ? 'gap-2 px-2 py-1' : 'gap-3 px-3 py-1.5'}`}>
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="tabular-nums font-semibold text-amber-300">
                  {collectedCount}/{totalCollectibles}
                </span>
              </div>
              <div className="w-[1px] h-3 bg-stone-700/60" />
              <div className="flex items-center gap-1 font-mono text-stone-300">
                <Timer className="w-3 h-3 text-stone-400" />
                <span>{formatTime(elapsedTime)}</span>
              </div>
            </div>

            {/* Companion Power badge (hidden on mobile touch — action button covers it) */}
            {power && powerInfo && !touchControlsEnabled && (
              <button
                type="button"
                onClick={() => engine?.activateCompanionPower()}
                title={`${powerInfo.powerName}: ${powerInfo.desc}`}
                className={`relative overflow-hidden flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-xl border text-left text-xs shadow-md backdrop-blur-md transition-colors cursor-pointer ${
                  power.state === 'ready'
                    ? 'bg-stone-900/85 border-amber-400/70 hover:bg-stone-800'
                    : power.state === 'active'
                    ? 'bg-stone-900/90 border-emerald-400/70'
                    : 'bg-stone-900/80 border-stone-700'
                }`}
              >
                {power.state === 'active' && (
                  <span
                    className="absolute left-0 bottom-0 h-[3px] bg-emerald-400 transition-[width] duration-100"
                    style={{ width: `${Math.max(0, (power.timeLeft / power.duration) * 100)}%` }}
                  />
                )}
                <span
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-stone-900 ${
                    power.state === 'hungry' ? 'opacity-50 grayscale' : ''
                  } ${power.state === 'active' ? 'animate-pulse' : ''}`}
                  style={{ backgroundColor: powerInfo.color }}
                >
                  {COMPANION_ICONS[power.companion]}
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-[9px] uppercase tracking-wider text-stone-400 font-semibold">
                    {powerInfo.companionName} · {powerInfo.powerName}
                  </span>
                  <span
                    className={`font-semibold ${
                      power.state === 'ready'
                        ? 'text-amber-300'
                        : power.state === 'active'
                        ? 'text-emerald-300'
                        : 'text-stone-400'
                    }`}
                  >
                    {power.state === 'ready' && (
                      <>
                        ¡Listo! <span className="ml-1 px-1.5 rounded bg-stone-800 border border-stone-700 font-mono text-[10px] text-stone-200">G</span>
                      </>
                    )}
                    {power.state === 'active' && `Activo · ${Math.ceil(power.timeLeft)}s`}
                    {power.state === 'hungry' && 'Con hambre · dale una baya 🍇'}
                  </span>
                </span>
              </button>
            )}
          </div>

          {/* Top-Right Cluster: Quick Actions */}
          <div className={`absolute top-safe right-0 flex flex-wrap items-center justify-end gap-1.5 sm:gap-2 pointer-events-auto pr-safe ${isMobileUi ? 'pt-2 pr-2 max-w-[55vw]' : 'top-4 right-4 pr-4 pt-4'}`}>
            {isMobileUi && toggleFullscreen && (
              <button
                onClick={() => {
                  toggleFullscreen();
                  showToast(!isFullscreen ? 'Pantalla Completa' : 'Modo Ventana');
                }}
                title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
                className="p-2 sm:p-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-md cursor-pointer"
              >
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>
            )}
            <button
              onClick={() => engine?.setPaused(true)}
              title="Pausa"
              className="p-2 sm:p-2.5 rounded-xl bg-stone-900/80 border border-stone-800 hover:bg-stone-800 text-stone-200 transition-colors shadow-md cursor-pointer"
            >
              <Pause className="w-4 h-4" />
            </button>
            <button
              onClick={() => engine?.enterPhotoMode()}
              title="Modo foto (tecla P)"
              className="p-2 sm:p-2.5 rounded-xl bg-stone-900/80 border border-stone-800 hover:bg-stone-800 text-stone-200 transition-colors shadow-md cursor-pointer"
            >
              <Camera className="w-4 h-4 text-amber-400" />
            </button>
            {!compactControls && (
              <button
                onClick={() => setShowHelpModal(true)}
                title="Guía y controles"
                className="p-2 sm:p-2.5 rounded-xl bg-stone-900/80 border border-stone-800 hover:bg-stone-800 text-amber-300 transition-colors shadow-md cursor-pointer"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            )}
            {!compactControls && (
              <button
                onClick={() => engine?.physics.respawnAtCheckpoint()}
                title="Reiniciar en punto de control (R)"
                className="p-2 sm:p-2.5 rounded-xl bg-stone-900/80 border border-stone-800 hover:bg-stone-800 text-stone-300 transition-colors shadow-md cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Discreet, Fast-Dismissing Micro Toast (Milestones & In-Game Alerts) */}
          {(weatherNotice || toastMessage) && (
            <div
              onClick={() => {
                if (onDismissWeatherNotice) onDismissWeatherNotice();
                setToastMessage(null);
              }}
              className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-auto z-30 transition-all duration-200 ease-out animate-in fade-in zoom-in-95 cursor-pointer max-w-[80vw]"
              title="Toca para descartar"
            >
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-stone-900/90 border border-amber-500/35 text-stone-100 text-[11px] font-medium shadow-lg backdrop-blur-md">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">
                  {toastMessage || (weatherNotice ? `${weatherNotice.title}` : '')}
                </span>
                <span className="text-[9px] text-stone-500 hover:text-stone-300 ml-1">✕</span>
              </div>
            </div>
          )}

          {/* BACKPACK — compact FAB on mobile, full hotbar on desktop */}
          {inventory && (
            <div
              className={`absolute flex flex-col items-center gap-1.5 pointer-events-auto z-20 ${
                isMobileUi
                  ? compactControls
                    ? 'right-2 bottom-[11.5rem] items-end pr-safe'
                    : 'left-1/2 -translate-x-1/2 bottom-4 pb-safe'
                  : 'left-1/2 -translate-x-1/2 bottom-4'
              }`}
            >
              {inventory.superJumpLeft > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-stone-950 text-[10px] font-bold shadow">
                  🌰 {Math.ceil(inventory.superJumpLeft)}s
                </span>
              )}

              {showBackpack && (
                <div className={`rounded-2xl bg-stone-900/95 border border-stone-700 shadow-2xl backdrop-blur-md text-stone-100 ${isMobileUi ? 'w-[min(72vw,260px)] p-2.5' : 'w-[min(92vw,340px)] p-3'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-amber-300 uppercase tracking-wider">
                      <BackpackIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Mochila ({filledSlots}/{INVENTORY_SIZE})
                    </span>
                    <button onClick={() => setShowBackpack(false)} className="p-1 rounded-lg hover:bg-stone-800 cursor-pointer" aria-label="Cerrar mochila">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {isMobileUi ? (
                    <div className="grid grid-cols-5 gap-1.5">
                      {inventory.slots.map((item, i) => {
                        const info = item ? ITEM_INFO[item] : null;
                        return (
                          <button
                            key={i}
                            onClick={() => {
                              if (!info) return;
                              engine?.useItem(i);
                              setShowBackpack(false);
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              if (info) engine?.discardItem(i);
                            }}
                            title={info ? `${info.name}: tocar para usar` : `Vacío ${i + 1}`}
                            className={`relative aspect-square rounded-xl flex items-center justify-center text-lg border transition-transform active:scale-90 cursor-pointer ${
                              info ? 'bg-stone-800 border-stone-600' : 'bg-stone-950/60 border-stone-800 border-dashed'
                            }`}
                            style={info ? { boxShadow: `inset 0 -2px 0 ${info.color}` } : undefined}
                          >
                            <span className="absolute top-0.5 left-1 text-[8px] font-mono text-stone-500">{i + 1}</span>
                            {info?.emoji}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {inventory.slots.map((item, i) => {
                        const info = item ? ITEM_INFO[item] : null;
                        return (
                          <div key={i} className="flex items-center gap-2 p-2 rounded-xl bg-stone-950/60 border border-stone-800">
                            <span className="w-5 text-[10px] font-mono text-stone-500">{i + 1}</span>
                            <span className="w-8 h-8 flex items-center justify-center text-xl rounded-lg bg-stone-800/80">{info?.emoji ?? ''}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold truncate">{info ? info.name : 'Vacío'}</div>
                              {info && <div className="text-[10px] text-stone-400 leading-snug">{info.desc}</div>}
                            </div>
                            {info && (
                              <>
                                <button
                                  onClick={() => engine?.useItem(i)}
                                  className="px-2 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-stone-950 text-[11px] font-bold cursor-pointer"
                                >
                                  Usar
                                </button>
                                <button
                                  onClick={() => engine?.discardItem(i)}
                                  className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 cursor-pointer"
                                  title="Tirar"
                                  aria-label="Tirar"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {!isMobileUi && (
                    <p className="mt-2 text-[10px] text-stone-400 leading-snug">
                      Recoge bayas 🍇 y nueces 🌰 en las islas. Úsalas con las teclas 1–5 o tocando el espacio. Las llaves 🔑 se usan solas al llegar a una puerta.
                    </p>
                  )}
                </div>
              )}

              {isMobileUi ? (
                <button
                  onClick={() => setShowBackpack((v) => !v)}
                  title="Mochila"
                  aria-label="Abrir mochila"
                  className={`relative rounded-2xl flex items-center justify-center cursor-pointer transition-colors shadow-lg border backdrop-blur-md ${
                    compactControls ? 'w-11 h-11' : 'w-12 h-12'
                  } ${
                    showBackpack
                      ? 'bg-amber-500 text-stone-950 border-amber-300'
                      : 'bg-stone-900/70 text-amber-300 border-stone-700/70 hover:bg-stone-800/80'
                  }`}
                >
                  <BackpackIcon className={compactControls ? 'w-4 h-4' : 'w-5 h-5'} />
                  {filledSlots > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-amber-400 text-stone-950 text-[9px] font-black flex items-center justify-center leading-none">
                      {filledSlots}
                    </span>
                  )}
                </button>
              ) : (
                <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-stone-900/80 border border-stone-700/80 shadow-lg backdrop-blur-md">
                  <button
                    onClick={() => setShowBackpack((v) => !v)}
                    title="Mochila (I)"
                    aria-label="Abrir mochila"
                    className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center cursor-pointer transition-colors ${
                      showBackpack ? 'bg-amber-500 text-stone-950' : 'bg-stone-800 text-amber-300 hover:bg-stone-700'
                    }`}
                  >
                    <BackpackIcon className="w-5 h-5" />
                  </button>
                  {inventory.slots.map((item, i) => {
                    const info = item ? ITEM_INFO[item] : null;
                    return (
                      <button
                        key={i}
                        onClick={() => engine?.useItem(i)}
                        title={info ? `${info.name}: ${info.desc} (tecla ${i + 1})` : `Espacio ${i + 1} vacío`}
                        className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center text-xl border transition-transform active:scale-90 cursor-pointer ${
                          info ? 'bg-stone-800 border-stone-600 hover:border-amber-400' : 'bg-stone-950/50 border-stone-800 border-dashed'
                        }`}
                        style={info ? { boxShadow: `inset 0 -3px 0 ${info.color}` } : undefined}
                      >
                        <span className="absolute top-0.5 left-1 text-[9px] font-mono text-stone-500">{i + 1}</span>
                        {info?.emoji}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 3. MOBILE ON-SCREEN TOUCH CONTROLS                       */}
          {/* ======================================================== */}
          {touchControlsEnabled && !isAnyModalOpen && (
            <>
              <div className={`absolute flex flex-col items-start gap-2 pointer-events-auto z-20 pl-safe pb-safe ${compactControls ? 'bottom-3 left-3' : 'bottom-5 left-5 sm:bottom-6 sm:left-6'}`}>
                <div className="flex items-center gap-2 ml-1">
                  <button
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      engine?.rotateCamera(Math.PI / 4);
                    }}
                    onClick={() => engine?.rotateCamera(Math.PI / 4)}
                    className={`${compactControls ? 'w-9 h-9' : 'w-10 h-10'} rounded-full bg-stone-900/70 border border-stone-700/80 text-amber-300 flex items-center justify-center shadow-md active:scale-90 transition-transform cursor-pointer touch-none select-none backdrop-blur-sm`}
                    style={{ touchAction: 'none' }}
                    title="Girar cámara izquierda"
                    aria-label="Girar cámara izquierda"
                  >
                    <Undo2 className="w-4 h-4" />
                  </button>
                  <button
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      engine?.rotateCamera(-Math.PI / 4);
                    }}
                    onClick={() => engine?.rotateCamera(-Math.PI / 4)}
                    className={`${compactControls ? 'w-9 h-9' : 'w-10 h-10'} rounded-full bg-stone-900/70 border border-stone-700/80 text-amber-300 flex items-center justify-center shadow-md active:scale-90 transition-transform cursor-pointer touch-none select-none backdrop-blur-sm`}
                    style={{ touchAction: 'none' }}
                    title="Girar cámara derecha"
                    aria-label="Girar cámara derecha"
                  >
                    <Redo2 className="w-4 h-4" />
                  </button>
                </div>
                <VirtualJoystick
                  onMove={handleJoystickMove}
                  compact={compactControls}
                />
              </div>

              <div className={`absolute flex flex-col items-end pointer-events-auto z-20 pr-safe pb-safe ${compactControls ? 'bottom-3 right-3 gap-2' : 'bottom-5 right-5 sm:bottom-6 sm:right-6 gap-3'}`}>
                {power && powerInfo && (
                  <button
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      engine?.activateCompanionPower();
                    }}
                    onClick={() => engine?.activateCompanionPower()}
                    className={`flex items-center gap-1.5 rounded-2xl text-[10px] sm:text-xs font-bold shadow-lg transition-transform active:scale-95 cursor-pointer touch-none select-none border-2 ${
                      compactControls ? 'px-2.5 py-1.5' : 'px-3.5 py-2'
                    } ${
                      power.state === 'ready'
                        ? 'text-stone-950 border-amber-200'
                        : 'bg-stone-900/80 text-stone-400 border-stone-700/80'
                    }`}
                    style={{ touchAction: 'none', backgroundColor: power.state === 'ready' ? powerInfo.color : undefined }}
                  >
                    {COMPANION_ICONS[power.companion]}
                    <span>
                      {power.state === 'ready' && 'Poder'}
                      {power.state === 'active' && `${Math.ceil(power.timeLeft)}s`}
                      {power.state === 'hungry' && 'Hambre'}
                    </span>
                  </button>
                )}

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
                  className={`flex items-center gap-1.5 rounded-2xl text-[10px] sm:text-xs font-bold shadow-lg transition-transform active:scale-95 cursor-pointer touch-none select-none ${
                    compactControls ? 'px-3 py-2' : 'px-4 py-2.5'
                  } ${
                    isSprintActive
                      ? 'bg-amber-500 text-stone-950 border-2 border-amber-300'
                      : 'bg-stone-900/85 text-stone-200 border border-stone-700/80'
                  }`}
                  style={{ touchAction: 'none' }}
                >
                  <Zap className={`w-4 h-4 ${isSprintActive ? 'fill-stone-950' : 'text-amber-400'}`} />
                  <span>{isSprintActive ? 'Corriendo' : 'Correr'}</span>
                </button>

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
                  className={`rounded-full bg-gradient-to-br from-amber-500 to-amber-600 active:from-amber-600 active:to-amber-700 text-stone-950 font-bold flex flex-col items-center justify-center shadow-xl shadow-amber-950/40 border-2 border-amber-300 active:scale-90 transition-transform cursor-pointer touch-none select-none ${
                    compactControls ? 'w-14 h-14' : 'w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem]'
                  }`}
                  style={{ touchAction: 'none' }}
                  title="Saltar"
                >
                  <ArrowUp className={compactControls ? 'w-6 h-6 stroke-[3]' : 'w-7 h-7 stroke-[3]'} />
                  <span className="text-[9px] sm:text-[10px] tracking-wider uppercase -mt-0.5">Saltar</span>
                </button>
              </div>
            </>
          )}
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
                  Cozy Leap · {checkpointName}
                </span>
              </div>
            </div>
          )}

          {photoFrame === 'polaroid' && (
            <div className="absolute inset-4 sm:inset-10 border-[16px] sm:border-[24px] border-b-[56px] sm:border-b-[72px] border-stone-100/95 shadow-2xl rounded-sm pointer-events-none z-10 flex items-end justify-center pb-2">
              <span className="text-stone-800 font-serif italic text-sm sm:text-base tracking-wide">
                Cozy Leap · {checkpointName} ☁️
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
              <div className="absolute top-4 inset-x-4 pt-safe flex items-center justify-between pointer-events-auto z-20 gap-2">
                <div className="flex items-center gap-2 px-3 sm:px-3.5 py-1.5 rounded-2xl bg-stone-900/90 border border-amber-500/40 text-stone-200 text-xs shadow-xl backdrop-blur-md">
                  <Camera className="w-4 h-4 text-amber-400" />
                  <span className="font-bold text-amber-300 tracking-wider">MODO FOTO</span>
                  <span className="text-stone-500 hidden xs:inline">|</span>
                  <span className="text-stone-300 font-mono text-[11px] hidden xs:inline">
                    {photoFov}° Lente · {photoDistance.toFixed(1)}m
                  </span>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2">
                  {/* Fullscreen Button in Photo Mode */}
                  {toggleFullscreen && (
                    <button
                      onClick={() => {
                        toggleFullscreen();
                        showToast(!isFullscreen ? 'Pantalla Completa' : 'Modo Ventana');
                      }}
                      title={isFullscreen ? 'Salir de Pantalla Completa (Tecla F)' : 'Pantalla Completa (Tecla F)'}
                      className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-stone-900/90 border border-stone-800 hover:bg-stone-800 text-stone-200 text-xs font-semibold shadow-md cursor-pointer backdrop-blur-md flex items-center gap-1"
                    >
                      {isFullscreen ? <Minimize className="w-3.5 h-3.5 text-amber-300" /> : <Maximize className="w-3.5 h-3.5 text-amber-400" />}
                      <span className="hidden md:inline">{isFullscreen ? 'Salir' : 'Fullscreen'}</span>
                    </button>
                  )}

                  {/* Pause / Play Action Toggle */}
                  <button
                    onClick={() => {
                      const next = !isPhotoPaused;
                      setIsPhotoPaused(next);
                      engine?.setPhotoModePaused(next);
                    }}
                    title={isPhotoPaused ? 'Reanudar Movimiento' : 'Pausar Mundo para Foto'}
                    className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-semibold shadow-md cursor-pointer backdrop-blur-md transition-colors ${
                      isPhotoPaused
                        ? 'bg-amber-500/20 text-amber-300 border-amber-400/50'
                        : 'bg-stone-900/90 text-stone-300 border-stone-800 hover:bg-stone-800'
                    }`}
                  >
                    {isPhotoPaused ? <Play className="w-3.5 h-3.5 fill-amber-300" /> : <Pause className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{isPhotoPaused ? 'Mundo Pausado' : 'Pausar'}</span>
                  </button>

                  {/* Hide UI Toggle */}
                  <button
                    onClick={() => setHidePhotoUI(true)}
                    title="Ocultar Interfaz (H)"
                    className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-stone-900/90 border border-stone-800 hover:bg-stone-800 text-stone-300 text-xs font-medium transition-colors shadow-md cursor-pointer backdrop-blur-md flex items-center gap-1.5"
                  >
                    <EyeOff className="w-4 h-4" />
                    <span className="hidden sm:inline">Ocultar (H)</span>
                  </button>

                  {/* Exit Photo Mode */}
                  <button
                    onClick={() => engine?.exitPhotoMode()}
                    title="Salir del Modo Foto (Esc / P)"
                    className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-stone-900/90 border border-stone-800 hover:bg-stone-800 text-stone-200 text-xs font-semibold shadow-md cursor-pointer backdrop-blur-md"
                  >
                    <X className="w-4 h-4" />
                    <span className="hidden sm:inline">Salir</span>
                  </button>
                </div>
              </div>

              {/* Bottom Photo Studio Drawer */}
              <div className="absolute bottom-3 sm:bottom-4 inset-x-3 sm:inset-x-4 max-w-2xl mx-auto flex flex-col items-center gap-2 sm:gap-3 pointer-events-auto z-20 pb-safe">
                {/* Control Box */}
                <div className="w-full rounded-3xl bg-stone-950/90 border border-stone-800/90 p-3 sm:p-4 shadow-2xl backdrop-blur-xl flex flex-col gap-2.5 sm:gap-3 max-h-[46vh] overflow-y-auto">
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
                        <span>Filtros</span>
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
                      className="flex items-center gap-2 px-4 sm:px-5 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-extrabold text-xs shadow-lg shadow-amber-950/50 active:scale-95 transition-all cursor-pointer"
                    >
                      <Camera className="w-4 h-4 fill-stone-950" />
                      <span>CAPTURAR</span>
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
              <div className="w-full max-w-lg rounded-3xl bg-stone-900 border border-amber-600/40 p-5 sm:p-6 text-stone-100 shadow-2xl flex flex-col items-center text-center max-h-[95vh] overflow-y-auto">
                <div className="w-full flex items-center justify-between mb-3 border-b border-stone-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-bold text-amber-200">¡Foto capturada!</span>
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
                    alt="Foto capturada"
                    className="w-full h-auto max-h-[55vh] object-contain rounded-xl"
                  />
                </div>

                {/* Actions */}
                <div className="w-full flex flex-col sm:flex-row items-center gap-2.5">
                  <a
                    href={capturedPhotoUrl}
                    download={`aether-leap-${checkpointName.toLowerCase().replace(/\s+/g, '-')}.png`}
                    className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                  >
                    <Download className="w-4 h-4 stroke-[2.5]" />
                    <span>Descargar foto (PNG)</span>
                  </a>
                  <button
                    onClick={() => setCapturedPhotoUrl(null)}
                    className="w-full sm:w-auto py-3 px-5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-sm font-medium transition-colors cursor-pointer"
                  >
                    Tomar otra
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* LEVEL OBJECTIVE BRIEF                                    */}
      {/* ======================================================== */}
      {showLevelBrief && (gameState === 'playing' || gameState === 'paused') && (
        <div className="absolute inset-0 z-[55] pointer-events-auto flex items-center justify-center p-4 pt-safe pb-safe bg-stone-950/70 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-stone-900 border border-amber-500/30 shadow-2xl p-5 text-stone-100 flex flex-col gap-3 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-amber-300 font-bold mb-1">Objetivo</p>
                <h3 className="text-lg font-serif font-bold text-amber-100 leading-snug">{currentHowTo.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLevelBrief(false)}
                className="p-1.5 rounded-xl hover:bg-stone-800 text-stone-400 cursor-pointer"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-amber-200/90 font-semibold leading-snug">{currentHowTo.goal}</p>
            <ul className="space-y-2 text-xs text-stone-300 leading-relaxed">
              {currentHowTo.steps.map((step) => (
                <li key={step} className="flex gap-2">
                  <span className="text-amber-400 shrink-0 mt-0.5">•</span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setShowLevelBrief(false)}
              className="w-full mt-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm cursor-pointer"
            >
              {gameState === 'paused' ? 'Entendido' : '¡A jugar!'}
            </button>
            <p className="text-[10px] text-stone-500 text-center">También puedes volver a ver esto desde el menú de pausa.</p>
          </div>
        </div>
      )}

      {showEasterEgg && (
        <div className="absolute inset-0 z-[70] pointer-events-auto flex items-center justify-center p-4 pt-safe pb-safe bg-stone-950/75 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-3xl bg-gradient-to-b from-rose-950/90 to-stone-900 border border-rose-400/40 shadow-2xl p-6 text-stone-100 flex flex-col items-center text-center gap-3 animate-in fade-in zoom-in-95">
            <div className="w-14 h-14 rounded-full bg-rose-500/20 border border-rose-300/50 flex items-center justify-center text-2xl">
              ♥
            </div>
            <h3 className="text-xl font-serif font-bold text-rose-100 leading-snug">
              Este juego fue creado para hacer feliz a Monse
            </h3>
            <p className="text-xs text-rose-200/80 leading-relaxed">
              Un secreto entre nubes, islas y saltos. Gracias por jugar Cozy Leap.
            </p>
            <button
              type="button"
              onClick={() => onDismissEasterEgg?.()}
              className="w-full py-3 rounded-xl bg-rose-400 hover:bg-rose-300 text-stone-950 font-bold text-sm cursor-pointer"
            >
              Con cariño ♥
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. PAUSE MODAL                                           */}
      {/* ======================================================== */}
      {gameState === 'paused' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-stone-950/75 p-6 z-30 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-stone-900 border border-stone-800 p-6 text-stone-100 shadow-2xl flex flex-col items-center text-center">
            <h2 className="text-2xl font-serif font-bold text-amber-200 mb-1">Pausa</h2>
            <p className="text-xs text-stone-400 mb-4">Tómate un respiro y disfruta la melodía.</p>

            {/* Control de sonido y volumen */}
            <div className="w-full flex items-center justify-between px-4 py-2.5 mb-4 rounded-2xl bg-stone-950/60 border border-stone-800">
              <span className="text-xs text-stone-300 font-medium">Sonido y música</span>
              <button
                onClick={toggleMute}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  isMuted
                    ? 'bg-stone-800 text-stone-400 hover:bg-stone-700'
                    : 'bg-amber-600/30 text-amber-300 border border-amber-600/50 hover:bg-amber-600/40'
                }`}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-stone-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
                <span>{isMuted ? 'Silenciado' : 'Activado'}</span>
              </button>
            </div>

            <div className="w-full flex flex-col gap-2.5 mb-5">
              <button
                onClick={() => engine?.setPaused(false)}
                className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-sm transition-colors cursor-pointer shadow-md"
              >
                Reanudar
              </button>
              <button
                onClick={() => {
                  engine?.physics.respawnAtCheckpoint();
                  engine?.setPaused(false);
                }}
                className="w-full py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-sm font-medium transition-colors cursor-pointer"
              >
                Reiniciar
              </button>
              <button
                onClick={() => setShowLevelBrief(true)}
                className="w-full py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-200 text-sm font-medium transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <Compass className="w-4 h-4" />
                Objetivo del nivel
              </button>
              <button
                onClick={() => {
                  setShowHelpModal(true);
                }}
                className="w-full py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-sky-300 text-sm font-medium transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <HelpCircle className="w-4 h-4" />
                Guía y Controles
              </button>
              <button
                onClick={handleReturnToTitle}
                className="w-full py-2.5 rounded-xl bg-stone-800/80 hover:bg-stone-700/80 border border-stone-700/60 text-amber-300 text-sm font-semibold transition-colors cursor-pointer"
              >
                Volver al menú principal
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-stone-400">
              {toggleFullscreen && (
                <button onClick={toggleFullscreen} className="flex items-center gap-1.5 hover:text-stone-200 cursor-pointer">
                  {isFullscreen ? <Minimize className="w-3.5 h-3.5 text-amber-400" /> : <Maximize className="w-3.5 h-3.5 text-amber-400" />}
                  <span>{isFullscreen ? 'Ventana' : 'Pantalla completa'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5b. GAME OVER MODAL (Time Trial Timeout)                 */}
      {/* ======================================================== */}
      {gameState === 'game_over' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-stone-950/85 p-6 z-30">
          <div className="w-full max-w-sm rounded-3xl bg-stone-900 border border-orange-800/60 p-6 text-stone-100 shadow-2xl flex flex-col items-center text-center animate-in fade-in zoom-in-95">
            <div className="w-14 h-14 rounded-2xl bg-orange-950/40 border border-orange-700/50 flex items-center justify-center text-orange-400 mb-3 animate-pulse">
              <Clock className="w-8 h-8" />
            </div>

            <h2 className="text-2xl font-serif font-bold text-orange-200 mb-1">¡Tiempo agotado!</h2>
            <p className="text-xs text-stone-300 mb-5">
              El reloj llegó a cero antes de conquistar la cima.
            </p>

            {/* Run Stats */}
            <div className="w-full grid grid-cols-2 gap-2 mb-5 p-3 rounded-xl bg-stone-950/70 border border-stone-800 text-xs">
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-stone-400 uppercase font-medium">Punto alcanzado</span>
                <span className="text-base font-bold font-mono text-amber-300">{checkpointIndex} / 3</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-stone-400 uppercase font-medium">Reliquias</span>
                <span className="text-base font-bold font-mono text-emerald-400">
                  {collectedCount} / {totalCollectibles}
                </span>
              </div>
            </div>

            <div className="w-full flex flex-col gap-2">
              <button
                onClick={() => handleRestart('time_trial')}
                className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-sm transition-colors cursor-pointer"
              >
                Reintentar contrarreloj (90s)
              </button>
              <button
                onClick={() => {
                  if (engine) {
                    engine.addTimeTrialBonus(30, 'Continuar');
                    engine.gameState = 'playing';
                  }
                }}
                className="w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                Continuar con +30s extra
              </button>
              <button
                onClick={() => handleRestart('free')}
                className="w-full py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-medium transition-colors cursor-pointer"
              >
                Cambiar a modo libre
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. VICTORY / LEVEL COMPLETE MODAL (Clean & Clear)        */}
      {/* ======================================================== */}
      {gameState === 'victory' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-stone-950/80 backdrop-blur-md p-4 sm:p-6 z-30 animate-in fade-in duration-300">
          <div className="w-full max-w-sm rounded-3xl bg-stone-900/95 border border-amber-600/40 p-6 text-stone-100 shadow-2xl flex flex-col items-center text-center">
            {/* Header Icon */}
            <div className="w-14 h-14 rounded-2xl bg-amber-600/20 border border-amber-500/40 flex items-center justify-center text-amber-300 mb-3 shadow-lg shadow-amber-950/20">
              <Award className="w-8 h-8" />
            </div>

            {/* Title & Level Name */}
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-amber-200 mb-1">
              ¡Nivel completado!
            </h2>
            <p className="text-xs text-stone-400 font-medium mb-3">
              Nivel {engine?.currentLevel ?? 1} · {levelInfo(engine?.currentLevel ?? 1).name}
            </p>

            {/* Mode Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-4 bg-stone-800 border border-stone-700">
              {gameMode === 'time_trial' && (
                <>
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-amber-300">Contrarreloj · {timeRemaining}s restantes</span>
                </>
              )}
              {gameMode === 'chase' && (
                <>
                  <Ghost className="w-3.5 h-3.5 text-orange-400" />
                  <span className="text-orange-300">¡Escapaste del Acechador!</span>
                </>
              )}
              {gameMode === 'free' && (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Aventura completada</span>
                </>
              )}
            </div>

            {/* Compact Statistics */}
            <div className="w-full grid grid-cols-2 gap-2.5 mb-4 p-3 rounded-2xl bg-stone-950/70 border border-stone-800">
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-stone-400 uppercase font-semibold">Tiempo</span>
                <span className="text-lg font-bold font-mono text-amber-300">{formatTime(elapsedTime)}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-stone-400 uppercase font-semibold">Reliquias</span>
                <span className="text-lg font-bold font-mono text-emerald-400">
                  {collectedCount} / {totalCollectibles}
                </span>
              </div>
            </div>

            {/* Companion unlock (if newly unlocked on this level) */}
            {engine?.lastUnlocked && COMPANION_POWERS[engine.lastUnlocked] && (
              <div className="w-full mb-4 p-2.5 rounded-2xl bg-emerald-950/40 border border-emerald-600/40 flex items-center gap-2.5 text-left">
                <span
                  className="w-8 h-8 shrink-0 rounded-xl flex items-center justify-center text-stone-900 text-sm font-bold"
                  style={{ backgroundColor: COMPANION_POWERS[engine.lastUnlocked]!.color }}
                >
                  {COMPANION_ICONS[engine.lastUnlocked]}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-emerald-200 truncate">
                    ¡Compañero {COMPANION_POWERS[engine.lastUnlocked]!.companionName} desbloqueado!
                  </div>
                  <div className="text-[10px] text-stone-300 truncate">
                    Poder: {COMPANION_POWERS[engine.lastUnlocked]!.powerName}
                  </div>
                </div>
              </div>
            )}

            {/* Strictly the 2 requested buttons: Siguiente nivel & Jugar de nuevo */}
            <div className="w-full flex flex-col gap-2.5">
              {engine && isLevelUnlocked(engine.currentLevel + 1) ? (
                <button
                  type="button"
                  onClick={() => {
                    setElapsedTime(0);
                    setSelectedLevel(engine.currentLevel + 1);
                    engine.goToNextLevel();
                  }}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-bold text-sm sm:text-base transition-all active:scale-[0.98] shadow-lg shadow-amber-950/40 cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Siguiente nivel</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleReturnToTitle}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-bold text-sm sm:text-base transition-all active:scale-[0.98] shadow-lg shadow-amber-950/40 cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Volver al menú principal</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </button>
              )}

              <button
                type="button"
                onClick={() => handleRestart(gameMode)}
                className="w-full py-3 rounded-2xl bg-stone-800 hover:bg-stone-700 active:scale-[0.98] text-stone-200 text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 border border-stone-700/80"
              >
                <RotateCcw className="w-4 h-4 text-stone-400" />
                <span>Jugar de nuevo</span>
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
              <span>Guía de controles y físicas</span>
            </h3>

            {/* Keyboard Section */}
            <div className="mb-4">
              <span className="text-[11px] text-amber-300 font-bold uppercase tracking-wider block mb-2">
                🎮 Controles con teclado
              </span>
              <div className="space-y-2 text-xs text-stone-300">
                <div className="flex justify-between items-center py-1 border-b border-stone-800">
                  <span className="text-stone-400">Moverse con agilidad</span>
                  <span className="font-mono bg-stone-800 px-2 py-0.5 rounded text-amber-300">W A S D / Flechas</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-stone-800">
                  <span className="text-stone-400">Saltar y rebotar</span>
                  <span className="font-mono bg-stone-800 px-2 py-0.5 rounded text-amber-300">Espacio</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-stone-800">
                  <span className="text-stone-400">Correr (sprint)</span>
                  <span className="font-mono bg-stone-800 px-2 py-0.5 rounded text-amber-300">Shift</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-stone-800">
                  <span className="text-stone-400">Girar cámara</span>
                  <span className="font-mono bg-stone-800 px-2 py-0.5 rounded text-amber-300">Arrastrar ratón / Q, E</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-stone-800">
                  <span className="text-stone-400">Pantalla completa</span>
                  <span className="font-mono bg-stone-800 px-2 py-0.5 rounded text-amber-300">F</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-stone-800">
                  <span className="text-stone-400">Modo foto</span>
                  <span className="font-mono bg-stone-800 px-2 py-0.5 rounded text-amber-300">P</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-stone-800">
                  <span className="text-stone-400">Reiniciar en punto de control</span>
                  <span className="font-mono bg-stone-800 px-2 py-0.5 rounded text-amber-300">R</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-stone-800">
                  <span className="text-stone-400">Poder del compañero</span>
                  <span className="font-mono bg-stone-800 px-2 py-0.5 rounded text-amber-300">G</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-stone-800">
                  <span className="text-stone-400">Usar objeto de la mochila</span>
                  <span className="font-mono bg-stone-800 px-2 py-0.5 rounded text-amber-300">1 – 5</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-stone-800">
                  <span className="text-stone-400">Abrir o cerrar mochila</span>
                  <span className="font-mono bg-stone-800 px-2 py-0.5 rounded text-amber-300">I</span>
                </div>
              </div>
            </div>

            {/* Companion powers guide */}
            <div className="p-3 rounded-2xl bg-amber-950/30 border border-amber-700/40 text-[11px] text-amber-100/90 leading-relaxed mb-3">
              <strong className="text-amber-300">🐾 Poderes de tu compañero (tecla G):</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                {Object.values(COMPANION_POWERS).map((p) =>
                  p ? (
                    <li key={p.companion}>
                      <strong>{p.companionName} – {p.powerName}:</strong> {p.desc} ({p.duration}s)
                    </li>
                  ) : null
                )}
              </ul>
              <p className="mt-1.5">
                Después de usarlo, tu compañero queda con hambre. Recoge una <strong>baya mágica 🍇</strong>, se guarda en tu mochila, y úsala (teclas 1–5) para recargar el poder.
              </p>
            </div>

            {/* Puzzles guide (generated levels) */}
            <div className="p-3 rounded-2xl bg-stone-900 border border-stone-700/60 text-[11px] text-stone-200 leading-relaxed mb-3">
              <strong className="text-amber-300">🗺️ Mundos abiertos y acertijos (desde el nivel 5):</strong>
              <p className="mt-1">
                Cada nivel es una zona para explorar libremente: colinas, mesetas, escaleras, fosos e islas en el cielo. Escondidos por la zona hay varios{' '}
                <strong>orbes 🔮</strong> (busca los rayos de luz): en torres, islas flotantes, bóvedas con llave, sobre pilares o al final de rutas fuera del mapa
                (con un <strong>portal 🌀</strong> para volver). Con todos los orbes se rompe el escudo de la <strong>fortaleza</strong> del centro: entra por la
                puerta y sube su espiral, la parte más difícil del nivel, hasta la cima.
              </p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li><strong>Roca 🪨:</strong> camina contra ella para empujarla hasta el pilar alto y súbete encima para alcanzar el orbe. Si se cae, vuelve a su sitio.</li>
                <li><strong>Bóveda con candado 🚪:</strong> el orbe está encerrado; necesitas una llave 🔑. Búscala en las islas del cielo (sube con un trampolín).</li>
                <li><strong>Ladrón de llaves:</strong> si un enemigo lleva una llave sobre la cabeza, salta encima de él para quitársela.</li>
                <li><strong>Vigía 👁️:</strong> si su luz te ve, vuelves a la entrada de la zona. Escóndete tras los muros y avanza cuando mire a otro lado.</li>
              </ul>
            </div>

            {/* Game Modes Guide */}
            <div className="p-3 rounded-2xl bg-amber-950/30 border border-amber-600/30 text-[11px] text-amber-200/90 leading-relaxed mb-3">
              <strong className="text-amber-300">🏆 Modos de juego disponibles:</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>
                  <strong>Modo libre:</strong> Parkour apacible sin prisa. Sin cuenta regresiva ni enemigos hostiles. El clima cambia fluidamente según los hitos alcanzados.
                </li>
                <li>
                  <strong>Modo contrarreloj:</strong> Empiezas con 90 segundos. Cada reliquia o bellota otorga <strong>+8 segundos</strong> y cada campana de punto de control te da <strong>+15 segundos</strong>.
                </li>
                <li>
                  <strong>Modo persecución:</strong> Un <em>Acechador Sombrío</em> aparece detrás de ti y te persigue por todo el archipiélago. Si te alcanza, te expulsará de la plataforma. ¡Mantente en movimiento!
                </li>
              </ul>
            </div>

            {/* Mobile Touch Section */}
            <div className="mb-4">
              <span className="text-[11px] text-amber-300 font-bold uppercase tracking-wider block mb-2">
                📱 Controles móviles (pantalla táctil)
              </span>
              <div className="space-y-2 text-xs text-stone-300">
                <div className="flex justify-between items-center py-1 border-b border-stone-800">
                  <span className="text-stone-400">Botón rotar pantalla</span>
                  <span className="text-stone-200">Gira entre horizontal y vertical al instante</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-stone-800">
                  <span className="text-stone-400">Botón pantalla completa</span>
                  <span className="text-stone-200">Vista inmersiva sin barras del navegador</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-stone-800">
                  <span className="text-stone-400">Joystick 360° (abajo a la izquierda)</span>
                  <span className="text-stone-200">Mueve en cualquier dirección</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-stone-800">
                  <span className="text-stone-400">Botón saltar (abajo a la derecha)</span>
                  <span className="text-stone-200">Salto y rebote</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-stone-800">
                  <span className="text-stone-400">Botón correr (sprint)</span>
                  <span className="text-stone-200">Acelera el paso</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-stone-800">
                  <span className="text-stone-400">Girar cámara y zoom</span>
                  <span className="text-stone-200">Deslizar con 1 dedo o pellizcar con 2</span>
                </div>
              </div>
            </div>

            {/* Enhanced Object Physics & Varied Obstacles Section */}
            <div className="p-3 rounded-2xl bg-amber-950/20 border border-amber-700/30 text-[11px] text-amber-200/90 leading-relaxed mb-3">
              <strong className="text-amber-300">🎪 Obstáculos y elementos del mundo:</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li><strong>Hongos elásticos:</strong> Al tocarlos o rozarlos te lanzan de inmediato por los cielos con un salto vertical potente hacia las nubes.</li>
                <li><strong>Levitador térmico (+16m):</strong> Columnas de aire ascendente que te elevan hacia las nubes para alcanzar plataformas lejanas.</li>
                <li><strong>Molinos florales giratorios:</strong> Aspas de madera suave que rotan sobre puentes; sincroniza tu paso para cruzarlos.</li>
                <li><strong>Troncos rodantes de equilibrio:</strong> Troncos cubiertos de musgo que giran sobre su eje, requiriendo paso ágil.</li>
                <li><strong>Géiseres de esporas cálidas:</strong> Calderas que erupcionan ráfagas rítmicas de vapor para impulsarte en el aire.</li>
                <li><strong>Pelotas de lana rodantes:</strong> Rebotan dinámicamente con inercia rotacional y transfieren masa al chocar.</li>
                <li><strong>Plataformas quebradizas:</strong> Tiemblan bajo tu peso, cayendo tras un breve instante y regenerándose después.</li>
              </ul>
            </div>

            {/* Photo Mode Guide */}
            <div className="p-3 rounded-2xl bg-stone-900 border border-stone-700/60 text-[11px] text-stone-200 leading-relaxed mb-3">
              <strong className="text-amber-300">📸 Modo foto (tecla P o botón de cámara):</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li><strong>Cámara libre:</strong> Ajusta zoom, distancia, altura, ángulo de lente (FOV) e inclinación (Roll) en 360°.</li>
                <li><strong>Pausar acción:</strong> Congela el tiempo para capturar poses en el aire.</li>
                <li><strong>Filtros artísticos:</strong> Hora dorada, pastel ensueño, atardecer cálido, noche estelar, película clásica y natural.</li>
                <li><strong>Marcos estilizados:</strong> Polaroid, cinemático con barras panorámicas, tarjeta postal y guía 3×3.</li>
                <li><strong>Descarga en alta resolución:</strong> Guarda instantáneamente tu fotografía en formato PNG.</li>
              </ul>
            </div>

            {/* Cozy Enemies Guide */}
            <div className="p-3 rounded-2xl bg-emerald-950/30 border border-emerald-700/30 text-[11px] text-emerald-200/90 leading-relaxed mb-4">
              <strong className="text-emerald-300">🌿 Criaturas pacíficas y desafíos:</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>
                  <strong>Duendes bellota (Sproutlings):</strong> Pequeños seres de musgo con casco de bellota que patrullan sobre las islas. ¡Salta sobre su cabeza para impulsarte hacia saltos gigantes!
                </li>
                <li>
                  <strong>Nubes sopladoras (Zephyr Puffs):</strong> Nubes flotantes con alas suaves que inflan sus mejillas y soplan brisas rítmicas poniendo a prueba tu equilibrio.
                </li>
              </ul>
            </div>

            <button
              onClick={() => setShowHelpModal(false)}
              className="w-full py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
