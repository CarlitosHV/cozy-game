/**
 * Shared helpers for syncing backend Shop items (owned & equipped)
 * and Starter Base / Mission / Level objects with CharacterAppearance state.
 */
import {
  apiClient,
  CurrenciesBalance,
  ShopCategory,
  ShopItem,
} from '../services/apiClient';
import {
  applyBackendAppearancePatch,
  BodyType,
  CharacterAppearance,
  COMPANIONS,
  CompanionStyle,
  defaultAppearanceFor,
} from './character';
import { isPatternUnlocked, unlockCosmeticPattern } from './dailyMissions';
import { SHIRT_PATTERNS, ShirtPatternId } from './patterns';
import { isCompanionUnlocked, unlockLevelFor, unlockShopCompanion } from './progress';

export const SHOP_CATEGORY_LABELS: Record<ShopCategory, string> = {
  skin: 'Pieles',
  hat: 'Gorros y sombreros',
  outfit: 'Conjuntos',
  pattern: 'Patrones',
  glasses: 'Lentes y visores',
  backpack: 'Mochilas y alas',
  hair: 'Peinados',
  accessory: 'Accesorios',
  shoes: 'Calzado',
  aura: 'Auras y estelas',
  companion: 'Compañeros',
};

export const REMOVABLE_COSMETIC_CATEGORIES = new Set<ShopCategory>([
  'hat',
  'glasses',
  'backpack',
  'accessory',
  'shoes',
  'aura',
  'companion',
]);

export type WardrobeSource = 'shop' | 'base' | 'mission' | 'level';

export interface WardrobeItem extends ShopItem {
  source: WardrobeSource;
  unlockHint?: string;
}

/** Registers any pattern/companion unlocks implied by an appearance patch or ShopItem locally. */
export function syncLocalUnlockFromPatch(
  patch: Record<string, unknown> | undefined,
  nextLook: CharacterAppearance
): void {
  if (nextLook.shirtPattern && nextLook.shirtPattern !== 'liso') {
    unlockCosmeticPattern(nextLook.shirtPattern as ShirtPatternId);
  }
  if (nextLook.companion && nextLook.companion !== 'ninguno') {
    unlockShopCompanion(nextLook.companion as CompanionStyle);
  }
  if (patch && typeof patch.pattern === 'string') {
    unlockCosmeticPattern(nextLook.shirtPattern ?? 'liso');
  }
}

/** Syncs all owned shop items' pattern/companion unlocks into local registries. */
export function syncOwnedShopUnlocks(
  ownedItems: ShopItem[],
  baseAppearance: CharacterAppearance
): void {
  for (const item of ownedItems) {
    if (!item.owned) continue;
    if (item.category === 'pattern' || item.category === 'companion') {
      const patched = applyBackendAppearancePatch(
        baseAppearance,
        item.appearancePatch,
        true,
        { id: item.id, category: item.category, previewColor: item.previewColor }
      );
      syncLocalUnlockFromPatch(item.appearancePatch, patched);
    }
  }
}

