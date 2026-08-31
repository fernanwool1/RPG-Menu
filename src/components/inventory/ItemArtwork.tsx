import type { ReactElement } from 'react';

import { cn } from '@/lib/cn';

/**
 * Generic local placeholder artwork for possessions.
 *
 * Deliberately drawn rather than photographed: shipping stock product shots
 * would misrepresent what the user actually owns. Each shape is a neutral
 * silhouette of its category. Swap `InventoryItem.image` for a real path or a
 * data URL and `<ItemArtwork>` steps aside.
 */

const SHAPES: Record<string, ReactElement> = {
  laptop: (
    <>
      <rect x="14" y="16" width="52" height="34" rx="2.5" />
      <rect x="18" y="20" width="44" height="26" rx="1" opacity="0.35" />
      <path d="M8 54 h64 l-4 6 H12 Z" />
    </>
  ),
  tablet: (
    <>
      <rect x="24" y="10" width="32" height="46" rx="3" />
      <rect x="27.5" y="14" width="25" height="36" rx="1" opacity="0.35" />
      <circle cx="40" cy="53" r="1.2" />
    </>
  ),
  desktop: (
    <>
      <rect x="16" y="26" width="48" height="22" rx="3" />
      <rect x="20" y="30" width="40" height="14" rx="1" opacity="0.3" />
      <circle cx="56" cy="44" r="1.3" />
    </>
  ),
  phone: (
    <>
      <rect x="29" y="10" width="22" height="46" rx="3.5" />
      <rect x="32" y="15" width="16" height="34" rx="1" opacity="0.35" />
      <rect x="36" y="12" width="8" height="1.6" rx="0.8" />
    </>
  ),
  headphones: (
    <>
      <path d="M18 40 v-6 a22 22 0 0 1 44 0 v6" />
      <rect x="12" y="38" width="10" height="17" rx="4" />
      <rect x="58" y="38" width="10" height="17" rx="4" />
    </>
  ),
  card: (
    <>
      <rect x="14" y="18" width="52" height="34" rx="3" />
      <circle cx="28" cy="31" r="5" opacity="0.5" />
      <path d="M21 45 q7 -7 14 0" opacity="0.5" />
      <path d="M42 28 h16 M42 34 h16 M42 40 h11" opacity="0.5" />
    </>
  ),
  wallet: (
    <>
      <rect x="14" y="20" width="52" height="32" rx="4" />
      <path d="M14 30 h52" opacity="0.4" />
      <rect x="48" y="33" width="18" height="9" rx="2" opacity="0.6" />
      <circle cx="57" cy="37.5" r="1.6" />
    </>
  ),
  generic: (
    <>
      <path d="M40 12 L66 25 v22 L40 60 L14 47 V25 Z" />
      <path d="M14 25 L40 38 L66 25" opacity="0.45" />
      <path d="M40 38 V60" opacity="0.45" />
    </>
  ),
};

export function ItemArtwork({
  kind,
  className,
  size = 'md',
}: {
  kind: string | null | undefined;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const shape = SHAPES[kind ?? 'generic'] ?? SHAPES.generic;
  const dimension = size === 'sm' ? 'h-10 w-10' : size === 'lg' ? 'h-28 w-28' : 'h-14 w-14';

  return (
    <svg
      viewBox="0 0 80 70"
      aria-hidden
      className={cn('text-ivory-dim/70', dimension, className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {shape}
    </svg>
  );
}
