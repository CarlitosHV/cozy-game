import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Backpack,
  Check,
  Eye,
  EyeOff,
  Gem,
  Glasses,
  HardHat,
  Layers,
  Loader2,
  Palette,
  RefreshCw,
  RotateCcw,
  Scissors,
  Search,
  Shirt,
  ShoppingBag,
  Sparkles,
  UserRound,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  apiClient,
  ShopCatalogCategory,
  ShopCategory,
  ShopItem,
  ShopRarity,
  User,
} from '../services/apiClient';
import {
  applyBackendAppearancePatch,
  CharacterAppearance,
} from '../game/character';
import { getPatternSwatchUrl } from '../game/patterns';
import {
  applyShopItemToAppearance,
  syncOwnedShopUnlocks,
} from '../game/shopCosmetics';
import { COMPANION_ICONS } from './CharacterCreator';
import { friendlyError } from '../utils/locale';

interface LobbyShopProps {
  appearance: CharacterAppearance;
  currentUser: User | null;
  relicsBalance: number;
  portrait: boolean;
  onRelicsBalanceChange: (next: number) => void;
  onApplyAppearance: (next: CharacterAppearance, syncServer?: boolean) => void;
  onTempPreview: (temp: CharacterAppearance | null) => void;
  onZoom?: (delta: number) => void;
  onOpenAuth: () => void;
  onToast: (msg: string, ms?: number, tone?: 'neutral' | 'success' | 'error') => void;
}

const DEFAULT_CATEGORIES: ShopCatalogCategory[] = [
  { id: 'skin', label: 'Pieles' },
  { id: 'hat', label: 'Gorros' },
  { id: 'outfit', label: 'Conjuntos' },
  { id: 'pattern', label: 'Patrones' },
  { id: 'glasses', label: 'Lentes' },
  { id: 'backpack', label: 'Mochilas' },
  { id: 'hair', label: 'Peinados' },
  { id: 'companion', label: 'Compañeros' },
];

const RARITY_META: Record<
  ShopRarity,
  { label: string; textClass: string; lineColor: string }
> = {
  common: {
    label: 'Común',
    textClass: 'text-slate-600',
    lineColor: '#94a3b8',
  },
  rare: {
    label: 'Raro',
    textClass: 'text-sky-700',
    lineColor: '#38bdf8',
  },
  epic: {
    label: 'Épico',
    textClass: 'text-violet-700',
    lineColor: '#a78bfa',
  },
  legendary: {
    label: 'Legendario',
    textClass: 'text-amber-700',
    lineColor: '#f59e0b',
  },
};

function categoryIcon(cat: ShopCategory | 'all') {
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
    case 'companion':
      return <Sparkles className="w-3.5 h-3.5 shrink-0" />;
    default:
      return <ShoppingBag className="w-3.5 h-3.5 shrink-0" />;
  }
}

