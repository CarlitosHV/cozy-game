import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

/** Custom stylized Golden Walnut (Reliquia Nuez) SVG */
export const WalnutIcon: React.FC<IconProps> = ({ size = 18, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 ${className}`}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="walnutShellGrad" x1="4" y1="4" x2="20" y2="21" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#fde047" />
        <stop offset="50%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#b45309" />
      </linearGradient>
      <linearGradient id="walnutCapGrad" x1="5" y1="3" x2="19" y2="11" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#92400e" />
        <stop offset="100%" stopColor="#451a03" />
      </linearGradient>
    </defs>
    {/* Stem */}
    <path d="M12 2.5C12.8 2.5 13.8 3.2 14.2 4.5" stroke="#78350f" strokeWidth="2.2" strokeLinecap="round" />
    {/* Acorn / Walnut body */}
    <path
      d="M6.2 10.2C5.8 14.5 8.1 19.6 12 21.5C15.9 19.6 18.2 14.5 17.8 10.2H6.2Z"
      fill="url(#walnutShellGrad)"
      stroke="#92400e"
      strokeWidth="1.2"
    />
    {/* Cap */}
    <path
      d="M5 9.2C5 6.4 8.1 4.6 12 4.6C15.9 4.6 19 6.4 19 9.2C19 10.3 18.2 10.9 17.2 10.9H6.8C5.8 10.9 5 10.3 5 9.2Z"
      fill="url(#walnutCapGrad)"
      stroke="#451a03"
      strokeWidth="1.1"
    />
    {/* Highlight */}
    <ellipse cx="9.6" cy="14" rx="1.4" ry="2.6" transform="rotate(-12 9.6 14)" fill="#fef9c3" fillOpacity="0.55" />
  </svg>
);

/** Custom stylized Crystal Relic (Reliquia Cristal) SVG */
export const CrystalIcon: React.FC<IconProps> = ({ size = 18, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 ${className}`}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="crystalGrad" x1="5" y1="2" x2="19" y2="22" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#67e8f9" />
        <stop offset="50%" stopColor="#38bdf8" />
        <stop offset="100%" stopColor="#818cf8" />
      </linearGradient>
    </defs>
    {/* Outer diamond facets */}
    <path
      d="M12 2L19 9.2L12 22L5 9.2L12 2Z"
      fill="url(#crystalGrad)"
      stroke="#0284c7"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    {/* Inner facet lines */}
    <path d="M12 2L14.8 9.2L12 22L9.2 9.2L12 2Z" fill="#e0f2fe" fillOpacity="0.45" />
    <path d="M5 9.2H19" stroke="#e0f2fe" strokeWidth="1" strokeOpacity="0.7" />
    {/* Sparkle glint */}
    <path d="M16.5 4.2L17 5.5L18.3 6L17 6.5L16.5 7.8L16 6.5L14.7 6L16 5.5L16.5 4.2Z" fill="#cffafe" />
  </svg>
);

interface PillProps {
  value: number | string;
  size?: 'xs' | 'sm' | 'md';
  label?: string;
  dimmed?: boolean;
  className?: string;
}

export const WalnutPill: React.FC<PillProps> = ({ value, size = 'sm', label, dimmed = false, className = '' }) => {
  const padding =
    size === 'xs' ? 'px-2 py-0.5 text-[11px]' : size === 'md' ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-xs';
  const iconSize = size === 'xs' ? 13 : size === 'md' ? 18 : 15;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-xl border font-bold tracking-tight transition ${
        dimmed
          ? 'bg-rose-50/90 border-rose-200 text-rose-700'
          : 'bg-amber-50/95 border-amber-200/90 text-amber-900'
      } ${padding} ${className}`}
      title={label ?? 'Reliquias de Nuez'}
    >
      <WalnutIcon size={iconSize} />
      <span className="tabular-nums">{value}</span>
    </span>
  );
};

export const CrystalPill: React.FC<PillProps> = ({ value, size = 'sm', label, dimmed = false, className = '' }) => {
  const padding =
    size === 'xs' ? 'px-2 py-0.5 text-[11px]' : size === 'md' ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-xs';
  const iconSize = size === 'xs' ? 13 : size === 'md' ? 18 : 15;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-xl border font-bold tracking-tight transition ${
        dimmed
          ? 'bg-rose-50/90 border-rose-200 text-rose-700'
          : 'bg-sky-50/95 border-sky-200/90 text-sky-900'
      } ${padding} ${className}`}
      title={label ?? 'Reliquias de Cristal'}
    >
      <CrystalIcon size={iconSize} />
      <span className="tabular-nums">{value}</span>
    </span>
  );
};

interface DualCurrencyBalanceProps {
  walnut: number;
  crystal: number;
  size?: 'xs' | 'sm' | 'md';
  showLabels?: boolean;
  className?: string;
}

export const DualCurrencyBalance: React.FC<DualCurrencyBalanceProps> = ({
  walnut,
  crystal,
  size = 'sm',
  showLabels = false,
  className = '',
}) => (
  <div className={`inline-flex items-center gap-1.5 ${className}`}>
    <WalnutPill
      size={size}
      value={showLabels ? `${walnut} Nuez` : walnut}
      label={`${walnut} Reliquias de Nuez`}
    />
    <CrystalPill
      size={size}
      value={showLabels ? `${crystal} Cristal` : crystal}
      label={`${crystal} Reliquias de Cristal`}
    />
  </div>
);

interface ItemPricePillsProps {
  walnut: number;
  crystal: number;
  missingWalnut?: number;
  missingCrystal?: number;
  size?: 'xs' | 'sm';
  freeLabel?: string;
}

export const ItemPricePills: React.FC<ItemPricePillsProps> = ({
  walnut,
  crystal,
  missingWalnut = 0,
  missingCrystal = 0,
  size = 'xs',
  freeLabel = 'Gratis',
}) => {
  if (walnut <= 0 && crystal <= 0) {
    return (
      <span className="inline-flex items-center rounded-xl border border-emerald-200 bg-emerald-50/95 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
        {freeLabel}
      </span>
    );
  }
  return (
    <div className="inline-flex flex-wrap items-center gap-1.5">
      {walnut > 0 && (
        <WalnutPill
          size={size}
          value={walnut}
          dimmed={missingWalnut > 0}
          label={
            missingWalnut > 0
              ? `Requiere ${walnut} Nueces (te faltan ${missingWalnut})`
              : `${walnut} Reliquias de Nuez`
          }
        />
      )}
      {crystal > 0 && (
        <CrystalPill
          size={size}
          value={crystal}
          dimmed={missingCrystal > 0}
          label={
            missingCrystal > 0
              ? `Requiere ${crystal} Cristales (te faltan ${missingCrystal})`
              : `${crystal} Reliquias de Cristal`
          }
        />
      )}
    </div>
  );
};
