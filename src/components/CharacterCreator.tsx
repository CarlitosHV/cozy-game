import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  Backpack,
  Bug,
  Check,
  Cloud,
  Dices,
  Footprints,
  Glasses,
  HardHat,
  Layers,
  Loader2,
  Mars,
  Palette,
  RefreshCw,
  RotateCcw,
  Scissors,
  Shirt,
  ShoppingBag,
  Sparkles,
  Star,
  Undo2,
  UserRound,
  Venus,
  Wand2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { CharacterPreviewFocus } from '../game/GameEngine';
import { UI } from '../ui/labels';
import {
  BODY_TYPES,
  BodyType,
  CharacterAppearance,
  CompanionStyle,
  defaultAppearanceFor,
  generateRandomName,
  normalizeHexColor,
} from '../game/character';
import { COMPANION_POWERS } from '../game/companionPowers';
import { subscribeDailyMissions } from '../game/dailyMissions';
import { getPatternSwatchUrl } from '../game/patterns';
import {
  apiClient,
  normalizeShopTier,
  SHOP_TIER_META,
  ShopCategory,
  ShopItem,
  ShopTier,
  User,
} from '../services/apiClient';
import {
  REMOVABLE_COSMETIC_CATEGORIES,
  SHOP_CATEGORY_LABELS,
  WardrobeItem,
  applyShopItemToAppearance,
  applyWardrobeBaseItem,
  clearCategoryFromAppearance,
  fetchOwnedShopItems,
  getBaseCosmeticItems,
  getUnlockedProgressionItems,
} from '../game/shopCosmetics';
import { ConfirmDialog, ConfirmRequest } from './ConfirmDialog';
import { FieldError } from './FieldHints';
import {
  CHARACTER_NAME_MAX,
  isCharacterNameValid,
  sanitizeCharacterNameInput,
} from '../ui/validation';
import { characterNameHint } from '../ui/errors';
import { isTypingTarget } from '../ui/shortcuts';
import { friendlyError } from '../utils/locale';

type SourceFilter = 'all' | 'shop' | 'base';

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

const CATEGORY_FOCUS: Record<ShopCategory, CharacterPreviewFocus> = {
  skin: 'head',
  hair: 'head',
  glasses: 'head',
  hat: 'head',
  outfit: 'torso',
  pattern: 'torso',
  backpack: 'torso',
  accessory: 'torso',
  shoes: 'feet',
  aura: 'full',
  companion: 'companion',
};

const TIER_TEXT_STYLE: Record<ShopTier, { label: string; lineColor: string; textClass: string }> = {
  common: {
    label: SHOP_TIER_META.common.label,
    lineColor: SHOP_TIER_META.common.color,
    textClass: 'text-slate-600',
  },
  epic: {
    label: SHOP_TIER_META.epic.label,
    lineColor: SHOP_TIER_META.epic.color,
    textClass: 'text-purple-700',
  },
  golden: {
    label: SHOP_TIER_META.golden.label,
    lineColor: SHOP_TIER_META.golden.color,
    textClass: 'text-amber-700',
  },
  mythic: {
    label: SHOP_TIER_META.mythic.label,
    lineColor: SHOP_TIER_META.mythic.color,
    textClass: 'text-rose-700',
  },
};

const CATEGORY_ORDER: ShopCategory[] = [
  'hat',
  'outfit',
  'pattern',
  'hair',
  'skin',
  'glasses',
  'accessory',
  'backpack',
  'shoes',
  'aura',
  'companion',
];

