import React, { useMemo } from 'react';
import { getItemPreviewUrl, ITEM_INFO, ItemType } from '../game/items';

export const ItemThumb: React.FC<{
  type: ItemType;
  className?: string;
  title?: string;
}> = ({ type, className = 'w-5 h-5', title }) => {
  const src = useMemo(() => getItemPreviewUrl(type), [type]);
  const label = title ?? ITEM_INFO[type].name;

  if (!src) {
    return (
      <span
        className={`inline-block rounded-md ${className}`}
        style={{ backgroundColor: ITEM_INFO[type].color }}
        aria-label={label}
        title={label}
      />
    );
  }

  return (
    <img
      src={src}
      alt={label}
      title={label}
      draggable={false}
      className={`object-contain select-none pointer-events-none ${className}`}
    />
  );
};
