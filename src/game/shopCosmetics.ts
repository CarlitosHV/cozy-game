/**
 * Shared helpers for syncing backend Shop items (owned & equipped)
 * with local character unlocks and CharacterAppearance state.
 */
import {
  apiClient,
  CurrenciesBalance,
  ShopCategory,
  ShopItem,
} from '../services/apiClient';
import {
  applyBackendAppearancePatch,
  CharacterAppearance,
  CompanionStyle,
} from './character';
import { unlockCosmeticPattern } from './dailyMissions';
import { unlockShopCompanion } from './progress';
import type { ShirtPatternId } from './patterns';

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

/** Applies a ShopItem onto a CharacterAppearance while preserving category previewColor fallbacks. */
export function applyShopItemToAppearance(
  base: CharacterAppearance,
  item: ShopItem,
  extraPatch?: Record<string, unknown>,
  equippedList?: string[]
): CharacterAppearance {
  const mergedPatch: Record<string, unknown> = {
    ...(item.appearancePatch || {}),
    ...(extraPatch || {}),
  };
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
  itemId?: string
): CharacterAppearance {
  let next: CharacterAppearance = serverAppearance
    ? applyBackendAppearancePatch(base, serverAppearance, true)
    : { ...base };
  if (Array.isArray(next.equippedShopIds) && itemId) {
    next.equippedShopIds = next.equippedShopIds.filter((id) => id !== itemId);
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
      break;
  }
  return next;
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
