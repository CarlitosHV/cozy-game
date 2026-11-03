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