export const LobbyShop: React.FC<LobbyShopProps> = ({
  appearance,
  currentUser,
  relicsBalance,
  portrait,
  onRelicsBalanceChange,
  onApplyAppearance,
  onTempPreview,
  onZoom,
  onOpenAuth,
  onToast,
}) => {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [categories, setCategories] = useState<ShopCatalogCategory[]>(DEFAULT_CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState<'all' | ShopCategory>('all');
  const [selectedRarity, setSelectedRarity] = useState<'all' | ShopRarity>('all');
  const [onlyOwned, setOnlyOwned] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [previewingItem, setPreviewingItem] = useState<ShopItem | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  const isAuth = apiClient.isAuthenticated();

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await apiClient.getShopCatalog();
      const loadedItems = Array.isArray(data.items) ? data.items : [];
      setItems(loadedItems);
      syncOwnedShopUnlocks(loadedItems, appearance);
      if (Array.isArray(data.categories) && data.categories.length > 0) {
        setCategories(data.categories);
      }
      if (typeof data.relicsBalance === 'number') {
        onRelicsBalanceChange(data.relicsBalance);
      }
    } catch (err) {
      setErrorMsg(
        friendlyError(err, 'No se pudo cargar el catálogo de la tienda. Revisa tu conexión.')
      );
    } finally {
      setLoading(false);
    }
  }, [onRelicsBalanceChange]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog, currentUser?._id]);

  const onTempPreviewRef = useRef(onTempPreview);
  onTempPreviewRef.current = onTempPreview;

  // Clear temporary preview only when leaving/unmounting the shop tab
  useEffect(() => {
    return () => {
      onTempPreviewRef.current(null);
    };
  }, []);

  const categoryLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of DEFAULT_CATEGORIES) map[c.id] = c.label;
    for (const c of categories) map[c.id] = c.label;
    return map;
  }, [categories]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      if (selectedRarity !== 'all' && item.rarity !== selectedRarity) return false;
      if (onlyOwned && !item.owned) return false;
      if (
        q &&
        !item.name.toLowerCase().includes(q) &&
        !item.description.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [items, selectedCategory, selectedRarity, onlyOwned, searchQuery]);

  const handleTogglePreview = (item: ShopItem) => {
    if (previewingItem?.id === item.id) {
      setPreviewingItem(null);
      onTempPreview(null);
      return;
    }
    const patched = applyShopItemToAppearance(appearance, item);
    setPreviewingItem(item);
    onTempPreview(patched);
  };

  const handleClearPreview = () => {
    setPreviewingItem(null);
    onTempPreview(null);
  };

  const handleQuickGuestAuth = async () => {
    if (authBusy) return;
    setAuthBusy(true);
    try {
      await apiClient.ensureAuthenticated();
      onToast('Sesión lista para comprar cosméticos', 2200, 'success');
      await loadCatalog();
    } catch (err) {
      onToast(
        friendlyError(err, 'No se pudo iniciar sesión rápida. Prueba desde Mi Cuenta.'),
        2800,
        'error'
      );
    } finally {
      setAuthBusy(false);
    }
  };

  const handlePurchase = async (item: ShopItem) => {
    if (!apiClient.isAuthenticated()) {
      onToast('Inicia sesión para comprar artículos en la tienda.', 2400, 'neutral');
      onOpenAuth();
      return;
    }
    if (busyItemId) return;
    setBusyItemId(item.id);
    try {
      const res = await apiClient.purchaseShopItem(item.id, true);
      if (typeof res.relicsBalance === 'number') {
        onRelicsBalanceChange(res.relicsBalance);
      }
      const nextAppearance = applyShopItemToAppearance(
        appearance,
        item,
        res.appearance || undefined
      );
      setPreviewingItem(null);
      onTempPreview(null);
      onApplyAppearance(nextAppearance, false);

      const newBalance = typeof res.relicsBalance === 'number' ? res.relicsBalance : relicsBalance;
      const unlockedSet = new Set(res.unlockedItems || []);
      setItems((prev) =>
        prev.map((it) => {
          const isPurchased = it.id === item.id;
          const isOwned = it.owned || isPurchased || unlockedSet.has(it.id);
          const sameCatUnequip = res.equipped && it.category === item.category && !isPurchased;
          return {
            ...it,
            owned: isOwned,
            equipped: isPurchased ? Boolean(res.equipped) : sameCatUnequip ? false : it.equipped,
            canAfford: newBalance >= it.priceRelics,
          };
        })
      );

      onToast(
        res.message || `¡Compraste y equipaste "${item.name}"!`,
        2600,
        'success'
      );
    } catch (err) {
      const e = err as Error & { code?: string; details?: { required?: number; available?: number; missing?: number } };
      if (e.code === 'INSUFFICIENT_RELICS') {
        const missing = e.details?.missing;
        onToast(
          typeof missing === 'number'
            ? `Te faltan ${missing} reliquias para "${item.name}".`
            : `No tienes suficientes reliquias para "${item.name}".`,
          2800,
          'error'
        );
      } else if (e.code === 'ALREADY_OWNED') {
        onToast(`Ya tienes "${item.name}" desbloqueado.`, 2200, 'neutral');
        void loadCatalog();
      } else {
        onToast(friendlyError(err, 'No se pudo completar la compra.'), 2800, 'error');
      }
    } finally {
      setBusyItemId(null);
    }
  };

  const handleEquip = async (item: ShopItem) => {
    if (!apiClient.isAuthenticated()) {
      onOpenAuth();
      return;
    }
    if (busyItemId) return;
    setBusyItemId(item.id);
    try {
      const res = await apiClient.equipShopItems(item.id);
      const equippedList = res.equippedItems || res.equipped;
      const nextAppearance = applyShopItemToAppearance(
        appearance,
        item,
        res.appearance || undefined,
        Array.isArray(equippedList) ? equippedList : undefined
      );
      setPreviewingItem(null);
      onTempPreview(null);
      onApplyAppearance(nextAppearance, false);

      setItems((prev) =>
        prev.map((it) => {
          if (Array.isArray(equippedList)) {
            return { ...it, equipped: equippedList.includes(it.id) };
          }
          if (it.id === item.id) return { ...it, equipped: true };
          if (it.category === item.category) return { ...it, equipped: false };
          return it;
        })
      );

      onToast(res.message || `"${item.name}" equipado`, 2000, 'success');
    } catch (err) {
      const e = err as Error & { code?: string };
      if (e.code === 'ITEM_LOCKED') {
        onToast('Debes comprar este artículo antes de equiparlo.', 2400, 'error');
      } else {
        onToast(friendlyError(err, 'No se pudo equipar este artículo.'), 2400, 'error');
      }
    } finally {
      setBusyItemId(null);
    }
  };

  const renderItemThumb = (item: ShopItem) => {
    const patch = item.appearancePatch || {};
    if (item.category === 'pattern') {
      const candidate = applyBackendAppearancePatch(appearance, patch, true);
      const swatch = getPatternSwatchUrl(
        candidate.shirtPattern ?? 'liso',
        candidate.sweaterColor,
        candidate.detailColor
      );
      if (swatch) {
        return (
          <img
            src={swatch}
            alt={item.name}
            className="w-11 h-11 rounded-xl object-cover border border-cozy-line shrink-0 shadow-xs"
          />
        );
      }
    }
    if (item.category === 'companion') {
      const candidate = applyBackendAppearancePatch(appearance, patch, true);
      const icon = COMPANION_ICONS[candidate.companion];
      return (
        <div
          className="w-11 h-11 rounded-xl border border-cozy-line flex items-center justify-center shrink-0 text-cozy-ink shadow-xs"
          style={{
            background: `radial-gradient(circle at 30% 30%, ${item.previewColor || '#f59e0b'}35, rgba(255,255,255,0.88))`,
          }}
        >
          {icon}
        </div>
      );
    }
    return (
      <div
        className="w-11 h-11 rounded-xl border border-cozy-line flex items-center justify-center shrink-0 text-cozy-ink shadow-xs"
        style={{
          background: `linear-gradient(135deg, ${item.previewColor || '#f59e0b'}40, rgba(255,255,255,0.92))`,
        }}
      >
        {categoryIcon(item.category)}
      </div>
    );
  };

  const catalogDrawerPos = portrait
    ? 'inset-x-0 bottom-0 h-[58%] rounded-t-3xl border-t'
    : 'left-0 top-14 bottom-0 w-full md:w-[58%] lg:w-[56%] xl:w-[54%] border-r';

  return (
    <div className="absolute inset-0 pointer-events-none z-20 text-cozy-ink">
      {/* Floating Preview Controls over open 3D Character Viewport */}
      <div
        className={`absolute pointer-events-auto flex flex-col gap-2 ${
          portrait
            ? 'top-16 right-3 items-end'
            : 'top-20 right-5 items-end'
        }`}
      >
        {previewingItem && (
          <div className="rounded-2xl bg-white/82 backdrop-blur-xl border border-amber-400/55 px-3 py-2 text-right shadow-xl max-w-[230px]">
            <div className="text-[10px] font-bold uppercase tracking-wider text-cozy-accent-deep">
              Vista previa activa
            </div>
            <div className="text-xs font-bold text-cozy-ink truncate">{previewingItem.name}</div>
            <button
              type="button"
              onClick={handleClearPreview}
              className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg cozy-btn text-[11px] font-semibold cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Restaurar aspecto
            </button>
          </div>
        )}

        {onZoom && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onZoom(-0.14)}
              title="Acercar personaje"
              aria-label="Acercar"
              className="p-2 rounded-xl bg-white/78 hover:bg-white/95 text-cozy-ink border border-white/75 backdrop-blur-xl shadow-md cursor-pointer transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onZoom(0.14)}
              title="Alejar personaje"
              aria-label="Alejar"
              className="p-2 rounded-xl bg-white/78 hover:bg-white/95 text-cozy-ink border border-white/75 backdrop-blur-xl shadow-md cursor-pointer transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
          </div>
        )}

        {!portrait && (
          <span className="text-[11px] text-cozy-ink bg-white/75 border border-white/70 px-2.5 py-1 rounded-xl backdrop-blur-md shadow-xs">
            Arrastra al personaje para girar 360°
          </span>
        )}
      </div>

      {/* Main Left Store Panel (White & Translucent Frosted Glass) */}
      <div
        className={`absolute ${catalogDrawerPos} pointer-events-auto flex flex-col bg-white/80 backdrop-blur-xl border-white/75 text-cozy-ink shadow-2xl overflow-hidden`}
      >
        {/* Shop Header */}
        <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-cozy-line flex flex-wrap items-center justify-between gap-3 bg-white/40">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display font-bold text-lg sm:text-xl text-cozy-ink tracking-wide">
                Tienda de Reliquias
              </h2>
              <span className="text-xs text-cozy-muted tabular-nums font-semibold">
                · {items.length} artículos
              </span>
            </div>
            <p className="text-xs text-cozy-muted mt-0.5">
              Desbloquea estilos, conjuntos, patrones y compañeros con tus reliquias.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50/90 border border-amber-300/60 text-amber-800 shadow-xs">
              <Gem className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-black tabular-nums">{relicsBalance}</span>
              <span className="text-[11px] text-amber-700 font-semibold">Reliquias</span>
            </div>
            <button
              type="button"
              onClick={() => void loadCatalog()}
              disabled={loading}
              title="Actualizar tienda"
              aria-label="Actualizar tienda"
              className="p-2 rounded-xl cozy-btn cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Auth Notice if Guest */}
        {!isAuth && (
          <div className="mx-4 sm:mx-5 mt-3 p-3 rounded-2xl bg-amber-50/85 border border-amber-300/55 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 text-xs text-amber-950 min-w-0">
              <UserRound className="w-4 h-4 text-cozy-accent-deep shrink-0" />
              <span>
                Inicia sesión para guardar tus compras y sincronizar tus reliquias.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onOpenAuth}
                className="px-3 py-1.5 rounded-xl cozy-btn-primary font-bold text-xs cursor-pointer"
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                onClick={() => void handleQuickGuestAuth()}
                disabled={authBusy}
                className="px-3 py-1.5 rounded-xl cozy-btn font-semibold text-xs cursor-pointer disabled:opacity-50"
              >
                {authBusy ? 'Creando…' : 'Invitado rápido'}
              </button>
            </div>
          </div>
        )}

        {/* Categories Strip */}
        <div className="px-4 sm:px-5 pt-3 pb-2.5 border-b border-cozy-line flex flex-col gap-2.5 bg-white/30">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                selectedCategory === 'all'
                  ? 'cozy-tab-active'
                  : 'bg-white/55 hover:bg-white/85 text-cozy-muted border border-cozy-line'
              }`}
            >
              {categoryIcon('all')}
              <span>Todo</span>
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                  selectedCategory === cat.id
                    ? 'cozy-tab-active'
                    : 'bg-white/55 hover:bg-white/85 text-cozy-muted border border-cozy-line'
                }`}
              >
                {categoryIcon(cat.id)}
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Search + Rarity + Owned Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="w-3.5 h-3.5 text-cozy-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar cosmético…"
                className="w-full pl-8 pr-3 py-1.5 rounded-xl cozy-input text-xs placeholder:text-cozy-soft"
              />
            </div>

            <select
              value={selectedRarity}
              onChange={(e) => setSelectedRarity(e.target.value as 'all' | ShopRarity)}
              aria-label="Filtrar por rareza"
              className="px-2.5 py-1.5 rounded-xl cozy-input text-xs font-semibold cursor-pointer"
            >
              <option value="all">Todas las rarezas</option>
              <option value="common">Común</option>
              <option value="rare">Raro</option>
              <option value="epic">Épico</option>
              <option value="legendary">Legendario</option>
            </select>

            <button
              type="button"
              onClick={() => setOnlyOwned((v) => !v)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer transition-colors ${
                onlyOwned
                  ? 'cozy-badge-moss'
                  : 'bg-white/75 border-cozy-line text-cozy-muted hover:bg-white/95 hover:text-cozy-ink'
              }`}
            >
              Mis objetos
            </button>
          </div>
        </div>

        {/* Catalog Grid Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 overscroll-contain">
          {loading ? (
            <div className="h-48 flex flex-col items-center justify-center gap-2 text-cozy-muted text-xs">
              <Loader2 className="w-6 h-6 animate-spin text-cozy-accent-deep" />
              <span>Cargando catálogo de la tienda…</span>
            </div>
          ) : errorMsg ? (
            <div className="rounded-2xl bg-cozy-blush-soft/85 border border-cozy-blush/50 p-4 flex flex-col items-center text-center gap-3">
              <p className="text-xs text-[#8a4a52] font-medium">{errorMsg}</p>
              <button
                type="button"
                onClick={() => void loadCatalog()}
                className="px-3.5 py-1.5 rounded-xl cozy-btn text-xs font-bold cursor-pointer"
              >
                Reintentar
              </button>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="h-44 flex flex-col items-center justify-center text-center gap-2 text-cozy-muted">
              <ShoppingBag className="w-7 h-7 opacity-40" />
              <p className="text-sm font-semibold text-cozy-ink">
                No hay cosméticos con estos filtros
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('all');
                  setSelectedRarity('all');
                  setOnlyOwned(false);
                  setSearchQuery('');
                }}
                className="px-3 py-1.5 rounded-xl cozy-btn text-xs font-semibold cursor-pointer"
              >
                Ver todo el catálogo
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 pb-4">
              {filteredItems.map((item) => {
                const rarity = RARITY_META[item.rarity] ?? RARITY_META.common;
                const isPreviewing = previewingItem?.id === item.id;
                const isBusy = busyItemId === item.id;
                const canBuyNow = isAuth && relicsBalance >= item.priceRelics;

                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl bg-white/75 hover:bg-white/90 backdrop-blur-md border flex flex-col justify-between overflow-hidden transition-all shadow-sm ${
                      isPreviewing
                        ? 'border-cozy-accent-deep ring-1 ring-cozy-accent/40'
                        : item.equipped
                          ? 'border-cozy-moss/60'
                          : 'border-white/80 hover:border-cozy-line'
                    }`}
                    style={{ borderTopWidth: '3px', borderTopColor: rarity.lineColor }}
                  >
                    <div className="p-3.5 flex flex-col gap-2.5">
                      <div className="flex items-start gap-2.5">
                        {renderItemThumb(item)}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
                            <span className={rarity.textClass}>{rarity.label}</span>
                            <span className="text-cozy-soft">·</span>
                            <span className="text-cozy-muted truncate">
                              {categoryLabelMap[item.category] || item.category}
                            </span>
                          </div>
                          <h3 className="text-sm font-bold text-cozy-ink leading-snug mt-0.5 line-clamp-1">
                            {item.name}
                          </h3>
                        </div>
                      </div>

                      <p className="text-[11px] text-cozy-muted leading-relaxed line-clamp-2 min-h-[2rem]">
                        {item.description}
                      </p>
                    </div>

                    <div className="px-3.5 py-2.5 bg-white/55 border-t border-cozy-line flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleTogglePreview(item)}
                        title={isPreviewing ? 'Quitar vista previa' : 'Probar en personaje'}
                        className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors shrink-0 ${
                          isPreviewing
                            ? 'bg-amber-100/90 text-amber-900 border border-amber-400/50'
                            : 'cozy-btn'
                        }`}
                      >
                        {isPreviewing ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        <span>{isPreviewing ? 'Quitar' : 'Probar'}</span>
                      </button>

                      {item.equipped ? (
                        <div className="flex-1 py-1.5 px-2.5 rounded-xl cozy-badge-moss text-[11px] font-bold flex items-center justify-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>Equipado</span>
                        </div>
                      ) : item.owned ? (
                        <button
                          type="button"
                          onClick={() => void handleEquip(item)}
                          disabled={isBusy}
                          className="flex-1 py-1.5 px-2.5 rounded-xl bg-cozy-sky-soft hover:bg-[#c5e2f2] border border-cozy-sky/40 text-[#27566e] text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 transition-colors"
                        >
                          {isBusy ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <span>Equipar</span>
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handlePurchase(item)}
                          disabled={isBusy}
                          className={`flex-1 py-1.5 px-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 transition-colors ${
                            canBuyNow || !isAuth
                              ? 'cozy-btn-primary'
                              : 'bg-stone-200/80 border border-stone-300/60 text-stone-600 hover:bg-stone-200'
                          }`}
                        >
                          {isBusy ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <>
                              <Gem className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                              <span className="tabular-nums">{item.priceRelics}</span>
                              <span className="ml-0.5">Comprar</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
