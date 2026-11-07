import React from 'react';
import { ITEM_INFO, ItemType } from '../game/items';

export const ItemThumb: React.FC<{
  type: ItemType;
  className?: string;
  title?: string;
}> = ({ type, className = 'w-5 h-5', title }) => {
  const label = title ?? ITEM_INFO[type].name;

  if (type === 'baya') {
    return (
      <svg
        viewBox="0 0 32 32"
        className={`select-none pointer-events-none drop-shadow-sm ${className}`}
        aria-label={label}
      >
        <title>{label}</title>
        {/* Leaf */}
        <path
          d="M16 9 C19 5, 25 6, 25 10 C25 13, 19 12, 16 11"
          fill="#4ade80"
          stroke="#16a34a"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        {/* Stem */}
        <path d="M16 11 L16 8" stroke="#15803d" strokeWidth="2" strokeLinecap="round" />
        {/* Berries Cluster */}
        <circle cx="12" cy="18" r="6.5" fill="#f43f5e" />
        <circle cx="20" cy="18" r="6.5" fill="#e11d48" />
        <circle cx="16" cy="22" r="6" fill="#be123c" />
        {/* Highlights */}
        <circle cx="10" cy="16" r="1.8" fill="#fda4af" opacity="0.8" />
        <circle cx="18" cy="16" r="1.8" fill="#fda4af" opacity="0.8" />
        <circle cx="15" cy="21" r="1.5" fill="#fecdd3" opacity="0.7" />
      </svg>
    );
  }

  if (type === 'nuez') {
    return (
      <svg
        viewBox="0 0 32 32"
        className={`select-none pointer-events-none drop-shadow-sm ${className}`}
        aria-label={label}
      >
        <title>{label}</title>
        {/* Stem */}
        <path d="M16 6 C16 4, 18 3, 19 3" stroke="#78350f" strokeWidth="2" strokeLinecap="round" fill="none" />
        {/* Cap */}
        <path
          d="M8 12 C8 8, 24 8, 24 12 C24 13.5, 8 13.5, 8 12 Z"
          fill="#92400e"
          stroke="#78350f"
          strokeWidth="1.5"
        />
        {/* Nut Body */}
        <path
          d="M8.5 12.5 C8.5 20, 13 27, 16 28 C19 27, 23.5 20, 23.5 12.5 Z"
          fill="#d97706"
          stroke="#b45309"
          strokeWidth="1.5"
        />
        {/* Nut Center Ridge */}
        <path d="M16 13 L16 27" stroke="#b45309" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
        {/* Highlight */}
        <path
          d="M11 15 C10.5 18, 12 22, 13 23"
          stroke="#fef08a"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.8"
        />
      </svg>
    );
  }

  const svg = (children: React.ReactNode) => (
    <svg viewBox="0 0 32 32" className={`select-none pointer-events-none drop-shadow-sm ${className}`} aria-label={label}>
      <title>{label}</title>
      {children}
    </svg>
  );

  switch (type) {
    case 'resortera':
      return svg(
        <>
          <path d="M16 29 L16 17 M16 17 L9 6 M16 17 L23 6" stroke="#92400e" strokeWidth="3.2" strokeLinecap="round" fill="none" />
          <path d="M9 7 Q16 16 23 7" stroke="#ef4444" strokeWidth="1.8" fill="none" />
          <circle cx="16" cy="12.5" r="2.4" fill="#9ca3af" stroke="#4b5563" strokeWidth="1" />
        </>
      );
    case 'piedra':
      return svg(
        <>
          <path d="M5 24 L8 16 L15 14 L19 19 L17 26 L9 27 Z" fill="#a8a29e" stroke="#57534e" strokeWidth="1.3" strokeLinejoin="round" />
          <path d="M16 22 L19 14 L25 13 L28 19 L26 25 L19 26 Z" fill="#d6d3d1" stroke="#57534e" strokeWidth="1.3" strokeLinejoin="round" />
          <path d="M11 13 L14 7 L20 7 L22 12 L18 15 L13 15 Z" fill="#78716c" stroke="#44403c" strokeWidth="1.3" strokeLinejoin="round" />
        </>
      );
    case 'bate':
      return svg(
        <>
          <path d="M6 27 L9 24" stroke="#1f2937" strokeWidth="4" strokeLinecap="round" />
          <path d="M8.5 24.5 L24 6.5" stroke="#d97706" strokeWidth="5.5" strokeLinecap="round" />
          <path d="M18 12 L24 6.5" stroke="#f59e0b" strokeWidth="7" strokeLinecap="round" />
          <path d="M20 9 L23 6" stroke="#fde68a" strokeWidth="1.4" strokeLinecap="round" />
        </>
      );
    case 'red':
      return svg(
        <>
          <path d="M6 28 L14 18" stroke="#78350f" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="19" cy="12" r="9" fill="#cffafe" fillOpacity="0.35" stroke="#0e7490" strokeWidth="2.2" />
          <path d="M12 8 L26 16 M11 13 L24 20 M14 5 L27 11 M15 20 L23 5 M11 16 L18 4 M19 21 L27 9" stroke="#22d3ee" strokeWidth="0.9" />
        </>
      );
    case 'bomba':
      return svg(
        <>
          <circle cx="15" cy="19" r="9" fill="#1f2937" stroke="#030712" strokeWidth="1.2" />
          <rect x="12.5" y="8.5" width="5" height="3" rx="1" fill="#6b7280" />
          <path d="M16 8.5 Q18 4 22 5" stroke="#d6d3d1" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <circle cx="23" cy="4.5" r="2.6" fill="#fbbf24" />
          <circle cx="23" cy="4.5" r="1.2" fill="#fff7ed" />
          <circle cx="11.5" cy="15.5" r="2" fill="#9ca3af" opacity="0.7" />
        </>
      );
    case 'luz':
      return svg(
        <>
          <circle cx="16" cy="16" r="12" fill="#fde68a" opacity="0.35" />
          <circle cx="16" cy="16" r="7.5" fill="#fef9c3" stroke="#facc15" strokeWidth="1.6" />
          <path d="M16 3 L16 7 M16 25 L16 29 M3 16 L7 16 M25 16 L29 16 M7 7 L9.5 9.5 M22.5 22.5 L25 25 M25 7 L22.5 9.5 M9.5 22.5 L7 25" stroke="#facc15" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="14" cy="14" r="2" fill="#ffffff" />
        </>
      );
    case 'antorcha':
      return svg(
        <>
          <path d="M16 29 L16 15" stroke="#78350f" strokeWidth="3.4" strokeLinecap="round" />
          <rect x="12.5" y="13" width="7" height="3.5" rx="1" fill="#44403c" />
          <path d="M16 3 C21 8, 21 12, 16 13 C11 12, 11 8, 16 3 Z" fill="#fb923c" stroke="#ea580c" strokeWidth="1" />
          <path d="M16 7 C18 9.5, 18 11, 16 12 C14 11, 14 9.5, 16 7 Z" fill="#fef08a" />
        </>
      );
    case 'palanca':
      return svg(
        <>
          <path d="M9 27 L21 9" stroke="#64748b" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M21 9 C22 5, 26.5 4.5, 27.5 8" stroke="#64748b" strokeWidth="3.2" fill="none" strokeLinecap="round" />
          <path d="M9 27 L5.5 26" stroke="#64748b" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M11.5 23.3 L15 18.2" stroke="#b91c1c" strokeWidth="4.4" strokeLinecap="round" />
        </>
      );
    default:
      break;
  }

  // type === 'llave'
  return (
    <svg
      viewBox="0 0 32 32"
      className={`select-none pointer-events-none drop-shadow-sm ${className}`}
      aria-label={label}
    >
      <title>{label}</title>
      <circle cx="11" cy="13" r="6" fill="#facc15" stroke="#ca8a04" strokeWidth="1.8" />
      <circle cx="11" cy="13" r="2.8" fill="#fef08a" stroke="#ca8a04" strokeWidth="1.2" />
      <path
        d="M16 15 L25 24 L27 22 L24 19 L26 17 L22 13"
        stroke="#eab308"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Teeth */}
      <path d="M22 21 L24 23 M25 18 L27 20" stroke="#ca8a04" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};