function isClearingShopItem(item: ShopItem): boolean {
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

/**
 * Applies a ShopItem onto a CharacterAppearance while preserving unrelated saved fields
 * and preventing stale `'none'` values in `extraPatch` (e.g. `res.appearance`) from wiping the equipped item.
 */
export function applyShopItemToAppearance(
  base: CharacterAppearance,
  item: ShopItem,
  extraPatch?: Record<string, unknown>,
  equippedList?: string[],
  appliedPatch?: Record<string, unknown>
): CharacterAppearance {
  const cleanExtra: Record<string, unknown> = extraPatch ? { ...extraPatch } : {};
  const clearingItem = isClearingShopItem(item);

  if (!clearingItem) {
    if (item.category === 'hat') {
      if (typeof cleanExtra.hat === 'string' && ['none', 'ninguno'].includes(cleanExtra.hat.toLowerCase())) {
        delete cleanExtra.hat;
      }
      if (cleanExtra.hatStyle === 'ninguno') {
        delete cleanExtra.hatStyle;
      }
    } else if (item.category === 'glasses') {
      if (typeof cleanExtra.glasses === 'string' && ['none', 'ninguno'].includes(cleanExtra.glasses.toLowerCase())) {
        delete cleanExtra.glasses;
      }
    } else if (item.category === 'backpack') {
      if (
        cleanExtra.backpack === false ||
        (typeof cleanExtra.backpack === 'string' && ['none', 'ninguno', 'false'].includes(cleanExtra.backpack.toLowerCase()))
      ) {
        delete cleanExtra.backpack;
      }
    }
  }

  // Extra (existing server appearance) goes first; the equipped item's patch and server's appliedPatch always win
  const mergedPatch: Record<string, unknown> = {
    ...cleanExtra,
    ...(item.appearancePatch || {}),
    ...(appliedPatch || {}),
  };

  if (
    !clearingItem &&
    item.category === 'hat' &&
    !('hat' in mergedPatch) &&
    !('hatStyle' in mergedPatch) &&
    !('hatVariant' in mergedPatch)
  ) {
    mergedPatch.hat = item.id;
  }

  const next = applyBackendAppearancePatch(base, mergedPatch, true, {
    id: item.id,
    category: item.category,
    previewColor: item.previewColor,
  });

  if (Array.isArray(equippedList) && equippedList.length > 0) {
    next.equippedShopIds = equippedList.slice(0, 32);
  }
  syncLocalUnlockFromPatch(mergedPatch, next);
  return next;
}

/** Clears a specific cosmetic shop category slot from CharacterAppearance without touching other parts. */
export function clearCategoryFromAppearance(
  base: CharacterAppearance,
  category: ShopCategory,
  serverAppearance?: Record<string, unknown>,
  itemId?: string,
  ownedCategoryItemIds?: string[]
): CharacterAppearance {
  let next: CharacterAppearance = serverAppearance
    ? applyBackendAppearancePatch(base, serverAppearance, true)
    : { ...base };
  if (Array.isArray(next.equippedShopIds)) {
    const blocked = new Set(ownedCategoryItemIds ?? (itemId ? [itemId] : []));
    next.equippedShopIds = next.equippedShopIds.filter((id) => !blocked.has(id));
  }
  switch (category) {
    case 'hat':
      next.hatStyle = 'ninguno';
      next.hatVariant = undefined;
      break;
    case 'glasses':
      next.accessory = 'ninguno';
      next.glassesVariant = undefined;
      next.glassesColor = undefined;
      break;
    case 'backpack':
      next.backpack = false;
      next.backpackVariant = undefined;
      next.backpackColor = undefined;
      break;
    case 'pattern':
      next.shirtPattern = 'liso';
      break;
    case 'accessory':
      next.accessoryVariant = undefined;
      next.accessoryColor = undefined;
      break;
    case 'aura':
      next.auraVariant = undefined;
      next.auraColor = undefined;
      break;
    case 'shoes':
      next.shoesVariant = undefined;
      break;
    case 'companion':
      next.companion = 'ninguno';
      break;
    case 'hair':
      next.hairVariant = undefined;
      break;
    case 'skin':
      next.skinVariant = undefined;
      break;
    case 'outfit':
      next.outfitVariant = undefined;
      next.accentGlowColor = undefined;
      break;
  }
  return next;
}

function makeBaseItem(
  id: string,
  category: ShopCategory,
  name: string,
  description: string,
  previewColor: string,
  appearancePatch: Record<string, unknown>
): WardrobeItem {
  return {
    id,
    category,
    name,
    description,
    tier: 'common',
    rarity: 'common',
    priceWalnut: 0,
    priceCrystal: 0,
    price: { walnut: 0, crystal: 0 },
    priceRelics: 0,
    previewColor,
    appearancePatch,
    owned: true,
    equipped: false,
    canAfford: true,
    missingCurrencies: { walnut: 0, crystal: 0 },
    source: 'base',
  };
}

/**
 * Starter wardrobe objects (one clean base object per starter slot, tailored to Chico / Chica).
 */
export function getBaseCosmeticItems(body: BodyType): WardrobeItem[] {
  const def = defaultAppearanceFor(body);
  const isChica = body === 'chica';
  return [
    makeBaseItem(
      `base_skin_${body}`,
      'skin',
      'Piel Melocotón',
      'Tono natural inicial de tu personaje.',
      def.skinColor,
      { skinColor: def.skinColor }
    ),
    makeBaseItem(
      `base_hair_${body}`,
      'hair',
      isChica ? 'Melena Clásica' : 'Flequillo Clásico',
      isChica ? 'Cabello largo suave inicial.' : 'Peinado acogedor con flequillo inicial.',
      def.hairColor,
      { hairStyle: def.hairStyle, hairColor: def.hairColor }
    ),
    makeBaseItem(
      `base_outfit_${body}`,
      'outfit',
      isChica ? 'Vestido Salvia' : 'Suéter Coral',
      isChica
        ? 'Vestido aventurero salvia con bufanda marfil.'
        : 'Suéter tejido coral con bufanda crema.',
      def.sweaterColor,
      {
        outfitStyle: def.outfitStyle,
        sweaterColor: def.sweaterColor,
        detailColor: def.detailColor,
        scarfColor: def.scarfColor,
      }
    ),
    makeBaseItem(
      `base_pattern_${body}`,
      'pattern',
      'Tejido Liso',
      'Acabado liso original sin estampado.',
      def.sweaterColor,
      { shirtPattern: 'liso' }
    ),
    makeBaseItem(
      `base_hat_${body}`,
      'hat',
      isChica ? 'Corona de Flores' : 'Gorro Acogedor',
      isChica
        ? 'Guirnalda floral inicial de pradera.'
        : 'Gorro tejido azul noche con pompón.',
      def.hatColor,
      { hatStyle: def.hatStyle, hatColor: def.hatColor }
    ),
    makeBaseItem(
      `base_backpack_${body}`,
      'backpack',
      'Mochila Exploradora',
      'Mochila clásica con petate, cantimplora y farolito.',
      '#8a6a4f',
      { backpack: true, backpackVariant: 'explorer_pack' }
    ),
    makeBaseItem(
      `base_shoes_${body}`,
      'shoes',
      isChica ? 'Botas Roble' : 'Botas Nogal',
      'Botas iniciales resistentes para escalar.',
      def.bootColor,
      { bootColor: def.bootColor }
    ),
  ];
}

/** Applies a non-shop (Base / Mission / Level) WardrobeItem cleanly and clears shop variants in its slot. */
export function applyWardrobeBaseItem(
  base: CharacterAppearance,
  item: WardrobeItem,
  ownedShopItems: ShopItem[]
): CharacterAppearance {
  const sameCatShopIds = ownedShopItems
    .filter((s) => s.category === item.category)
    .map((s) => s.id);
  const cleared = clearCategoryFromAppearance(
    base,
    item.category,
    undefined,
    undefined,
    sameCatShopIds
  );
  const patch = item.appearancePatch || {};
  const next: CharacterAppearance = { ...cleared };

  switch (item.category) {
    case 'skin':
      if (typeof patch.skinColor === 'string') next.skinColor = patch.skinColor;
      break;
    case 'hair':
      if (typeof patch.hairStyle === 'string') next.hairStyle = patch.hairStyle as CharacterAppearance['hairStyle'];
      if (typeof patch.hairColor === 'string') next.hairColor = patch.hairColor;
      break;
    case 'outfit':
      if (typeof patch.outfitStyle === 'string') next.outfitStyle = patch.outfitStyle as CharacterAppearance['outfitStyle'];
      if (typeof patch.sweaterColor === 'string') next.sweaterColor = patch.sweaterColor;
      if (typeof patch.detailColor === 'string') next.detailColor = patch.detailColor;
      if (typeof patch.scarfColor === 'string') next.scarfColor = patch.scarfColor;
      break;
    case 'pattern':
      if (typeof patch.shirtPattern === 'string') {
        next.shirtPattern = patch.shirtPattern as ShirtPatternId;
      }
      break;
    case 'hat':
      if (typeof patch.hatStyle === 'string') next.hatStyle = patch.hatStyle as CharacterAppearance['hatStyle'];
      if (typeof patch.hatColor === 'string') next.hatColor = patch.hatColor;
      break;
    case 'backpack':
      next.backpack = true;
      next.backpackVariant = undefined;
      break;
    case 'shoes':
      if (typeof patch.bootColor === 'string') next.bootColor = patch.bootColor;
      break;
    case 'companion':
      if (typeof patch.companion === 'string') next.companion = patch.companion as CompanionStyle;
      break;
    default:
      return applyBackendAppearancePatch(cleared, patch, true);
  }
  return next;
}

/** Builds mission-unlocked pattern items and level-unlocked companion items not already present in owned shop items. */
export function getUnlockedProgressionItems(ownedShopItems: ShopItem[]): WardrobeItem[] {
  const result: WardrobeItem[] = [];

  const shopPatternIds = new Set(
    ownedShopItems
      .filter((i) => i.category === 'pattern')
      .map((i) => String(i.appearancePatch?.pattern ?? i.appearancePatch?.shirtPattern ?? '').toLowerCase())
      .filter(Boolean)
  );
  for (const p of SHIRT_PATTERNS) {
    if (p.id === 'liso') continue;
    if (!isPatternUnlocked(p.id)) continue;
    if (shopPatternIds.has(p.id.toLowerCase())) continue;
    result.push({
      id: `mission_pattern_${p.id}`,
      category: 'pattern',
      name: p.name,
      description: p.desc,
      tier: 'common',
      rarity: 'common',
      priceWalnut: 0,
      priceCrystal: 0,
      price: { walnut: 0, crystal: 0 },
      priceRelics: 0,
      previewColor: '#db6b50',
      appearancePatch: { shirtPattern: p.id, pattern: p.id },
      owned: true,
      equipped: false,
      canAfford: true,
      missingCurrencies: { walnut: 0, crystal: 0 },
      source: 'mission',
      unlockHint: `Misión · ${p.biomeHint}`,
    });
  }

  const shopCompanions = new Set(
    ownedShopItems
      .filter((i) => i.category === 'companion')
      .map((i) => String(i.appearancePatch?.companion ?? '').toLowerCase())
      .filter(Boolean)
  );
  for (const c of COMPANIONS) {
    if (c.id === 'ninguno') continue;
    if (!isCompanionUnlocked(c.id)) continue;
    if (shopCompanions.has(c.id.toLowerCase())) continue;
    const lvl = unlockLevelFor(c.id) ?? 1;
    result.push({
      id: `level_companion_${c.id}`,
      category: 'companion',
      name: c.name,
      description: c.desc,
      tier: 'common',
      rarity: 'common',
      priceWalnut: 0,
      priceCrystal: 0,
      price: { walnut: 0, crystal: 0 },
      priceRelics: 0,
      previewColor: '#fbbf24',
      appearancePatch: { companion: c.id },
      owned: true,
      equipped: false,
      canAfford: true,
      missingCurrencies: { walnut: 0, crystal: 0 },
      source: lvl <= 1 ? 'base' : 'level',
      unlockHint: lvl <= 1 ? 'Inicial' : `Nivel ${lvl}`,
    });
  }

  return result;
}

/**
 * Fetches all shop items and reconciles `owned` & `equipped` flags with `/player/character` and `/shop/inventory`
 * so purchased items always appear consistently in both the Shop and Character Customization.
 */
export async function fetchOwnedShopItems(
  baseAppearance: CharacterAppearance
): Promise<{
  ownedItems: ShopItem[];
  equippedIds: string[];
  equippedByCategory: Record<string, string>;
  currencies?: CurrenciesBalance;
  backendAppearance?: Record<string, unknown>;
}> {
  if (!apiClient.isAuthenticated()) {
    return { ownedItems: [], equippedIds: [], equippedByCategory: {} };
  }

  const [catalogRes, inventoryRes, characterRes] = await Promise.allSettled([
    apiClient.getShopCatalog(),
    apiClient.getShopInventory(),
    apiClient.getPlayerCharacter(),
  ]);

  const catalogItems =
    catalogRes.status === 'fulfilled' && Array.isArray(catalogRes.value.items)
      ? catalogRes.value.items
      : [];

  const unlockedSet = new Set<string>();
  const equippedSet = new Set<string>();
  const equippedByCategory: Record<string, string> = {};
  let currencies: CurrenciesBalance | undefined;
  let backendAppearance: Record<string, unknown> | undefined;

  if (catalogRes.status === 'fulfilled' && catalogRes.value.currencies) {
    currencies = catalogRes.value.currencies;
  }

  if (inventoryRes.status === 'fulfilled' && inventoryRes.value) {
    const inv = inventoryRes.value;
    if (inv.currencies) currencies = inv.currencies;
    if (Array.isArray(inv.unlockedItems)) {
      for (const id of inv.unlockedItems) unlockedSet.add(id);
    }
    const eqList = inv.equippedItems ?? inv.equipped ?? [];
    if (Array.isArray(eqList)) {
      for (const id of eqList) equippedSet.add(id);
    }
    if (inv.equippedByCategory && typeof inv.equippedByCategory === 'object') {
      for (const [cat, id] of Object.entries(inv.equippedByCategory)) {
        if (typeof id === 'string' && id) {
          equippedByCategory[cat] = id;
          equippedSet.add(id);
        }
      }
    }
    if (inv.appearance && typeof inv.appearance === 'object') {
      backendAppearance = inv.appearance;
    }
  }

  if (characterRes.status === 'fulfilled' && characterRes.value) {
    const ch = characterRes.value;
    if (ch.currencies) currencies = ch.currencies;
    if (Array.isArray(ch.unlockedItems)) {
      for (const id of ch.unlockedItems) unlockedSet.add(id);
    }
    if (Array.isArray(ch.equippedItems)) {
      for (const id of ch.equippedItems) equippedSet.add(id);
    }
    if (ch.equippedByCategory && typeof ch.equippedByCategory === 'object') {
      for (const [cat, id] of Object.entries(ch.equippedByCategory)) {
        if (typeof id === 'string' && id) {
          equippedByCategory[cat] = id;
          equippedSet.add(id);
        }
      }
    }
    if (ch.appearance && typeof ch.appearance === 'object') {
      backendAppearance = ch.appearance;
    }
  }

  const reconciled: ShopItem[] = [];
  for (const item of catalogItems) {
    const isOwned = Boolean(item.owned || unlockedSet.has(item.id));
    const isEquipped = Boolean(
      item.equipped || equippedSet.has(item.id) || equippedByCategory[item.category] === item.id
    );
    if (isOwned) {
      if (isEquipped && !equippedByCategory[item.category]) {
        equippedByCategory[item.category] = item.id;
      }
      reconciled.push({
        ...item,
        owned: true,
        equipped: isEquipped,
      });
    }
  }

  syncOwnedShopUnlocks(reconciled, baseAppearance);

  return {
    ownedItems: reconciled,
    equippedIds: reconciled.filter((i) => i.equipped).map((i) => i.id),
    equippedByCategory,
    currencies,
    backendAppearance,
  };
}
