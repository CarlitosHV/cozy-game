import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Backpack,
  Check,
  Cloud,
  Dices,
  Glasses,
  HardHat,
  Layers,
  Loader2,
  Lock,
  Mars,
  Palette,
  RefreshCw,
  RotateCcw,
  Scissors,
  Shirt,
  ShoppingBag,
  Shuffle,
  Smile,
  Sparkles,
  Star,
  Bug,
  Undo2,
  UserRound,
  Venus,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { CharacterPreviewFocus } from '../game/GameEngine';
import { UI } from '../ui/labels';
import {
  ACCESSORIES,
  BODY_TYPES,
  BOOT_COLORS,
  BodyType,
  CLOTH_COLORS,
  COMPANIONS,
  CharacterAppearance,
  CompanionStyle,
  EYE_STYLES,
  HAIR_COLORS,
  NAME_SUGGESTIONS,
  SKIN_TONES,
  colorLabel,
  defaultAppearanceFor,
  generateRandomAppearance,
  generateRandomName,
  hairStylesFor,
  hatStylesFor,
  outfitStylesFor,
} from '../game/character';
import { COMPANION_POWERS } from '../game/companionPowers';
import { isCompanionUnlocked, unlockLevelFor } from '../game/progress';
import { SHIRT_PATTERNS, getPatternSwatchUrl } from '../game/patterns';
import { isPatternUnlocked, subscribeDailyMissions } from '../game/dailyMissions';
import {
  apiClient,
  ShopCategory,
  ShopItem,
  ShopRarity,
  User,
} from '../services/apiClient';
import {
  SHOP_CATEGORY_LABELS,
  applyShopItemToAppearance,
  fetchOwnedShopItems,
} from '../game/shopCosmetics';
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
import { friendlyError } from '../utils/locale';

type Tab = 'cuerpo' | 'pelo' | 'ropa' | 'companero' | 'compras';

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
  currentUser?: User | null;
  onOpenShop?: () => void;
  onOpenAuth?: () => void;
  onToast?: (msg: string, ms?: number, tone?: 'neutral' | 'success' | 'error') => void;
}

const TAB_FOCUS: Record<Tab, CharacterPreviewFocus> = {
  cuerpo: 'full',
  pelo: 'head',
  ropa: 'torso',
  companero: 'companion',
  compras: 'full',
};

const CATEGORY_FOCUS: Record<ShopCategory, CharacterPreviewFocus> = {
  skin: 'head',
  hair: 'head',
  glasses: 'head',
  hat: 'head',
  outfit: 'torso',
  pattern: 'torso',
  backpack: 'torso',
  companion: 'companion',
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
  { id: 'companero', name: 'Compa', icon: <Sparkles className="w-3.5 h-3.5" /> },
  { id: 'compras', name: 'Compras', icon: <ShoppingBag className="w-3.5 h-3.5" /> },
];

const RARITY_BADGE: Record<
  ShopRarity,
  { label: string; lineColor: string; pillClass: string }
