/**
 * Shared helpers for syncing backend Shop items (owned & equipped)
 * with local character unlocks and CharacterAppearance state.
 */
import {
  apiClient,
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

/**
 * Fetches all shop items and reconciles `owned` & `equipped` flags with `/shop/inventory`
 * so purchased items always appear consistently in both the Shop and Character Customization.
 */
export async function fetchOwnedShopItems(
  baseAppearance: CharacterAppearance
): Promise<{
  ownedItems: ShopItem[];
  equippedIds: string[];
  backendAppearance?: Record<string, unknown>;
}> {
  if (!apiClient.isAuthenticated()) {
    return { ownedItems: [], equippedIds: [] };
  }

  const [catalogRes, inventoryRes] = await Promise.allSettled([
    apiClient.getShopCatalog(),
    apiClient.getShopInventory(),
  ]);

  const catalogItems =
    catalogRes.status === 'fulfilled' && Array.isArray(catalogRes.value.items)
      ? catalogRes.value.items
      : [];

  const unlockedSet = new Set<string>();
  const equippedSet = new Set<string>();
  let backendAppearance: Record<string, unknown> | undefined;

  if (inventoryRes.status === 'fulfilled' && inventoryRes.value) {
    const inv = inventoryRes.value;
    if (Array.isArray(inv.unlockedItems)) {
      for (const id of inv.unlockedItems) unlockedSet.add(id);
    }
    const eqList = inv.equippedItems ?? inv.equipped ?? [];
    if (Array.isArray(eqList)) {
      for (const id of eqList) equippedSet.add(id);
    }
    if (inv.appearance && typeof inv.appearance === 'object') {
      backendAppearance = inv.appearance;
    }
  }

  const reconciled: ShopItem[] = [];
  for (const item of catalogItems) {
    const isOwned = Boolean(item.owned || unlockedSet.has(item.id));
    const isEquipped = Boolean(item.equipped || equippedSet.has(item.id));
    if (isOwned) {
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
    backendAppearance,
  };
}
