import React, { useEffect, useRef, useState } from 'react';
import {
  Dices,
  Shuffle,
  Undo2,
  RotateCcw,
  Check,
  Smile,
  Scissors,
  Shirt,
  Sparkles,
  Backpack,
  Cloud,
  Star,
  Bug,
  X,
  Mars,
  Venus,
  Lock,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { CharacterPreviewFocus } from '../game/GameEngine';
import { UI, BTN } from '../ui/labels';
import {
  BodyType,
  BODY_TYPES,
  CharacterAppearance,
  defaultAppearanceFor,
  hairStylesFor,
  SKIN_TONES,
  HAIR_COLORS,
  CLOTH_COLORS,
  BOOT_COLORS,
  hatStylesFor,
  outfitStylesFor,
  EYE_STYLES,
  ACCESSORIES,
  COMPANIONS,
  CompanionStyle,
  generateRandomAppearance,
  generateRandomName,
  NAME_SUGGESTIONS,
  colorLabel,
} from '../game/character';
import { COMPANION_POWERS } from '../game/companionPowers';
import { isCompanionUnlocked, unlockLevelFor } from '../game/progress';
import { SHIRT_PATTERNS, getPatternSwatchUrl } from '../game/patterns';
import { isPatternUnlocked, subscribeDailyMissions } from '../game/dailyMissions';
import { ConfirmDialog, ConfirmRequest } from './ConfirmDialog';
import { FieldError, RequirementList } from './FieldHints';
import { RecentChips, SuggestionList } from './RecentChips';
import {
  CHARACTER_NAME_MAX,
  characterNameRequirements,
  isCharacterNameValid,
  sanitizeCharacterNameInput,
} from '../ui/validation';
import { characterNameHint } from '../ui/errors';
import { isTypingTarget } from '../ui/shortcuts';
import { getRecent, pushRecent, RECENT_KEYS } from '../ui/recentMemory';

type Tab = 'cuerpo' | 'pelo' | 'ropa' | 'companero';

interface CharacterCreatorProps {
  appearance: CharacterAppearance;
  onChange: (next: CharacterAppearance) => void;
  onSwitchBody: (body: BodyType) => void;
  onClose: () => void;
  onCancel?: () => void;
  portrait: boolean;
  onFocusChange?: (focus: CharacterPreviewFocus) => void;
  onZoom?: (delta: number) => void;
  embeddedInLobby?: boolean;
}

const TAB_FOCUS: Record<Tab, CharacterPreviewFocus> = {
  cuerpo: 'full',
  pelo: 'head',
  ropa: 'torso',
  companero: 'companion',
};

const FIELD_FOCUS: Partial<Record<keyof CharacterAppearance, CharacterPreviewFocus>> = {
  skinColor: 'head',
  eyeStyle: 'head',
  accessory: 'head',
  height: 'full',
  build: 'full',
  hairStyle: 'head',
  hairColor: 'head',
  outfitStyle: 'torso',
  sweaterColor: 'torso',
  shirtPattern: 'torso',
  detailColor: 'torso',
  hatStyle: 'head',
  hatColor: 'head',
  scarfColor: 'torso',
  bootColor: 'feet',
  backpack: 'torso',
  companion: 'companion',
  name: 'full',
  bodyType: 'full',
};

const TABS: { id: Tab; name: string; icon: React.ReactNode }[] = [
  { id: 'cuerpo', name: 'Cuerpo', icon: <Smile className="w-3.5 h-3.5" /> },
  { id: 'pelo', name: 'Pelo', icon: <Scissors className="w-3.5 h-3.5" /> },
  { id: 'ropa', name: 'Ropa', icon: <Shirt className="w-3.5 h-3.5" /> },
  { id: 'companero', name: 'Compañero', icon: <Sparkles className="w-3.5 h-3.5" /> },
];

export const COMPANION_ICONS: Record<CompanionStyle, React.ReactNode> = {
  nube: <Cloud className="w-4 h-4" />,
  estrella: <Star className="w-4 h-4" />,
  luciernaga: <Bug className="w-4 h-4" />,
  catarina: (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <circle cx="12" cy="5.5" r="3" fill="currentColor" />
      <path d="M4 14a8 8 0 0 1 16 0v1a7 7 0 0 1-16 0z" fill="#e63946" />
      <path d="M12 7v15" stroke="#1b1b1f" strokeWidth="1.5" />
      <circle cx="8" cy="12" r="1.6" fill="#1b1b1f" />
      <circle cx="16" cy="12" r="1.6" fill="#1b1b1f" />
      <circle cx="8.5" cy="17" r="1.4" fill="#1b1b1f" />
      <circle cx="15.5" cy="17" r="1.4" fill="#1b1b1f" />
    </svg>
  ),
  hada: (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <ellipse cx="7" cy="9" rx="5" ry="3.6" fill="#f9a8d4" opacity="0.85" transform="rotate(-25 7 9)" />
      <ellipse cx="17" cy="9" rx="5" ry="3.6" fill="#f9a8d4" opacity="0.85" transform="rotate(25 17 9)" />
      <ellipse cx="8" cy="15.5" rx="3.6" ry="2.4" fill="#c4b5fd" opacity="0.85" transform="rotate(25 8 15.5)" />
      <ellipse cx="16" cy="15.5" rx="3.6" ry="2.4" fill="#c4b5fd" opacity="0.85" transform="rotate(-25 16 15.5)" />
      <circle cx="12" cy="6" r="2.6" fill="currentColor" />
      <path d="M9.5 21 L12 9 L14.5 21 Z" fill="#ec4899" />
      <path d="M19.5 2.5 l0.7 1.6 1.6 0.7 -1.6 0.7 -0.7 1.6 -0.7 -1.6 -1.6 -0.7 1.6 -0.7z" fill="#fde047" />
    </svg>
  ),
  serpiente: (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <path d="M3 18c3-6 6 2 9-4s5-3 5-7" fill="none" stroke="#14b8a6" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M3 18c3-6 6 2 9-4s5-3 5-7" fill="none" stroke="#fde68a" strokeWidth="1" strokeDasharray="1 2.2" strokeLinecap="round" />
      <path d="M2.5 18.5 l-1.8 -2.6 M2.8 18.6 l-2.4 -0.4 M3 18.8 l-0.6 2.6" stroke="#ef4444" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M9 12 l-3.2 -3.6 1.6 0.2 -0.6 -1.8 2.6 2.6z" fill="#22c55e" />
      <path d="M17 1.2 l0.6 2.4 M13.6 2.6 l2 1.6 M20.6 2.4 l-1.6 2 M22.6 5.6 l-2.4 0.4 M13.2 6.2 l2.4 -0.2" stroke="#ef4444" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M15.2 1.8 l1 2.2 M21.8 3.6 l-2 1.4 M14 4.4 l2.1 0.8" stroke="#facc15" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="17.6" cy="6" r="2.9" fill="#0d9488" />
      <circle cx="18.6" cy="5.4" r="0.8" fill="#111" />
    </svg>
  ),
  polilla: (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <path d="M12 9 C6 2, 0 5, 2 11 C3 14, 8 13, 12 11Z" fill="#8a7458" />
      <path d="M12 9 C18 2, 24 5, 22 11 C21 14, 16 13, 12 11Z" fill="#8a7458" />
      <path d="M12 12 C8 14, 4 18, 7 20 C9 21, 11 17, 12 14Z" fill="#5b4a39" />
      <path d="M12 12 C16 14, 20 18, 17 20 C15 21, 13 17, 12 14Z" fill="#5b4a39" />
      <circle cx="6" cy="8.5" r="1.5" fill="#e8d9b8" />
      <circle cx="18" cy="8.5" r="1.5" fill="#e8d9b8" />
      <ellipse cx="12" cy="13" rx="2.2" ry="5" fill="#3b322b" />
      <circle cx="11" cy="9.5" r="0.9" fill="#ff2a2a" />
      <circle cx="13" cy="9.5" r="0.9" fill="#ff2a2a" />
      <path d="M11 7 L9.5 3.5 M13 7 L14.5 3.5" stroke="#bfae94" strokeWidth="0.9" strokeLinecap="round" />
    </svg>
  ),
  ninguno: <X className="w-4 h-4" />,
};

// ---------- Small building blocks ----------

const Section: React.FC<{
  title: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
  onFocus?: () => void;
}> = ({ title, children, aside, onFocus }) => (
  <div className="flex flex-col gap-2" onPointerDownCapture={onFocus}>
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-cozy-accent-deep font-bold uppercase tracking-wider">{title}</span>
      {aside}
    </div>
    {children}
  </div>
);

const Swatches: React.FC<{
  colors: string[];
  value: string;
  onPick: (c: string) => void;
  label: string;
}> = ({ colors, value, onPick, label }) => {
  const isCustom = !colors.includes(value.toLowerCase());
  return (
    <div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {colors.map((c) => {
          const selected = value.toLowerCase() === c.toLowerCase();
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={colorLabel(c)}
              title={colorLabel(c)}
              onClick={() => onPick(c)}
              className={`w-7 h-7 rounded-full border transition-transform cursor-pointer active:scale-90 ${
                selected
                  ? 'border-cozy-accent ring-2 ring-cozy-accent/50 ring-offset-2 ring-offset-cozy-panel scale-110'
                  : 'border-black/10 hover:scale-110'
              }`}
              style={{ backgroundColor: c }}
            />
          );
        })}
        <label
          title="Color personalizado"
          className={`relative w-7 h-7 rounded-full border cursor-pointer overflow-hidden transition-transform hover:scale-110 ${
            isCustom
              ? 'border-cozy-accent ring-2 ring-cozy-accent/50 ring-offset-2 ring-offset-cozy-panel scale-110'
              : 'border-black/10'
          }`}
          style={{
            background: isCustom
              ? value
              : 'conic-gradient(#f87171, #fbbf24, #a3e635, #34d399, #38bdf8, #a78bfa, #f472b6, #f87171)',
          }}
        >
          <input
            type="color"
            value={value}
            onChange={(e) => onPick(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            aria-label={`${label}: color personalizado`}
          />
        </label>
      </div>
      <p className="mt-1.5 text-[10px] text-cozy-muted">
        Elegido: <span className="font-semibold text-cozy-ink">{colorLabel(value)}</span>
      </p>
    </div>
  );
};

function Chips<T extends string>({
  options,
  value,
  onPick,
}: {
  options: { id: T; name: string }[];
  value: T;
  onPick: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const selected = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onPick(o.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer active:scale-95 ${
              selected
                ? 'cozy-tab-active border-transparent'
                : 'bg-cozy-panel-deep text-cozy-ink border-cozy-line hover:border-cozy-sky'
            }`}
          >
            {o.name}
          </button>
        );
      })}
    </div>
  );
}

const Slider: React.FC<{
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  leftLabel: string;
  rightLabel: string;
  label: string;
}> = ({ value, min, max, onChange, leftLabel, rightLabel, label }) => (
  <div className="flex flex-col gap-1">
    <input
      type="range"
      min={min}
      max={max}
      step={0.01}
      value={value}
      aria-label={label}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full accent-cozy-accent cursor-pointer"
    />
    <div className="flex justify-between text-[10px] text-cozy-muted">
      <span>{leftLabel}</span>
      <span>{rightLabel}</span>
    </div>
  </div>
);

// ---------- Main component ----------

export const CharacterCreator: React.FC<CharacterCreatorProps> = ({
  appearance,
  onChange,
  onSwitchBody,
  onClose,
  onCancel,
  portrait,
  onFocusChange,
  onZoom,
  embeddedInLobby = false,
}) => {
  const [tab, setTab] = useState<Tab>('cuerpo');
  const [history, setHistory] = useState<CharacterAppearance[]>([]);
  const [nameTouched, setNameTouched] = useState(false);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [recentNames, setRecentNames] = useState<string[]>(() => getRecent(RECENT_KEYS.characterNames));
  const [, setMissionTick] = useState(0);
  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    onFocusChange?.('full');
    return subscribeDailyMissions(() => setMissionTick((v) => v + 1));
  }, []);

  const focus = (next: CharacterPreviewFocus) => {
    onFocusChange?.(next);
  };

  const apply = (next: CharacterAppearance, key: string) => {
    if (key !== lastKeyRef.current || key === 'random' || key === 'reset') {
      setHistory((h) => [...h.slice(-29), appearance]);
    }
    lastKeyRef.current = key;
    const part = FIELD_FOCUS[key as keyof CharacterAppearance];
    if (part) focus(part);
    onChange(next);
  };

  const set = <K extends keyof CharacterAppearance>(key: K, value: CharacterAppearance[K]) =>
    apply({ ...appearance, [key]: value }, key);

  const undo = () => {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setHistory(history.slice(0, -1));
    lastKeyRef.current = null;
    onChange(prev);
  };

  const body = appearance.bodyType;
  const nameReqs = characterNameRequirements(appearance.name);
  const nameValid = isCharacterNameValid(appearance.name);
  const nameError = nameTouched ? characterNameHint(appearance.name) : null;

  const randomize = () => {
    focus('full');
    apply(generateRandomAppearance(body), 'random');
  };
  const randomizeLook = () => {
    focus('full');
    apply(generateRandomAppearance(body, appearance.name), 'random');
  };
  const reset = () => {
    focus('full');
    apply(defaultAppearanceFor(body), 'reset');
  };

  const requestRandomize = () => {
    setConfirmRequest({
      title: '¿Cambiar todo al azar?',
      message: 'Se reemplazan nombre y apariencia. Podrás deshacer si te arrepientes.',
      confirmLabel: 'Al azar',
      cancelLabel: UI.cancel,
      onConfirm: randomize,
    });
  };

  const requestRandomizeLook = () => {
    setConfirmRequest({
      title: '¿Cambiar solo la apariencia?',
      message: 'Se mantiene el nombre y se genera un look nuevo.',
      confirmLabel: 'Cambiar look',
      cancelLabel: UI.cancel,
      onConfirm: randomizeLook,
    });
  };

  const requestReset = () => {
    setConfirmRequest({
      title: '¿Volver al personaje inicial?',
      message: 'Se pierde el look actual. Podrás deshacer después.',
      confirmLabel: 'Restablecer',
      cancelLabel: UI.cancel,
      tone: 'danger',
      onConfirm: reset,
    });
  };

  const switchBody = (next: BodyType) => {
    if (next === body) return;
    setHistory((h) => [...h.slice(-29), appearance]);
    lastKeyRef.current = null;
    focus('full');
    onSwitchBody(next);
  };

  const requestSwitchBody = (next: BodyType) => {
    if (next === body) return;
    setConfirmRequest({
      title: '¿Cambiar de personaje?',
      message: 'Pasarás a otra silueta y el look actual se reemplaza.',
      confirmLabel: 'Cambiar',
      cancelLabel: UI.cancel,
      onConfirm: () => switchBody(next),
    });
  };

  const finish = () => {
    setNameTouched(true);
    if (!nameValid) return;
    const trimmed = appearance.name.trim();
    if (trimmed !== appearance.name) {
      apply({ ...appearance, name: trimmed }, 'name');
    }
    setRecentNames(pushRecent(RECENT_KEYS.characterNames, trimmed));
    onClose();
  };

  const selectTab = (next: Tab) => {
    setTab(next);
    focus(TAB_FOCUS[next]);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (confirmRequest) return;
      if (isTypingTarget(e.target)) {
        if (e.code === 'Enter' && !e.shiftKey) {
          (e.target as HTMLElement).blur();
        }
        return;
      }
      if (e.code === 'Escape' && onCancel) {
        e.preventDefault();
        onCancel();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.code === 'KeyZ') {
        e.preventDefault();
        undo();
        return;
      }
      const tabMatch = /^(?:Digit|Numpad)([1-4])$/.exec(e.code);
      if (tabMatch && !e.metaKey && !e.ctrlKey) {
        const idx = parseInt(tabMatch[1], 10) - 1;
        const next = TABS[idx];
        if (next) selectTab(next.id);
        return;
      }
      if (e.code === 'Enter') {
        e.preventDefault();
        finish();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmRequest, history, appearance.name, nameValid, onCancel]);

  const panelPosition = portrait
    ? 'inset-x-0 bottom-0 max-h-[56%] rounded-t-3xl border-t'
    : embeddedInLobby
      ? 'right-0 top-14 bottom-0 w-[min(390px,46vw)] border-l'
      : 'right-0 top-0 bottom-0 w-[min(390px,46vw)] border-l';

  return (
    <div className="absolute inset-0 pointer-events-none text-cozy-ink">
      <div
        className={`absolute flex flex-col gap-1 ${
          portrait
            ? `${embeddedInLobby ? 'top-16' : 'top-4'} inset-x-4 items-center text-center`
            : `${embeddedInLobby ? 'top-18' : 'top-6'} left-6 max-w-[40%]`
        }`}
      >
        <span className={`inline-flex items-center gap-1.5 ${portrait ? 'self-center' : 'self-start'} px-3 py-1 rounded-full cozy-chip text-[10px] tracking-wider text-cozy-accent-deep font-semibold`}>
          <Sparkles className="w-3 h-3 text-cozy-accent-deep" />
          <span>Generador de personajes</span>
        </span>
        <h2
          className="text-2xl sm:text-3xl font-display font-bold text-white drop-shadow-[0_2px_10px_rgba(61,74,82,0.45)] truncate max-w-full"
          style={{ fontFamily: 'Fraunces, serif' }}
        >
          {appearance.name || 'Sin nombre'}
        </h2>
        <span
          className={`${portrait ? 'self-center' : 'self-start'} px-2.5 py-0.5 rounded-full cozy-chip text-[10px] text-cozy-muted`}
        >
          {portrait ? 'Desliza para girar · pellizca para acercar' : 'Arrastra para girar · rueda para acercar'}
        </span>
        {onZoom && (
          <div className={`${portrait ? 'self-center' : 'self-start'} pointer-events-auto flex items-center gap-1.5 mt-1`}>
            <button
              type="button"
              onClick={() => onZoom(-0.12)}
              className="flex items-center gap-1 px-2 py-1.5 rounded-xl cozy-chip text-cozy-ink cursor-pointer text-[10px] font-semibold"
              title="Acercar"
              aria-label="Acercar"
            >
              <ZoomIn className="w-4 h-4" />
              <span>Acercar</span>
            </button>
            <button
              type="button"
              onClick={() => onZoom(0.12)}
              className="flex items-center gap-1 px-2 py-1.5 rounded-xl cozy-chip text-cozy-ink cursor-pointer text-[10px] font-semibold"
              title="Alejar"
              aria-label="Alejar"
            >
              <ZoomOut className="w-4 h-4" />
              <span>Alejar</span>
            </button>
          </div>
        )}
      </div>

      {/* Editor panel */}
      <div
        className={`absolute ${panelPosition} pointer-events-auto flex flex-col cozy-panel backdrop-blur-md`}
      >
        {/* Character selector + name + randomizers */}
        <div className="flex flex-col gap-3 p-4 pb-3 border-b border-cozy-line">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-cozy-panel-deep border border-cozy-line" role="radiogroup" aria-label="Personaje">
            {BODY_TYPES.map((b) => {
              const selected = body === b.id;
              const Icon = b.id === 'chica' ? Venus : Mars;
              return (
                <button
                  key={b.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => requestSwitchBody(b.id)}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                    selected
                      ? b.id === 'chica'
                        ? 'bg-cozy-blush text-white shadow-md'
                        : 'bg-cozy-sky text-white shadow-md'
                      : 'text-cozy-muted hover:text-cozy-ink'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {b.name}
                </button>
              );
            })}
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-cozy-muted uppercase tracking-wider">
                Nombre
              </label>
              <span className="text-[10px] text-cozy-soft">
                {appearance.name.length}/{CHARACTER_NAME_MAX}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={appearance.name}
                maxLength={CHARACTER_NAME_MAX}
                placeholder={body === 'chica' ? 'Nombre de tu viajera' : 'Nombre de tu viajero'}
                onChange={(e) => set('name', sanitizeCharacterNameInput(e.target.value))}
                onBlur={() => setNameTouched(true)}
                className="flex-1 min-w-0 px-3 py-2 rounded-xl cozy-input text-sm font-semibold placeholder:text-cozy-soft select-text"
                aria-label="Nombre del personaje"
                aria-invalid={Boolean(nameError)}
              />
              <button
                type="button"
                onClick={() => {
                  set('name', generateRandomName(body));
                  setNameTouched(true);
                }}
                title="Nombre aleatorio"
                aria-label="Nombre aleatorio"
                className="p-2 rounded-xl cozy-btn text-cozy-accent-deep cursor-pointer active:scale-95"
              >
                <Dices className="w-4 h-4" />
              </button>
            </div>
            <RecentChips
              label="Nombres recientes"
              items={recentNames}
              onPick={(value) => {
                set('name', sanitizeCharacterNameInput(value));
                setNameTouched(true);
              }}
            />
            <RecentChips
              label="Sugerencias"
              items={NAME_SUGGESTIONS[body]}
              onPick={(value) => {
                set('name', sanitizeCharacterNameInput(value));
                setNameTouched(true);
              }}
            />
            <SuggestionList
              query={appearance.name}
              options={[...recentNames, ...NAME_SUGGESTIONS[body]]}
              onPick={(value) => {
                set('name', sanitizeCharacterNameInput(value));
                setNameTouched(true);
              }}
            />
            <RequirementList items={nameReqs} show={nameTouched || appearance.name.length > 0} />
            <FieldError message={nameError} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={requestRandomize}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl cozy-btn-primary font-bold text-xs cursor-pointer active:scale-95"
            >
              <Dices className="w-4 h-4" />
              ¡Generar al azar!
            </button>
            <button
              type="button"
              onClick={requestRandomizeLook}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl cozy-btn font-semibold text-xs cursor-pointer active:scale-95"
              title="Cambia la apariencia y conserva el nombre"
            >
              <Shuffle className="w-4 h-4 text-cozy-accent-deep" />
              Solo apariencia
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-3 pt-3" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => selectTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer ${
                tab === t.id
                  ? 'bg-cozy-panel-deep text-cozy-accent-deep border border-cozy-line'
                  : 'text-cozy-muted hover:text-cozy-ink border border-transparent'
              }`}
            >
              {t.icon}
              <span>{t.name}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5 overscroll-contain touch-pan-y">
          {tab === 'cuerpo' && (
            <>
              <Section title="Tono de piel" onFocus={() => focus('head')}>
                <Swatches label="Tono de piel" colors={SKIN_TONES} value={appearance.skinColor} onPick={(c) => set('skinColor', c)} />
              </Section>
              <Section title="Ojos" onFocus={() => focus('head')}>
                <Chips options={EYE_STYLES} value={appearance.eyeStyle} onPick={(v) => set('eyeStyle', v)} />
              </Section>
              <Section title="Detalle" onFocus={() => focus('head')}>
                <Chips options={ACCESSORIES} value={appearance.accessory} onPick={(v) => set('accessory', v)} />
              </Section>
              <Section title="Estatura" onFocus={() => focus('full')}>
                <Slider
                  label="Estatura"
                  value={appearance.height}
                  min={0.88}
                  max={1.12}
                  onChange={(v) => set('height', v)}
                  leftLabel="Bajito"
                  rightLabel="Alto"
                />
              </Section>
              <Section title="Complexión" onFocus={() => focus('full')}>
                <Slider
                  label="Complexión"
                  value={appearance.build}
                  min={0.88}
                  max={1.15}
                  onChange={(v) => set('build', v)}
                  leftLabel="Delgado"
                  rightLabel="Rellenito"
                />
              </Section>
            </>
          )}

          {tab === 'pelo' && (
            <>
              <Section title="Peinado" onFocus={() => focus('head')}>
                <Chips options={hairStylesFor(body)} value={appearance.hairStyle} onPick={(v) => set('hairStyle', v)} />
              </Section>
              <Section title="Color de pelo" onFocus={() => focus('head')}>
                <Swatches label="Color de pelo" colors={HAIR_COLORS} value={appearance.hairColor} onPick={(c) => set('hairColor', c)} />
              </Section>
            </>
          )}

          {tab === 'ropa' && (
            <>
              <Section title="Estilo de ropa" onFocus={() => focus('torso')}>
                <Chips options={outfitStylesFor(body)} value={appearance.outfitStyle} onPick={(v) => set('outfitStyle', v)} />
              </Section>
              <Section title="Color de la ropa" onFocus={() => focus('torso')}>
                <Swatches label="Color de la ropa" colors={CLOTH_COLORS} value={appearance.sweaterColor} onPick={(c) => set('sweaterColor', c)} />
              </Section>
              <Section title="Color de detalles" onFocus={() => focus('torso')}>
                <Swatches label="Color de detalles" colors={CLOTH_COLORS} value={appearance.detailColor} onPick={(c) => set('detailColor', c)} />
              </Section>
              <Section
                title="Patrón de tela"
                aside={
                  <span className="text-[10px] text-cozy-muted tabular-nums">
                    {SHIRT_PATTERNS.filter((p) => !p.defaultUnlocked && isPatternUnlocked(p.id)).length}/{SHIRT_PATTERNS.filter((p) => !p.defaultUnlocked).length} desbloqueados
                  </span>
                }
                onFocus={() => focus('torso')}
              >
                <div className="grid grid-cols-3 gap-2">
                  {SHIRT_PATTERNS.map((p) => {
                    const unlocked = isPatternUnlocked(p.id);
                    const selected = (appearance.shirtPattern ?? 'liso') === p.id;
                    const swatchUrl = getPatternSwatchUrl(p.id, appearance.sweaterColor, appearance.detailColor);
                    if (!unlocked) {
                      return (
                        <div
                          key={p.id}
                          title={`${p.name}: Completa misiones diarias para desbloquearlo`}
                          aria-disabled="true"
                          className="flex flex-col items-center gap-1.5 p-2 rounded-xl border border-dashed border-cozy-line bg-cozy-panel-deep/65 opacity-75 text-center"
                        >
                          <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-cozy-line/80 shrink-0">
                            {swatchUrl ? (
                              <img src={swatchUrl} alt={p.name} className="w-full h-full object-cover grayscale opacity-55" />
                            ) : (
                              <div className="w-full h-full" style={{ backgroundColor: appearance.sweaterColor }} />
                            )}
                            <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-white">
                              <Lock className="w-3.5 h-3.5" />
                            </span>
                          </div>
                          <span className="text-[10px] font-semibold text-cozy-muted leading-tight line-clamp-1">
                            {p.name}
                          </span>
                          <span className="text-[9px] text-cozy-accent-deep/85 leading-none">
                            Misión diaria
                          </span>
                        </div>
                      );
                    }
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => set('shirtPattern', p.id)}
                        title={p.desc}
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border text-center cursor-pointer transition-all active:scale-95 ${
                          selected
                            ? 'bg-[#fff1de] border-cozy-accent ring-1 ring-cozy-accent/40'
                            : 'cozy-panel-soft hover:border-cozy-sky'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-lg overflow-hidden border border-black/10 shrink-0">
                          {swatchUrl ? (
                            <img src={swatchUrl} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full" style={{ backgroundColor: appearance.sweaterColor }} />
                          )}
                        </div>
                        <span className="text-[10px] font-bold text-cozy-ink leading-tight line-clamp-1">
                          {p.name}
                        </span>
                        <span className="text-[9px] text-cozy-muted leading-none">
                          {selected ? 'Equipado' : p.biomeHint}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Section>
              <Section title="Para la cabeza" onFocus={() => focus('head')}>
                <Chips options={hatStylesFor(body)} value={appearance.hatStyle} onPick={(v) => set('hatStyle', v)} />
              </Section>
              <Section title="Color del gorro y puños" onFocus={() => focus('head')}>
                <Swatches label="Color del gorro" colors={CLOTH_COLORS} value={appearance.hatColor} onPick={(c) => set('hatColor', c)} />
              </Section>
              <Section title="Bufanda" onFocus={() => focus('torso')}>
                <Swatches label="Bufanda" colors={CLOTH_COLORS} value={appearance.scarfColor} onPick={(c) => set('scarfColor', c)} />
              </Section>
              <Section title="Botas" onFocus={() => focus('feet')}>
                <Swatches label="Botas" colors={BOOT_COLORS} value={appearance.bootColor} onPick={(c) => set('bootColor', c)} />
              </Section>
              <Section title="Equipo" onFocus={() => focus('torso')}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={appearance.backpack}
                  onClick={() => set('backpack', !appearance.backpack)}
                  className={`flex items-center gap-3 p-3 rounded-2xl border text-left cursor-pointer transition-colors ${
                    appearance.backpack
                      ? 'bg-[#fff1de] border-[#f0c48a]'
                      : 'cozy-panel-soft hover:border-cozy-sky'
                  }`}
                >
                  <Backpack className={`w-5 h-5 ${appearance.backpack ? 'text-cozy-accent-deep' : 'text-cozy-muted'}`} />
                  <div className="flex-1">
                    <div className="text-xs font-bold">Mochila de aventurero</div>
                    <div className="text-[10px] text-cozy-muted">Con petate, cantimplora y farolito</div>
                  </div>
                  <span
                    className={`w-9 h-5 rounded-full p-0.5 transition-colors ${appearance.backpack ? 'bg-cozy-accent' : 'bg-cozy-soft'}`}
                  >
                    <span
                      className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                        appearance.backpack ? 'translate-x-4' : ''
                      }`}
                    />
                  </span>
                </button>
              </Section>
            </>
          )}

          {tab === 'companero' && (
            <Section title="Compañero flotante" onFocus={() => focus('companion')}>
              <div className="grid grid-cols-2 gap-2">
                {COMPANIONS.map((c) => {
                  const selected = appearance.companion === c.id;
                  const unlocked = isCompanionUnlocked(c.id);
                  const lvl = unlockLevelFor(c.id);
                  if (!unlocked) {
                    return (
                      <div
                        key={c.id}
                        className="flex flex-col gap-1 p-3 rounded-2xl border border-dashed border-cozy-line bg-cozy-panel-deep text-left opacity-80"
                        aria-disabled="true"
                      >
                        <span className="flex items-center gap-1.5 text-cozy-soft">
                          {COMPANION_ICONS[c.id]}
                          <Lock className="w-3.5 h-3.5" />
                        </span>
                        <span className="text-xs font-bold text-cozy-muted">{c.name}</span>
                        <span className="text-[10px] text-cozy-accent-deep/90 leading-snug">
                          Completa el nivel {lvl} para desbloquearlo
                        </span>
                        {COMPANION_POWERS[c.id] && (
                          <span className="text-[10px] leading-snug text-cozy-soft">
                            Poder: {COMPANION_POWERS[c.id]!.powerName}
                          </span>
                        )}
                      </div>
                    );
                  }
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => set('companion', c.id)}
                      className={`flex flex-col gap-1 p-3 rounded-2xl border text-left cursor-pointer transition-all active:scale-95 ${
                        selected
                          ? 'bg-[#fff1de] border-cozy-accent ring-1 ring-cozy-accent/40'
                          : 'cozy-panel-soft hover:border-cozy-sky'
                      }`}
                    >
                      <span className={selected ? 'text-cozy-accent-deep' : 'text-cozy-muted'}>{COMPANION_ICONS[c.id]}</span>
                      <span className="text-xs font-bold">{c.name}</span>
                      <span className="text-[10px] text-cozy-muted leading-snug">{c.desc}</span>
                      {COMPANION_POWERS[c.id] && (
                        <span className="mt-1 text-[10px] leading-snug text-cozy-moss">
                          <strong>Poder: {COMPANION_POWERS[c.id]!.powerName}.</strong> {COMPANION_POWERS[c.id]!.desc}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </Section>
          )}
        </div>

        <div className="flex items-center gap-2 p-3 border-t border-cozy-line pb-safe">
          <button
            type="button"
            onClick={undo}
            disabled={!history.length}
            title={UI.undo}
            aria-label={UI.undo}
            className="p-2.5 rounded-xl cozy-btn enabled:hover:border-cozy-sky disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={requestReset}
            title="Restablecer personaje original"
            aria-label="Restablecer"
            className="p-2.5 rounded-xl cozy-btn cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className={BTN.secondary}
            >
              {UI.cancel}
            </button>
          )}
          <button
            type="button"
            onClick={finish}
            disabled={!nameValid}
            className={`flex-1 ${BTN.primary} flex items-center justify-center gap-2 active:scale-95`}
          >
            <Check className="w-4 h-4" />
            {UI.done}
          </button>
        </div>
      </div>

      <ConfirmDialog request={confirmRequest} onCancel={() => setConfirmRequest(null)} />
    </div>
  );
};