> = {
  common: {
    label: 'Común',
    lineColor: '#94a3b8',
    pillClass: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  rare: {
    label: 'Raro',
    lineColor: '#38bdf8',
    pillClass: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  epic: {
    label: 'Épico',
    lineColor: '#a78bfa',
    pillClass: 'bg-violet-50 text-violet-700 border-violet-200',
  },
  legendary: {
    label: 'Legendario',
    lineColor: '#f59e0b',
    pillClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
};

function shopCategoryIcon(cat: ShopCategory) {
  switch (cat) {
    case 'skin':
      return <Palette className="w-3.5 h-3.5" />;
    case 'hat':
      return <HardHat className="w-3.5 h-3.5" />;
    case 'outfit':
      return <Shirt className="w-3.5 h-3.5" />;
    case 'pattern':
      return <Layers className="w-3.5 h-3.5" />;
    case 'glasses':
      return <Glasses className="w-3.5 h-3.5" />;
    case 'backpack':
      return <Backpack className="w-3.5 h-3.5" />;
    case 'hair':
      return <Scissors className="w-3.5 h-3.5" />;
    case 'companion':
      return <Sparkles className="w-3.5 h-3.5" />;
  }
}

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
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] text-cozy-accent-deep font-extrabold uppercase tracking-wider">
        {title}
      </span>
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
    <div className="p-2.5 rounded-2xl bg-white/60 border border-cozy-line/80">
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
                  ? 'border-cozy-accent-deep ring-2 ring-cozy-accent/60 ring-offset-2 ring-offset-white scale-110'
                  : 'border-black/15 hover:scale-110'
              }`}
              style={{ backgroundColor: c }}
            />
          );
        })}
        <label
          title="Color personalizado"
          className={`relative w-7 h-7 rounded-full border cursor-pointer overflow-hidden transition-transform hover:scale-110 ${
            isCustom
              ? 'border-cozy-accent-deep ring-2 ring-cozy-accent/60 ring-offset-2 ring-offset-white scale-110'
              : 'border-black/15'
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
      <p className="mt-2 text-[10px] text-cozy-muted">
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
                ? 'cozy-tab-active border-transparent shadow-xs'
                : 'bg-white/70 hover:bg-white text-cozy-ink border-cozy-line hover:border-cozy-sky'
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
  <div className="flex flex-col gap-1 px-3 py-2.5 rounded-2xl bg-white/60 border border-cozy-line/80">
    <input
      type="range"
      min={min}
      max={max}
      step={0.01}
      value={value}
      aria-label={label}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full accent-cozy-accent-deep cursor-pointer"
    />
    <div className="flex justify-between text-[10px] font-medium text-cozy-muted">
      <span>{leftLabel}</span>
      <span>{rightLabel}</span>
    </div>
  </div>
);

// ---------- Owned Shop Cosmetic Card ----------

const OwnedShopCard: React.FC<{
  item: ShopItem;
  equipped: boolean;
  busy: boolean;
  appearance: CharacterAppearance;
  onEquip: (item: ShopItem) => void;
  onUnequip?: (item: ShopItem) => void;
  compact?: boolean;
}> = ({ item, equipped, busy, appearance, onEquip, onUnequip, compact = false }) => {
  const rarity = RARITY_BADGE[item.rarity] ?? RARITY_BADGE.common;
  const patchPattern =
    item.category === 'pattern' && typeof item.appearancePatch?.pattern === 'string'
      ? (item.appearancePatch.pattern as CharacterAppearance['shirtPattern'])
      : undefined;
  const patternUrl = patchPattern
    ? getPatternSwatchUrl(patchPattern, appearance.sweaterColor, appearance.detailColor)
    : undefined;
  const patchCompanion =
    item.category === 'companion' && typeof item.appearancePatch?.companion === 'string'
      ? (item.appearancePatch.companion as CompanionStyle)
      : undefined;
  const removable =
    equipped &&
    onUnequip &&
    (item.category === 'hat' ||
      item.category === 'glasses' ||
      item.category === 'backpack' ||
      item.category === 'companion');

  return (
    <div
      className={`relative flex flex-col justify-between rounded-2xl border overflow-hidden transition-all shadow-xs ${
        equipped
          ? 'bg-white/95 border-amber-400/90 ring-1 ring-amber-400/50'
          : 'bg-white/75 hover:bg-white/95 border-cozy-line'
      }`}
    >
      <div className="h-1 w-full" style={{ backgroundColor: rarity.lineColor }} />
      <div className={compact ? 'p-2.5 flex items-center gap-2.5' : 'p-3 flex flex-col gap-2'}>
        <div className={compact ? 'flex items-center gap-2.5 min-w-0 flex-1' : 'flex items-start gap-2.5'}>
          {/* Swatch / Visual Thumbnail */}
          <div className="w-9 h-9 rounded-xl border border-black/10 shrink-0 overflow-hidden flex items-center justify-center bg-white/90 shadow-inner">
            {patternUrl ? (
              <img src={patternUrl} alt={item.name} className="w-full h-full object-cover" />
            ) : patchCompanion && COMPANION_ICONS[patchCompanion] ? (
              <span className="text-cozy-accent-deep">{COMPANION_ICONS[patchCompanion]}</span>
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-white/90"
                style={{
                  background: `linear-gradient(135deg, ${item.previewColor || '#f59e0b'}, ${item.previewColor || '#f59e0b'}cc)`,
                }}
              >
                {shopCategoryIcon(item.category)}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-cozy-ink truncate">{item.name}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className={`px-1.5 py-px rounded text-[9px] font-bold border ${rarity.pillClass}`}>
                {rarity.label}
              </span>
              {!compact && (
                <span className="text-[10px] text-cozy-muted truncate">
                  {SHOP_CATEGORY_LABELS[item.category]}
                </span>
              )}
            </div>
          </div>
        </div>

        {!compact && item.description && (
          <p className="text-[11px] text-cozy-muted leading-snug line-clamp-2">{item.description}</p>
        )}

        <div className={compact ? 'shrink-0 flex items-center gap-1' : 'pt-1 flex items-center gap-1.5'}>
          {equipped ? (
            <>
              <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-extrabold">
                <Check className="w-3 h-3" />
                Equipado
              </span>
              {removable && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onUnequip(item)}
                  title="Quitar objeto"
                  className="px-2 py-1.5 rounded-xl bg-white hover:bg-rose-50 border border-cozy-line hover:border-rose-200 text-cozy-muted hover:text-rose-600 text-[10px] font-bold cursor-pointer transition-colors disabled:opacity-50"
                >
                  Quitar
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => onEquip(item)}
              className={`${compact ? 'px-3 py-1.5' : 'w-full py-1.5 px-3'} rounded-xl cozy-btn-primary text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95`}
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              <span>Equipar</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

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
  currentUser,
  onOpenShop,
  onOpenAuth,
  onToast,
}) => {
  const [tab, setTab] = useState<Tab>('cuerpo');
  const [history, setHistory] = useState<CharacterAppearance[]>([]);
  const [nameTouched, setNameTouched] = useState(false);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [recentNames, setRecentNames] = useState<string[]>(() => getRecent(RECENT_KEYS.characterNames));
  const [, setMissionTick] = useState(0);
  const [previewFocus, setPreviewFocus] = useState<CharacterPreviewFocus>('full');

  // Owned Shop Cosmetics State
  const [ownedItems, setOwnedItems] = useState<ShopItem[]>([]);
  const [loadingOwned, setLoadingOwned] = useState(false);
  const [busyEquipId, setBusyEquipId] = useState<string | null>(null);
  const [shopFilterCat, setShopFilterCat] = useState<'all' | ShopCategory>('all');

  const lastKeyRef = useRef<string | null>(null);
  const isAuth = apiClient.isAuthenticated();

  const loadOwned = useCallback(async () => {
    if (!apiClient.isAuthenticated()) {
      setOwnedItems([]);
      return;
    }
    setLoadingOwned(true);
    try {
      const { ownedItems: items } = await fetchOwnedShopItems(appearance);
      setOwnedItems(items);
    } catch {
      // keep existing items if offline
    } finally {
      setLoadingOwned(false);
    }
  }, [currentUser?._id]);

  useEffect(() => {
    onFocusChange?.('full');
    setPreviewFocus('full');
    return subscribeDailyMissions(() => setMissionTick((v) => v + 1));
  }, []);

  useEffect(() => {
    void loadOwned();
  }, [loadOwned]);

  const focus = (next: CharacterPreviewFocus) => {
    setPreviewFocus(next);
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

  const withoutOwnedIdsInCategories = (
    ids: string[] | undefined,
    categories: ShopCategory[]
  ): string[] | undefined => {
    if (!Array.isArray(ids) || ids.length === 0) return ids;
    const blocked = new Set(
      ownedItems.filter((i) => categories.includes(i.category)).map((i) => i.id)
    );
    const filtered = ids.filter((id) => !blocked.has(id));
    return filtered;
  };

  const set = <K extends keyof CharacterAppearance>(key: K, value: CharacterAppearance[K]) => {
    const next: CharacterAppearance = { ...appearance, [key]: value };
    // Clear shop variant overrides when explicitly switching back to a base style
    if (key === 'outfitStyle') {
      delete next.outfitVariant;
      delete next.accentGlowColor;
      next.equippedShopIds = withoutOwnedIdsInCategories(next.equippedShopIds, ['outfit']);
    } else if (key === 'hatStyle') {
      delete next.hatVariant;
      next.equippedShopIds = withoutOwnedIdsInCategories(next.equippedShopIds, ['hat']);
    } else if (key === 'hairStyle') {
      delete next.hairVariant;
      next.equippedShopIds = withoutOwnedIdsInCategories(next.equippedShopIds, ['hair']);
    } else if (key === 'skinColor') {
      delete next.skinVariant;
      next.equippedShopIds = withoutOwnedIdsInCategories(next.equippedShopIds, ['skin']);
    } else if (key === 'accessory') {
      delete next.glassesVariant;
      delete next.glassesColor;
      next.equippedShopIds = withoutOwnedIdsInCategories(next.equippedShopIds, ['glasses']);
    } else if (key === 'backpack') {
      delete next.backpackVariant;
      delete next.backpackColor;
      next.equippedShopIds = withoutOwnedIdsInCategories(next.equippedShopIds, ['backpack']);
    } else if (key === 'shirtPattern') {
      next.equippedShopIds = withoutOwnedIdsInCategories(next.equippedShopIds, ['pattern']);
    } else if (key === 'companion') {
      next.equippedShopIds = withoutOwnedIdsInCategories(next.equippedShopIds, ['companion']);
    }
    apply(next, key);
  };

  const isShopItemEquipped = useCallback(
    (item: ShopItem): boolean => {
      if (Array.isArray(appearance.equippedShopIds)) {
        return appearance.equippedShopIds.includes(item.id);
      }
      return Boolean(item.equipped);
    },
    [appearance.equippedShopIds]
  );

  const handleEquipShopItem = async (item: ShopItem) => {
    if (busyEquipId) return;
    setBusyEquipId(item.id);
    focus(CATEGORY_FOCUS[item.category] ?? 'full');

    const prevIds = Array.isArray(appearance.equippedShopIds)
      ? appearance.equippedShopIds
      : ownedItems.filter((i) => i.equipped).map((i) => i.id);
    const sameCatIds = new Set(
      ownedItems.filter((i) => i.category === item.category).map((i) => i.id)
    );
    const optimisticIds = [...prevIds.filter((id) => !sameCatIds.has(id)), item.id];

    try {
      if (apiClient.isAuthenticated()) {
        const res = await apiClient.equipShopItems(item.id);
        const serverEq = Array.isArray(res?.equippedItems) ? res.equippedItems : optimisticIds;
        const next = applyShopItemToAppearance(appearance, item, res?.appearance, serverEq);
        setHistory((h) => [...h.slice(-29), appearance]);
        lastKeyRef.current = `shop-${item.id}`;
        onChange(next);
        setOwnedItems((cur) =>
          cur.map((entry) =>
            entry.category === item.category
              ? { ...entry, equipped: entry.id === item.id || serverEq.includes(entry.id) }
              : { ...entry, equipped: serverEq.includes(entry.id) }
          )
        );
      } else {
        const next = applyShopItemToAppearance(appearance, item, undefined, optimisticIds);
        setHistory((h) => [...h.slice(-29), appearance]);
        lastKeyRef.current = `shop-${item.id}`;
        onChange(next);
      }
      onToast?.(`¡${item.name} equipado!`, 2000, 'success');
    } catch (err) {
      onToast?.(friendlyError(err, 'No se pudo equipar el artículo.'), 2600, 'error');
    } finally {
      setBusyEquipId(null);
    }
  };

  const handleUnequipShopItem = (item: ShopItem) => {
    const next: CharacterAppearance = { ...appearance };
    next.equippedShopIds = withoutOwnedIdsInCategories(next.equippedShopIds, [item.category]);
    if (item.category === 'hat') {
      delete next.hatVariant;
      next.hatStyle = 'ninguno';
    } else if (item.category === 'glasses') {
      delete next.glassesVariant;
      delete next.glassesColor;
      next.accessory = 'ninguno';
    } else if (item.category === 'backpack') {
      delete next.backpackVariant;
      delete next.backpackColor;
      next.backpack = false;
    } else if (item.category === 'companion') {
      next.companion = 'ninguno';
    }
    setHistory((h) => [...h.slice(-29), appearance]);
    lastKeyRef.current = `unequip-${item.id}`;
    focus(CATEGORY_FOCUS[item.category] ?? 'full');
    onChange(next);
    setOwnedItems((cur) =>
      cur.map((entry) => (entry.id === item.id ? { ...entry, equipped: false } : entry))
    );
    onToast?.(`${item.name} quitado`, 1600, 'neutral');
  };

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
      const tabMatch = /^(?:Digit|Numpad)([1-5])$/.exec(e.code);
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

  const ownedCategoriesPresent = useMemo(() => {
    const setCats = new Set<ShopCategory>();
    for (const item of ownedItems) setCats.add(item.category);
    return Array.from(setCats);
  }, [ownedItems]);

  const filteredOwnedItems = useMemo(() => {
    if (shopFilterCat === 'all') return ownedItems;
    return ownedItems.filter((i) => i.category === shopFilterCat);
  }, [ownedItems, shopFilterCat]);

  const ownedBodyItems = useMemo(
    () => ownedItems.filter((i) => i.category === 'skin' || i.category === 'glasses'),
    [ownedItems]
  );
  const ownedHairItems = useMemo(
    () => ownedItems.filter((i) => i.category === 'hair'),
    [ownedItems]
  );
  const ownedClothingItems = useMemo(
    () =>
      ownedItems.filter(
        (i) => i.category === 'outfit' || i.category === 'hat' || i.category === 'backpack'
      ),
    [ownedItems]
  );
  const shopOwnedCompanions = useMemo(
    () =>
      new Set(
        ownedItems
          .filter((i) => i.category === 'companion' && typeof i.appearancePatch?.companion === 'string')
          .map((i) => i.appearancePatch!.companion as CompanionStyle)
      ),
    [ownedItems]
  );

  const panelPosition = portrait
    ? 'inset-x-0 bottom-0 max-h-[58%] rounded-t-3xl border-t'
    : embeddedInLobby
      ? 'right-0 top-14 bottom-0 w-[min(440px,48vw)] border-l'
      : 'right-0 top-0 bottom-0 w-[min(440px,48vw)] border-l';

  return (
    <div className="absolute inset-0 pointer-events-none text-cozy-ink">
      {/* Left 3D Studio Overlay: Floating Nameplate, Camera Focus Pills & Zoom */}
      <div
        className={`absolute flex flex-col gap-2 ${
          portrait
            ? `${embeddedInLobby ? 'top-16' : 'top-4'} inset-x-4 items-center text-center`
            : `${embeddedInLobby ? 'top-18' : 'top-6'} left-6 max-w-[42%]`
        }`}
      >
        <div
          className={`inline-flex items-center gap-2 ${portrait ? 'self-center' : 'self-start'} px-3.5 py-2 rounded-2xl bg-white/80 backdrop-blur-xl border border-white/80 shadow-lg`}
        >
          <Sparkles className="w-4 h-4 text-cozy-accent-deep shrink-0" />
          <div className="min-w-0 text-left">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-cozy-muted leading-none">
              Estudio de personaje
            </div>
            <div className="text-lg sm:text-xl font-display font-bold text-cozy-ink truncate leading-tight">
              {appearance.name || 'Sin nombre'}
            </div>
          </div>
        </div>

        <span
          className={`${portrait ? 'self-center' : 'self-start'} px-2.5 py-1 rounded-xl bg-white/75 backdrop-blur-md border border-white/75 text-[10px] font-medium text-cozy-muted shadow-xs`}
        >
          {portrait ? 'Desliza para girar · pellizca para acercar' : 'Arrastra para girar · rueda para acercar'}
        </span>

        {!portrait && (
          <div className="pointer-events-auto flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'full', label: 'Cuerpo' },
                { id: 'head', label: 'Cara / Gorro' },
                { id: 'torso', label: 'Ropa / Alas' },
                { id: 'companion', label: 'Compa' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => focus(f.id)}
                className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-all cursor-pointer backdrop-blur-md shadow-xs ${
                  previewFocus === f.id
                    ? 'bg-white/95 border-cozy-accent-deep/60 text-cozy-accent-deep'
                    : 'bg-white/72 hover:bg-white/90 border-white/75 text-cozy-ink'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {onZoom && (
          <div
            className={`${portrait ? 'self-center' : 'self-start'} pointer-events-auto flex items-center gap-1.5`}
          >
            <button
              type="button"
              onClick={() => onZoom(-0.12)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/78 hover:bg-white/95 backdrop-blur-xl border border-white/75 text-cozy-ink cursor-pointer text-[10px] font-bold shadow-md"
              title="Acercar"
              aria-label="Acercar"
            >
              <ZoomIn className="w-3.5 h-3.5" />
              <span>Acercar</span>
            </button>
            <button
              type="button"
              onClick={() => onZoom(0.12)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/78 hover:bg-white/95 backdrop-blur-xl border border-white/75 text-cozy-ink cursor-pointer text-[10px] font-bold shadow-md"
              title="Alejar"
              aria-label="Alejar"
            >
              <ZoomOut className="w-3.5 h-3.5" />
              <span>Alejar</span>
            </button>
          </div>
        )}
      </div>

      {/* Right Frosted White Studio Panel */}
      <div
        className={`absolute ${panelPosition} pointer-events-auto flex flex-col bg-white/82 backdrop-blur-xl border-white/75 shadow-2xl`}
      >
        {/* Character selector + name + randomizers */}
        <div className="flex flex-col gap-2.5 p-4 pb-3 border-b border-cozy-line/80 bg-white/45">
          <div
            className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-white/70 border border-cozy-line"
            role="radiogroup"
            aria-label="Personaje"
          >
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
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selected
                      ? b.id === 'chica'
                        ? 'bg-cozy-blush text-white shadow-sm'
                        : 'bg-cozy-sky text-white shadow-sm'
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
              <label className="text-[10px] font-extrabold text-cozy-muted uppercase tracking-wider">
                Nombre
              </label>
              <span className="text-[10px] text-cozy-soft tabular-nums">
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
                className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-white/85 border border-cozy-line text-sm font-semibold text-cozy-ink placeholder:text-cozy-soft focus:outline-none focus:border-cozy-sky select-text"
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
                className="p-2 rounded-xl bg-white/80 hover:bg-white border border-cozy-line text-cozy-accent-deep cursor-pointer active:scale-95 shadow-xs"
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
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl cozy-btn-primary font-bold text-xs cursor-pointer active:scale-95"
            >
              <Dices className="w-3.5 h-3.5" />
              ¡Al azar!
            </button>
            <button
              type="button"
              onClick={requestRandomizeLook}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/80 hover:bg-white border border-cozy-line text-cozy-ink font-semibold text-xs cursor-pointer active:scale-95 shadow-xs"
              title="Cambia la apariencia y conserva el nombre"
            >
              <Shuffle className="w-3.5 h-3.5 text-cozy-accent-deep" />
              Solo look
            </button>
          </div>
        </div>

        {/* 5 Tabs: Cuerpo | Pelo | Ropa | Compa | Mis Compras */}
        <div className="grid grid-cols-5 gap-1 px-3 pt-2.5 pb-1 bg-white/35 border-b border-cozy-line/60" role="tablist">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => selectTab(t.id)}
                className={`relative flex flex-col sm:flex-row items-center justify-center gap-1 px-1.5 py-2 rounded-xl text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer ${
                  active
                    ? 'bg-white text-cozy-accent-deep border border-cozy-line shadow-xs'
                    : 'text-cozy-muted hover:text-cozy-ink hover:bg-white/55 border border-transparent'
                }`}
              >
                {t.icon}
                <span className="truncate">{t.name}</span>
                {t.id === 'compras' && ownedItems.length > 0 && (
                  <span className="px-1 min-w-[16px] h-4 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-[9px] font-black flex items-center justify-center tabular-nums">
                    {ownedItems.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5 overscroll-contain touch-pan-y">
          {/* TAB 1: CUERPO */}
          {tab === 'cuerpo' && (
            <>
              {ownedBodyItems.length > 0 && (
                <Section
                  title="Comprados en tienda (Pieles y Lentes)"
                  aside={
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      {ownedBodyItems.length} tuyos
                    </span>
                  }
                  onFocus={() => focus('head')}
                >
                  <div className="flex flex-col gap-2">
                    {ownedBodyItems.map((item) => (
                      <OwnedShopCard
                        key={item.id}
                        item={item}
                        equipped={isShopItemEquipped(item)}
                        busy={busyEquipId === item.id}
                        appearance={appearance}
                        onEquip={handleEquipShopItem}
                        onUnequip={handleUnequipShopItem}
                        compact
                      />
                    ))}
                  </div>
                </Section>
              )}

              <Section title="Tono de piel" onFocus={() => focus('head')}>
                <Swatches
                  label="Tono de piel"
                  colors={SKIN_TONES}
                  value={appearance.skinColor}
                  onPick={(c) => set('skinColor', c)}
                />
              </Section>
              <Section title="Ojos" onFocus={() => focus('head')}>
                <Chips
                  options={EYE_STYLES}
                  value={appearance.eyeStyle}
                  onPick={(v) => set('eyeStyle', v)}
                />
              </Section>
              <Section title="Detalle facial" onFocus={() => focus('head')}>
                <Chips
                  options={ACCESSORIES}
                  value={appearance.accessory}
                  onPick={(v) => set('accessory', v)}
                />
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

          {/* TAB 2: PELO */}
          {tab === 'pelo' && (
            <>
              {ownedHairItems.length > 0 && (
                <Section
                  title="Peinados de tienda"
                  aside={
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      {ownedHairItems.length} tuyos
                    </span>
                  }
                  onFocus={() => focus('head')}
                >
                  <div className="flex flex-col gap-2">
                    {ownedHairItems.map((item) => (
                      <OwnedShopCard
                        key={item.id}
                        item={item}
                        equipped={isShopItemEquipped(item)}
                        busy={busyEquipId === item.id}
                        appearance={appearance}
                        onEquip={handleEquipShopItem}
                        compact
                      />
                    ))}
                  </div>
                </Section>
              )}

              <Section title="Peinado" onFocus={() => focus('head')}>
                <Chips
                  options={hairStylesFor(body)}
                  value={appearance.hairStyle}
                  onPick={(v) => set('hairStyle', v)}
                />
              </Section>
              <Section title="Color de pelo" onFocus={() => focus('head')}>
                <Swatches
                  label="Color de pelo"
                  colors={HAIR_COLORS}
                  value={appearance.hairColor}
                  onPick={(c) => set('hairColor', c)}
                />
              </Section>
            </>
          )}

          {/* TAB 3: ROPA */}
          {tab === 'ropa' && (
            <>
              {ownedClothingItems.length > 0 && (
                <Section
                  title="Comprados en tienda (Conjuntos, Gorros y Mochilas)"
                  aside={
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      {ownedClothingItems.length} tuyos
                    </span>
                  }
                  onFocus={() => focus('torso')}
                >
                  <div className="flex flex-col gap-2">
                    {ownedClothingItems.map((item) => (
                      <OwnedShopCard
                        key={item.id}
                        item={item}
                        equipped={isShopItemEquipped(item)}
                        busy={busyEquipId === item.id}
                        appearance={appearance}
                        onEquip={handleEquipShopItem}
                        onUnequip={handleUnequipShopItem}
                        compact
                      />
                    ))}
                  </div>
                </Section>
              )}

              <Section title="Estilo de ropa" onFocus={() => focus('torso')}>
                <Chips
                  options={outfitStylesFor(body)}
                  value={appearance.outfitStyle}
                  onPick={(v) => set('outfitStyle', v)}
                />
              </Section>
              <Section title="Color de la ropa" onFocus={() => focus('torso')}>
                <Swatches
                  label="Color de la ropa"
                  colors={CLOTH_COLORS}
                  value={appearance.sweaterColor}
                  onPick={(c) => set('sweaterColor', c)}
                />
              </Section>
              <Section title="Color de detalles" onFocus={() => focus('torso')}>
                <Swatches
                  label="Color de detalles"
                  colors={CLOTH_COLORS}
                  value={appearance.detailColor}
                  onPick={(c) => set('detailColor', c)}
                />
              </Section>
              <Section
                title="Patrón de tela"
                aside={
                  <span className="text-[10px] text-cozy-muted tabular-nums">
                    {SHIRT_PATTERNS.filter((p) => !p.defaultUnlocked && isPatternUnlocked(p.id)).length}/
                    {SHIRT_PATTERNS.filter((p) => !p.defaultUnlocked).length} desbloqueados
                  </span>
                }
                onFocus={() => focus('torso')}
              >
                <div className="grid grid-cols-3 gap-2">
                  {SHIRT_PATTERNS.map((p) => {
                    const unlocked = isPatternUnlocked(p.id);
                    const selected = (appearance.shirtPattern ?? 'liso') === p.id;
                    const swatchUrl = getPatternSwatchUrl(
                      p.id,
                      appearance.sweaterColor,
                      appearance.detailColor
                    );
                    if (!unlocked) {
                      return (
                        <div
                          key={p.id}
                          title={`${p.name}: Desbloquéalo en Misiones diarias o en la Tienda`}
                          aria-disabled="true"
                          className="flex flex-col items-center gap-1.5 p-2 rounded-xl border border-dashed border-cozy-line bg-white/45 opacity-75 text-center"
                        >
                          <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-cozy-line/80 shrink-0">
                            {swatchUrl ? (
                              <img
                                src={swatchUrl}
                                alt={p.name}
                                className="w-full h-full object-cover grayscale opacity-55"
                              />
                            ) : (
                              <div
                                className="w-full h-full"
                                style={{ backgroundColor: appearance.sweaterColor }}
                              />
                            )}
                            <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-white">
                              <Lock className="w-3.5 h-3.5" />
                            </span>
                          </div>
                          <span className="text-[10px] font-semibold text-cozy-muted leading-tight line-clamp-1">
                            {p.name}
                          </span>
                          <span className="text-[9px] text-cozy-accent-deep/85 leading-none">
                            Misión / Tienda
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
                            ? 'bg-amber-50/90 border-amber-400 ring-1 ring-amber-400/50 shadow-xs'
                            : 'bg-white/70 hover:bg-white border-cozy-line hover:border-cozy-sky'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-lg overflow-hidden border border-black/10 shrink-0">
                          {swatchUrl ? (
                            <img src={swatchUrl} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <div
                              className="w-full h-full"
                              style={{ backgroundColor: appearance.sweaterColor }}
                            />
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
                <Chips
                  options={hatStylesFor(body)}
                  value={appearance.hatStyle}
                  onPick={(v) => set('hatStyle', v)}
                />
              </Section>
              <Section title="Color del gorro y puños" onFocus={() => focus('head')}>
                <Swatches
                  label="Color del gorro"
                  colors={CLOTH_COLORS}
                  value={appearance.hatColor}
                  onPick={(c) => set('hatColor', c)}
                />
              </Section>
              <Section title="Bufanda" onFocus={() => focus('torso')}>
                <Swatches
                  label="Bufanda"
                  colors={CLOTH_COLORS}
                  value={appearance.scarfColor}
                  onPick={(c) => set('scarfColor', c)}
                />
              </Section>
              <Section title="Botas" onFocus={() => focus('feet')}>
                <Swatches
                  label="Botas"
                  colors={BOOT_COLORS}
                  value={appearance.bootColor}
                  onPick={(c) => set('bootColor', c)}
                />
              </Section>
              <Section title="Equipo" onFocus={() => focus('torso')}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={appearance.backpack}
                  onClick={() => set('backpack', !appearance.backpack)}
                  className={`flex items-center gap-3 p-3 rounded-2xl border text-left cursor-pointer transition-colors ${
                    appearance.backpack
                      ? 'bg-amber-50/90 border-amber-300 shadow-xs'
                      : 'bg-white/70 hover:bg-white border-cozy-line hover:border-cozy-sky'
                  }`}
                >
                  <Backpack
                    className={`w-5 h-5 ${
                      appearance.backpack ? 'text-cozy-accent-deep' : 'text-cozy-muted'
                    }`}
                  />
                  <div className="flex-1">
                    <div className="text-xs font-bold">Mochila de aventurero</div>
                    <div className="text-[10px] text-cozy-muted">
                      {appearance.backpackVariant
                        ? `Accesorio de tienda activo`
                        : 'Con petate, cantimplora y farolito'}
                    </div>
                  </div>
                  <span
                    className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                      appearance.backpack ? 'bg-cozy-accent-deep' : 'bg-cozy-soft'
                    }`}
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

          {/* TAB 4: COMPAÑERO */}
          {tab === 'companero' && (
            <Section title="Compañero flotante" onFocus={() => focus('companion')}>
              <div className="grid grid-cols-2 gap-2">
                {COMPANIONS.map((c) => {
                  const selected = appearance.companion === c.id;
                  const fromShop = shopOwnedCompanions.has(c.id);
                  const unlocked = isCompanionUnlocked(c.id) || fromShop;
                  const lvl = unlockLevelFor(c.id);
                  if (!unlocked) {
                    return (
                      <div
                        key={c.id}
                        className="flex flex-col gap-1 p-3 rounded-2xl border border-dashed border-cozy-line bg-white/45 text-left opacity-80"
                        aria-disabled="true"
                      >
                        <span className="flex items-center gap-1.5 text-cozy-soft">
                          {COMPANION_ICONS[c.id]}
                          <Lock className="w-3.5 h-3.5" />
                        </span>
                        <span className="text-xs font-bold text-cozy-muted">{c.name}</span>
                        <span className="text-[10px] text-cozy-accent-deep/90 leading-snug">
                          Completa el nivel {lvl} o cómpralo en la Tienda
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
                          ? 'bg-amber-50/90 border-amber-400 ring-1 ring-amber-400/50 shadow-xs'
                          : 'bg-white/75 hover:bg-white border-cozy-line hover:border-cozy-sky'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className={selected ? 'text-cozy-accent-deep' : 'text-cozy-muted'}>
                          {COMPANION_ICONS[c.id]}
                        </span>
                        {fromShop && (
                          <span className="px-1.5 py-px rounded bg-amber-100 border border-amber-200 text-amber-800 text-[9px] font-bold">
                            Tienda
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-bold">{c.name}</span>
                      <span className="text-[10px] text-cozy-muted leading-snug">{c.desc}</span>
                      {COMPANION_POWERS[c.id] && (
                        <span className="mt-1 text-[10px] leading-snug text-cozy-moss">
                          <strong>Poder: {COMPANION_POWERS[c.id]!.powerName}.</strong>{' '}
                          {COMPANION_POWERS[c.id]!.desc}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </Section>
          )}

          {/* TAB 5: MIS COMPRAS */}
          {tab === 'compras' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-cozy-accent-deep">
                    Mis artículos comprados
                  </h3>
                  <p className="text-[11px] text-cozy-muted">
                    Equipa cualquier cosmético que hayas adquirido con reliquias.
                  </p>
                </div>
                {isAuth && (
                  <button
                    type="button"
                    onClick={() => void loadOwned()}
                    disabled={loadingOwned}
                    title="Actualizar inventario"
                    className="p-2 rounded-xl bg-white/80 hover:bg-white border border-cozy-line text-cozy-ink cursor-pointer disabled:opacity-50 shadow-xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingOwned ? 'animate-spin' : ''}`} />
                  </button>
                )}
              </div>

              {!isAuth ? (
                <div className="p-5 rounded-2xl bg-white/75 border border-cozy-line text-center flex flex-col items-center gap-3 shadow-xs">
                  <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                    <UserRound className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-cozy-ink">Inicia sesión para ver tus compras</p>
                    <p className="text-xs text-cozy-muted mt-1">
                      Los objetos comprados en la Tienda de Reliquias se guardan en tu cuenta y aparecen aquí para equiparlos.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {onOpenAuth && (
                      <button
                        type="button"
                        onClick={onOpenAuth}
                        className="px-4 py-2 rounded-xl cozy-btn-primary text-xs font-bold cursor-pointer"
                      >
                        Iniciar sesión
                      </button>
                    )}
                    {onOpenShop && (
                      <button
                        type="button"
                        onClick={onOpenShop}
                        className="px-4 py-2 rounded-xl bg-white hover:bg-white/90 border border-cozy-line text-xs font-bold text-cozy-ink cursor-pointer"
                      >
                        Ver Tienda
                      </button>
                    )}
                  </div>
                </div>
              ) : loadingOwned && ownedItems.length === 0 ? (
                <div className="py-10 flex flex-col items-center justify-center gap-2 text-cozy-muted">
                  <Loader2 className="w-6 h-6 animate-spin text-cozy-accent-deep" />
                  <span className="text-xs font-medium">Cargando tus compras…</span>
                </div>
              ) : ownedItems.length === 0 ? (
                <div className="p-5 rounded-2xl bg-white/75 border border-cozy-line text-center flex flex-col items-center gap-3 shadow-xs">
                  <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-cozy-ink">Aún no tienes artículos comprados</p>
                    <p className="text-xs text-cozy-muted mt-1">
                      Visita la Tienda de Reliquias para desbloquear sombreros, visores, alas, conjuntos y compañeros únicos.
                    </p>
                  </div>
                  {onOpenShop && (
                    <button
                      type="button"
                      onClick={onOpenShop}
                      className="px-4 py-2 rounded-xl cozy-btn-primary text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      Ir a la Tienda
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* Category filter pills */}
                  {ownedCategoriesPresent.length > 1 && (
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setShopFilterCat('all')}
                        className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border cursor-pointer transition-colors ${
                          shopFilterCat === 'all'
                            ? 'bg-cozy-ink text-white border-cozy-ink'
                            : 'bg-white/75 hover:bg-white border-cozy-line text-cozy-ink'
                        }`}
                      >
                        Todo ({ownedItems.length})
                      </button>
                      {ownedCategoriesPresent.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setShopFilterCat(cat)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold border cursor-pointer transition-colors ${
                            shopFilterCat === cat
                              ? 'bg-cozy-ink text-white border-cozy-ink'
                              : 'bg-white/75 hover:bg-white border-cozy-line text-cozy-ink'
                          }`}
                        >
                          {shopCategoryIcon(cat)}
                          <span>{SHOP_CATEGORY_LABELS[cat]}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {filteredOwnedItems.map((item) => (
                      <OwnedShopCard
                        key={item.id}
                        item={item}
                        equipped={isShopItemEquipped(item)}
                        busy={busyEquipId === item.id}
                        appearance={appearance}
                        onEquip={handleEquipShopItem}
                        onUnequip={handleUnequipShopItem}
                      />
                    ))}
                  </div>

                  {onOpenShop && (
                    <button
                      type="button"
                      onClick={onOpenShop}
                      className="mt-1 w-full py-2.5 rounded-xl bg-white/75 hover:bg-white border border-cozy-line text-xs font-bold text-cozy-accent-deep flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      Conseguir más objetos en la Tienda
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-2 p-3 border-t border-cozy-line/80 bg-white/55 pb-safe">
          <button
            type="button"
            onClick={undo}
            disabled={!history.length}
            title={UI.undo}
            aria-label={UI.undo}
            className="p-2.5 rounded-xl bg-white/80 hover:bg-white border border-cozy-line text-cozy-ink disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed shadow-xs"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={requestReset}
            title="Restablecer personaje original"
            aria-label="Restablecer"
            className="p-2.5 rounded-xl bg-white/80 hover:bg-white border border-cozy-line text-cozy-ink cursor-pointer shadow-xs"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-3.5 py-2.5 rounded-xl bg-white/80 hover:bg-white border border-cozy-line text-cozy-ink text-xs font-bold cursor-pointer shadow-xs"
            >
              {UI.cancel}
            </button>
          )}
          <button
            type="button"
            onClick={finish}
            disabled={!nameValid}
            className="flex-1 py-2.5 px-4 rounded-xl cozy-btn-primary text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-45 active:scale-95"
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