function shopCategoryIcon(cat: ShopCategory) {
  switch (cat) {
    case 'skin':
      return <Palette className="w-3.5 h-3.5 shrink-0" />;
    case 'hat':
      return <HardHat className="w-3.5 h-3.5 shrink-0" />;
    case 'outfit':
      return <Shirt className="w-3.5 h-3.5 shrink-0" />;
    case 'pattern':
      return <Layers className="w-3.5 h-3.5 shrink-0" />;
    case 'glasses':
      return <Glasses className="w-3.5 h-3.5 shrink-0" />;
    case 'backpack':
      return <Backpack className="w-3.5 h-3.5 shrink-0" />;
    case 'hair':
      return <Scissors className="w-3.5 h-3.5 shrink-0" />;
    case 'accessory':
      return <Award className="w-3.5 h-3.5 shrink-0" />;
    case 'shoes':
      return <Footprints className="w-3.5 h-3.5 shrink-0" />;
    case 'aura':
      return <Wand2 className="w-3.5 h-3.5 shrink-0" />;
    case 'companion':
      return <Sparkles className="w-3.5 h-3.5 shrink-0" />;
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

function isClearingStub(item: ShopItem): boolean {
  const idLower = item.id.toLowerCase();
  if (idLower.endsWith('_none') || idLower === 'none') return true;
  const p = item.appearancePatch || {};
  if (item.category === 'hat' && typeof p.hat === 'string' && ['none', 'ninguno'].includes(p.hat.toLowerCase())) {
    return true;
  }
  if (item.category === 'glasses' && typeof p.glasses === 'string' && ['none', 'ninguno'].includes(p.glasses.toLowerCase())) {
    return true;
  }
  if (item.category === 'backpack' && (p.backpack === false || (typeof p.backpack === 'string' && ['none', 'ninguno', 'false'].includes(p.backpack.toLowerCase())))) {
    return true;
  }
  return false;
}

// ---------- Wardrobe Object Card ----------

const WardrobeObjectCard: React.FC<{
  item: WardrobeItem;
  equipped: boolean;
  busy: boolean;
  appearance: CharacterAppearance;
  onEquip: (item: WardrobeItem) => void;
  onUnequip: (item: WardrobeItem) => void;
}> = ({ item, equipped, busy, appearance, onEquip, onUnequip }) => {
  const tier = normalizeShopTier(item.tier ?? item.rarity);
  const tierInfo = TIER_TEXT_STYLE[tier] ?? TIER_TEXT_STYLE.common;
  const lineColor = item.source === 'base' ? '#94a3b8' : item.source === 'mission' ? '#588157' : item.source === 'level' ? '#3d5a80' : tierInfo.lineColor;

  const patchPattern =
    item.category === 'pattern' &&
    typeof (item.appearancePatch?.pattern ?? item.appearancePatch?.shirtPattern) === 'string'
      ? ((item.appearancePatch?.pattern ?? item.appearancePatch?.shirtPattern) as CharacterAppearance['shirtPattern'])
      : undefined;
  const patternUrl = patchPattern
    ? getPatternSwatchUrl(patchPattern, appearance.sweaterColor, appearance.detailColor)
    : undefined;

  const patchCompanion =
    item.category === 'companion' && typeof item.appearancePatch?.companion === 'string'
      ? (item.appearancePatch.companion as CompanionStyle)
      : undefined;
  const companionPower = patchCompanion ? COMPANION_POWERS[patchCompanion] : undefined;

  const sourceLabel =
    item.source === 'base'
      ? 'Base'
      : item.source === 'mission'
        ? item.unlockHint || 'Misión'
        : item.source === 'level'
          ? item.unlockHint || 'Nivel'
          : tierInfo.label;

  const removable = equipped && REMOVABLE_COSMETIC_CATEGORIES.has(item.category);

  return (
    <div
      className={`relative flex flex-col justify-between rounded-2xl border overflow-hidden transition-all shadow-xs ${
        equipped
          ? 'bg-white/95 border-amber-400/90 ring-1 ring-amber-400/50'
          : 'bg-white/78 hover:bg-white/95 border-cozy-line'
      }`}
    >
      <div className="h-1 w-full" style={{ backgroundColor: lineColor }} />
      <div className="p-3 flex flex-col gap-2 flex-1 justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-2.5">
            <div className="w-10 h-10 rounded-xl border border-black/10 shrink-0 overflow-hidden flex items-center justify-center bg-white/90 shadow-inner">
              {patternUrl ? (
                <img src={patternUrl} alt={item.name} className="w-full h-full object-cover" />
              ) : patchCompanion && COMPANION_ICONS[patchCompanion] ? (
                <span className="text-cozy-accent-deep">{COMPANION_ICONS[patchCompanion]}</span>
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-white/95"
                  style={{
                    background: `linear-gradient(135deg, ${item.previewColor || '#f59e0b'}, ${item.previewColor || '#f59e0b'}cc)`,
                  }}
                >
                  {shopCategoryIcon(item.category)}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-wide truncate">
                <span className={item.source === 'shop' ? tierInfo.textClass : 'text-cozy-accent-deep'}>
                  {sourceLabel}
                </span>
                <span aria-hidden="true" className="text-cozy-soft">
                  ·
                </span>
                <span className="text-cozy-muted truncate">
                  {SHOP_CATEGORY_LABELS[item.category]}
                </span>
              </div>
              <h3 className="text-xs font-bold text-cozy-ink leading-snug mt-0.5 line-clamp-1">
                {item.name}
              </h3>
            </div>
          </div>

          {item.description && (
            <p className="text-[11px] text-cozy-muted leading-snug line-clamp-2">
              {item.description}
            </p>
          )}

          {companionPower && (
            <p className="text-[10px] leading-snug text-cozy-moss font-medium line-clamp-2">
              <strong>Poder: {companionPower.powerName}.</strong> {companionPower.desc}
            </p>
          )}
        </div>

        <div className="pt-1 flex items-center gap-1.5">
          {equipped ? (
            <>
              <div className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-extrabold">
                <Check className="w-3.5 h-3.5" />
                <span>Equipado</span>
              </div>
              {removable && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onUnequip(item)}
                  title="Quitar objeto"
                  className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-rose-50 border border-cozy-line hover:border-rose-200 text-cozy-muted hover:text-rose-600 text-[11px] font-bold cursor-pointer transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Quitar'}
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => onEquip(item)}
              className="w-full py-1.5 px-3 rounded-xl cozy-btn-primary text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95 whitespace-nowrap"
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
  const [history, setHistory] = useState<CharacterAppearance[]>([]);
  const [nameTouched, setNameTouched] = useState(false);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [, setMissionTick] = useState(0);
  const [previewFocus, setPreviewFocus] = useState<CharacterPreviewFocus>('full');

  // Wardrobe & Shop State
  const [ownedShopItems, setOwnedShopItems] = useState<ShopItem[]>([]);
  const [loadingOwned, setLoadingOwned] = useState(false);
  const [busyEquipId, setBusyEquipId] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [filterCat, setFilterCat] = useState<'all' | ShopCategory>('all');

  const isAuth = apiClient.isAuthenticated();

  const loadOwned = useCallback(async () => {
    if (!apiClient.isAuthenticated()) {
      setOwnedShopItems([]);
      return;
    }
    setLoadingOwned(true);
    try {
      const { ownedItems: items } = await fetchOwnedShopItems(appearance);
      setOwnedShopItems(items.filter((it) => !isClearingStub(it)));
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

  const body = appearance.bodyType;
  const nameValid = isCharacterNameValid(appearance.name);
  const nameError = nameTouched ? characterNameHint(appearance.name) : null;

  // Merge Base starter objects + Mission/Level unlocked objects + Owned Shop objects cleanly
  const { wardrobeItems, shopItemIds } = useMemo(() => {
    const idSet = new Set<string>();
    const list: WardrobeItem[] = [];
    const seenIds = new Set<string>();
    const backendFreeCategories = new Set<ShopCategory>();

    for (const item of ownedShopItems) {
      idSet.add(item.id);
      const isFreeStarter = item.priceWalnut === 0 && item.priceCrystal === 0;
      if (isFreeStarter) backendFreeCategories.add(item.category);
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        list.push({
          ...item,
          source: isFreeStarter ? 'base' : 'shop',
        });
      }
    }

    // Add starter base objects for every starter slot not already populated by a free backend item
    for (const baseItem of getBaseCosmeticItems(body)) {
      if (backendFreeCategories.has(baseItem.category)) continue;
      if (!seenIds.has(baseItem.id)) {
        seenIds.add(baseItem.id);
        list.push(baseItem);
      }
    }

    // Add unlocked daily-mission patterns and unlocked level companions as objects
    for (const progItem of getUnlockedProgressionItems(ownedShopItems)) {
      if (!seenIds.has(progItem.id)) {
        seenIds.add(progItem.id);
        list.push(progItem);
      }
    }

    // Sort: purchased shop items first, then mission/level, then base; ordered by category
    const sourceRank: Record<WardrobeItem['source'], number> = {
      shop: 0,
      mission: 1,
      level: 2,
      base: 3,
    };
    list.sort((a, b) => {
      const catDiff = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
      if (catDiff !== 0) return catDiff;
      return sourceRank[a.source] - sourceRank[b.source];
    });

    return { wardrobeItems: list, shopItemIds: idSet };
  }, [ownedShopItems, body]);

  // Helper: is any shop catalog item currently equipped in a given category?
  const shopEquippedInCategory = useCallback(
    (category: ShopCategory): boolean => {
      const eqIds = Array.isArray(appearance.equippedShopIds) ? appearance.equippedShopIds : null;
      for (const s of ownedShopItems) {
        if (s.category !== category) continue;
        if (eqIds ? eqIds.includes(s.id) : s.equipped) {
          return true;
        }
      }
      return false;
    },
    [appearance.equippedShopIds, ownedShopItems]
  );

  const isWardrobeItemEquipped = useCallback(
    (item: WardrobeItem): boolean => {
      if (shopItemIds.has(item.id)) {
        if (Array.isArray(appearance.equippedShopIds)) {
          return appearance.equippedShopIds.includes(item.id);
        }
        return Boolean(item.equipped);
      }

      if (shopEquippedInCategory(item.category)) {
        return false;
      }

      const def = defaultAppearanceFor(body);
      const patch = item.appearancePatch || {};
      switch (item.category) {
        case 'skin':
          return (
            !appearance.skinVariant &&
            normalizeHexColor(appearance.skinColor) === normalizeHexColor(patch.skinColor ?? def.skinColor)
          );
        case 'hair':
          return (
            !appearance.hairVariant &&
            appearance.hairStyle === (patch.hairStyle ?? def.hairStyle) &&
            normalizeHexColor(appearance.hairColor) === normalizeHexColor(patch.hairColor ?? def.hairColor)
          );
        case 'outfit':
          return (
            !appearance.outfitVariant &&
            appearance.outfitStyle === (patch.outfitStyle ?? def.outfitStyle) &&
            normalizeHexColor(appearance.sweaterColor) === normalizeHexColor(patch.sweaterColor ?? def.sweaterColor)
          );
        case 'pattern': {
          const targetPat = String(patch.shirtPattern ?? patch.pattern ?? 'liso');
          return (appearance.shirtPattern ?? 'liso') === targetPat;
        }
        case 'hat':
          return !appearance.hatVariant && appearance.hatStyle === (patch.hatStyle ?? def.hatStyle);
        case 'backpack':
          return Boolean(appearance.backpack) && !appearance.backpackVariant;
        case 'shoes':
          return (
            !appearance.shoesVariant &&
            normalizeHexColor(appearance.bootColor) === normalizeHexColor(patch.bootColor ?? def.bootColor)
          );
        case 'companion':
          return appearance.companion === patch.companion;
        default:
          return false;
      }
    },
    [appearance, body, shopEquippedInCategory, shopItemIds]
  );

  const handleEquipItem = async (item: WardrobeItem) => {
    if (busyEquipId) return;
    setBusyEquipId(item.id);
    focus(CATEGORY_FOCUS[item.category] ?? 'full');

    const isShopItem = shopItemIds.has(item.id);

    try {
      if (isShopItem) {
        const prevIds = Array.isArray(appearance.equippedShopIds)
          ? appearance.equippedShopIds
          : ownedShopItems.filter((i) => i.equipped).map((i) => i.id);
        const sameCatIds = new Set(
          ownedShopItems.filter((i) => i.category === item.category).map((i) => i.id)
        );
        const optimisticIds = [...prevIds.filter((id) => !sameCatIds.has(id)), item.id];

        if (apiClient.isAuthenticated()) {
          const res = await apiClient.updatePlayerCharacter({
            appearance,
            equipItemIds: [item.id],
            omitCategories: [item.category],
          });
          const eqSet = new Set<string>(
            Array.isArray(res?.equippedItems)
              ? res.equippedItems
              : res?.equippedByCategory
                ? Object.values(res.equippedByCategory).filter(Boolean)
                : optimisticIds
          );
          if (res?.equippedByCategory) {
            for (const id of Object.values(res.equippedByCategory)) {
              if (id) eqSet.add(id);
            }
          }
          eqSet.add(item.id);
          const serverEq = Array.from(eqSet);
          const next = applyShopItemToAppearance(
            appearance,
            item,
            res?.appearance,
            serverEq,
            (res as { appliedPatch?: Record<string, unknown> })?.appliedPatch
          );
          setHistory((h) => [...h.slice(-29), appearance]);
          onChange(next);
          setOwnedShopItems((cur) =>
            cur.map((entry) =>
              entry.category === item.category
                ? { ...entry, equipped: entry.id === item.id }
                : { ...entry, equipped: serverEq.includes(entry.id) }
            )
          );
        } else {
          const next = applyShopItemToAppearance(appearance, item, undefined, optimisticIds);
          setHistory((h) => [...h.slice(-29), appearance]);
          onChange(next);
        }
        onToast?.(`¡${item.name} equipado!`, 2000, 'success');
      } else {
        // Equip Base / Mission / Level object cleanly, clearing any shop override in that category
        const hadShopEquipped = shopEquippedInCategory(item.category);
        const next = applyWardrobeBaseItem(appearance, item, ownedShopItems);

        if (apiClient.isAuthenticated()) {
          if (hadShopEquipped) {
            await apiClient.unequipShopItems({
              category: item.category,
              currentAppearance: next,
            });
          }
          await apiClient.updatePlayerCharacter({ appearance: next }).catch(() => {});
        }

        setHistory((h) => [...h.slice(-29), appearance]);
        onChange(next);
        setOwnedShopItems((cur) =>
          cur.map((entry) =>
            entry.category === item.category ? { ...entry, equipped: false } : entry
          )
        );
        onToast?.(`¡${item.name} equipado!`, 1800, 'success');
      }
    } catch (err) {
      onToast?.(friendlyError(err, 'No se pudo equipar el objeto.'), 2600, 'error');
    } finally {
      setBusyEquipId(null);
    }
  };

  const handleUnequipItem = async (item: WardrobeItem) => {
    if (busyEquipId) return;
    setBusyEquipId(item.id);
    focus(CATEGORY_FOCUS[item.category] ?? 'full');

    const isShopItem = shopItemIds.has(item.id);
    const sameCatShopIds = ownedShopItems
      .filter((s) => s.category === item.category)
      .map((s) => s.id);

    try {
      let next = clearCategoryFromAppearance(
        appearance,
        item.category,
        undefined,
        item.id,
        sameCatShopIds
      );

      if (apiClient.isAuthenticated()) {
        if (isShopItem) {
          const res = await apiClient.unequipShopItems({
            category: item.category,
            itemId: item.id,
            currentAppearance: appearance,
          });
          const serverEq = Array.isArray(res?.equippedItems)
            ? res.equippedItems
            : Array.isArray(res?.equipped)
              ? res.equipped
              : undefined;
          next = clearCategoryFromAppearance(
            appearance,
            item.category,
            res?.appearance,
            item.id,
            sameCatShopIds
          );
          if (serverEq) next.equippedShopIds = serverEq;
        } else {
          await apiClient.updatePlayerCharacter({ appearance: next }).catch(() => {});
        }
      }

      setHistory((h) => [...h.slice(-29), appearance]);
      onChange(next);
      setOwnedShopItems((cur) =>
        cur.map((entry) =>
          entry.id === item.id || entry.category === item.category
            ? { ...entry, equipped: false }
            : entry
        )
      );
      onToast?.(`${item.name} quitado`, 1600, 'neutral');
    } catch (err) {
      onToast?.(friendlyError(err, 'No se pudo quitar el objeto.'), 2400, 'error');
    } finally {
      setBusyEquipId(null);
    }
  };

  const undo = () => {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setHistory(history.slice(0, -1));
    onChange(prev);
  };

  const reset = () => {
    focus('full');
    const def = defaultAppearanceFor(body);
    if (apiClient.isAuthenticated()) {
      apiClient.updatePlayerCharacter({ resetToDefault: true }).catch(() => {});
    }
    setHistory((h) => [...h.slice(-29), appearance]);
    onChange(def);
    setOwnedShopItems((cur) => cur.map((it) => ({ ...it, equipped: false })));
  };

  const requestReset = () => {
    setConfirmRequest({
      title: '¿Volver al personaje inicial?',
      message: 'Se restaura el atuendo base y se quitan los objetos equipados.',
      confirmLabel: 'Restablecer',
      cancelLabel: UI.cancel,
      tone: 'danger',
      onConfirm: reset,
    });
  };

  const switchBody = (next: BodyType) => {
    if (next === body) return;
    setHistory((h) => [...h.slice(-29), appearance]);
    focus('full');
    onSwitchBody(next);
  };

  const requestSwitchBody = (next: BodyType) => {
    if (next === body) return;
    setConfirmRequest({
      title: '¿Cambiar de personaje?',
      message: 'Pasarás a otra silueta y conservarás sus objetos guardados.',
      confirmLabel: 'Cambiar',
      cancelLabel: UI.cancel,
      onConfirm: () => switchBody(next),
    });
  };

  const updateName = (rawName: string) => {
    setHistory((h) => [...h.slice(-29), appearance]);
    onChange({ ...appearance, name: rawName });
  };

  const finish = () => {
    setNameTouched(true);
    if (!nameValid) return;
    const trimmed = appearance.name.trim();
    if (trimmed !== appearance.name) {
      onChange({ ...appearance, name: trimmed });
    }
    onClose();
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
      if (e.code === 'Enter') {
        e.preventDefault();
        finish();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmRequest, history, appearance.name, nameValid, onCancel]);

  const shopOnlyCount = useMemo(
    () => wardrobeItems.filter((i) => i.source === 'shop').length,
    [wardrobeItems]
  );
  const baseAndUnlockCount = useMemo(
    () => wardrobeItems.filter((i) => i.source !== 'shop').length,
    [wardrobeItems]
  );

  const itemsBySource = useMemo(() => {
    if (sourceFilter === 'shop') return wardrobeItems.filter((i) => i.source === 'shop');
    if (sourceFilter === 'base') return wardrobeItems.filter((i) => i.source !== 'shop');
    return wardrobeItems;
  }, [wardrobeItems, sourceFilter]);

  const categoriesAvailable = useMemo(() => {
    const present = new Set<ShopCategory>();
    for (const item of itemsBySource) present.add(item.category);
    return CATEGORY_ORDER.filter((c) => present.has(c));
  }, [itemsBySource]);

  const displayedItems = useMemo(() => {
    if (filterCat === 'all') return itemsBySource;
    return itemsBySource.filter((i) => i.category === filterCat);
  }, [itemsBySource, filterCat]);

  const panelPosition = portrait
    ? 'inset-x-0 bottom-0 max-h-[60%] rounded-t-3xl border-t'
    : embeddedInLobby
      ? 'right-0 top-14 bottom-0 w-[min(480px,50vw)] border-l'
      : 'right-0 top-0 bottom-0 w-[min(480px,50vw)] border-l';

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
              Armario de objetos
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
                className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-all cursor-pointer backdrop-blur-md shadow-xs whitespace-nowrap ${
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

      {/* Right Frosted Wardrobe Panel */}
      <div
        className={`absolute ${panelPosition} pointer-events-auto flex flex-col bg-white/84 backdrop-blur-xl border-white/75 shadow-2xl`}
      >
        {/* Compact Character Header: Chico/Chica + Nombre */}
        <div className="flex flex-col gap-2.5 p-4 pb-3 border-b border-cozy-line/80 bg-white/45">
          <div
            className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-white/70 border border-cozy-line"
            role="radiogroup"
            aria-label="Silueta del personaje"
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
                  className={`flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
                onChange={(e) => updateName(sanitizeCharacterNameInput(e.target.value))}
                onBlur={() => setNameTouched(true)}
                className="flex-1 min-w-0 px-3 py-1.5 rounded-xl bg-white/85 border border-cozy-line text-sm font-semibold text-cozy-ink placeholder:text-cozy-soft focus:outline-none focus:border-cozy-sky select-text"
                aria-label="Nombre del personaje"
                aria-invalid={Boolean(nameError)}
              />
              <button
                type="button"
                onClick={() => {
                  updateName(generateRandomName(body));
                  setNameTouched(true);
                }}
                title="Nombre aleatorio"
                aria-label="Nombre aleatorio"
                className="p-2 rounded-xl bg-white/80 hover:bg-white border border-cozy-line text-cozy-accent-deep cursor-pointer active:scale-95 shadow-xs"
              >
                <Dices className="w-4 h-4" />
              </button>
            </div>
            <FieldError message={nameError} />
          </div>
        </div>

        {/* Wardrobe Toolbar: Source Segmented Control & Category Strip */}
        <div className="px-4 py-2.5 border-b border-cozy-line/70 bg-white/35 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-cozy-accent-deep truncate">
                Tus objetos
              </h2>
              <span className="text-[11px] text-cozy-muted tabular-nums whitespace-nowrap">
                · {wardrobeItems.length} disponibles
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {onOpenShop && (
                <button
                  type="button"
                  onClick={onOpenShop}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/85 hover:bg-white border border-cozy-line text-[11px] font-bold text-cozy-accent-deep cursor-pointer shadow-xs whitespace-nowrap"
                >
                  <ShoppingBag className="w-3 h-3" />
                  <span>Tienda</span>
                </button>
              )}
              {isAuth && (
                <button
                  type="button"
                  onClick={() => void loadOwned()}
                  disabled={loadingOwned}
                  title="Actualizar objetos"
                  aria-label="Actualizar objetos"
                  className="p-1.5 rounded-xl bg-white/80 hover:bg-white border border-cozy-line text-cozy-ink cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingOwned ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>
          </div>

          {/* Source Segmented Filter */}
          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-white/70 border border-cozy-line">
            {(
              [
                { id: 'all', label: `Todos (${wardrobeItems.length})` },
                { id: 'shop', label: `Comprados (${shopOnlyCount})` },
                { id: 'base', label: `Base (${baseAndUnlockCount})` },
              ] as const
            ).map((src) => {
              const active = sourceFilter === src.id;
              return (
                <button
                  key={src.id}
                  type="button"
                  onClick={() => {
                    setSourceFilter(src.id);
                    setFilterCat('all');
                  }}
                  className={`py-1 px-2 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap truncate tabular-nums ${
                    active
                      ? 'bg-cozy-ink text-white shadow-xs'
                      : 'text-cozy-muted hover:text-cozy-ink hover:bg-white/70'
                  }`}
                >
                  {src.label}
                </button>
              );
            })}
          </div>

          {/* Category Strip */}
          {categoriesAvailable.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
              <button
                type="button"
                onClick={() => {
                  setFilterCat('all');
                  focus('full');
                }}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                  filterCat === 'all'
                    ? 'cozy-tab-active'
                    : 'bg-white/75 hover:bg-white border-cozy-line text-cozy-ink'
                }`}
              >
                Todo
              </button>
              {categoriesAvailable.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setFilterCat(cat);
                    focus(CATEGORY_FOCUS[cat] ?? 'full');
                  }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold border cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                    filterCat === cat
                      ? 'cozy-tab-active'
                      : 'bg-white/75 hover:bg-white border-cozy-line text-cozy-ink'
                  }`}
                >
                  {shopCategoryIcon(cat)}
                  <span>{SHOP_CATEGORY_LABELS[cat]}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Object Grid */}
        <div className="flex-1 overflow-y-auto px-4 py-3.5 flex flex-col gap-3 overscroll-contain touch-pan-y">
          {sourceFilter === 'shop' && !isAuth ? (
            <div className="p-5 rounded-2xl bg-white/80 border border-cozy-line text-center flex flex-col items-center gap-3 shadow-xs">
              <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                <UserRound className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-cozy-ink">Inicia sesión para ver tus compras</p>
                <p className="text-xs text-cozy-muted mt-1">
                  Los objetos comprados en la Tienda de Reliquias aparecen aquí para equiparlos cuando quieras.
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
          ) : loadingOwned && shopOnlyCount === 0 && sourceFilter === 'shop' ? (
            <div className="py-10 flex flex-col items-center justify-center gap-2 text-cozy-muted">
              <Loader2 className="w-6 h-6 animate-spin text-cozy-accent-deep" />
              <span className="text-xs font-medium">Cargando tus objetos comprados…</span>
            </div>
          ) : displayedItems.length === 0 ? (
            <div className="p-5 rounded-2xl bg-white/80 border border-cozy-line text-center flex flex-col items-center gap-3 shadow-xs">
              <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-cozy-ink">
                  {sourceFilter === 'shop'
                    ? 'Aún no tienes objetos comprados'
                    : 'No hay objetos en esta categoría'}
                </p>
                <p className="text-xs text-cozy-muted mt-1">
                  {sourceFilter === 'shop'
                    ? 'Compra gorros, atuendos, alas, calzado o compañeros con tus reliquias.'
                    : 'Prueba otra categoría o visita la Tienda de Reliquias.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {sourceFilter === 'shop' ? (
                  <button
                    type="button"
                    onClick={() => setSourceFilter('all')}
                    className="px-3.5 py-2 rounded-xl bg-white hover:bg-white/95 border border-cozy-line text-xs font-bold text-cozy-ink cursor-pointer"
                  >
                    Ver objetos base
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setFilterCat('all')}
                    className="px-3.5 py-2 rounded-xl bg-white hover:bg-white/95 border border-cozy-line text-xs font-bold text-cozy-ink cursor-pointer"
                  >
                    Ver todas las categorías
                  </button>
                )}
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
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {displayedItems.map((item) => (
                  <WardrobeObjectCard
                    key={item.id}
                    item={item}
                    equipped={isWardrobeItemEquipped(item)}
                    busy={busyEquipId === item.id}
                    appearance={appearance}
                    onEquip={(it) => void handleEquipItem(it)}
                    onUnequip={(it) => void handleUnequipItem(it)}
                  />
                ))}
              </div>

              {onOpenShop && (
                <button
                  type="button"
                  onClick={onOpenShop}
                  className="mt-1 w-full py-2.5 rounded-xl bg-white/80 hover:bg-white border border-cozy-line text-xs font-bold text-cozy-accent-deep flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  Conseguir más objetos en la Tienda de Reliquias
                </button>
              )}
            </>
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
