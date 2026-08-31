'use client';

import { useEffect, useState } from 'react';

import { ICON_GOLD } from '@/lib/gameIcons';
import { cn } from '@/lib/cn';

/**
 * Renders a PNG emblem as a CSS mask, so one file can be tinted any colour.
 *
 * The supplied artwork is antique gold on transparency, and its alpha channel
 * carries the engraving detail rather than just a silhouette - masking keeps
 * that shading while letting state drive the colour. That is why this uses a
 * mask and not a stack of CSS filters, which cannot hit an exact hue.
 *
 * Where `mask-image` is unsupported the component falls back to drawing the
 * original PNG, which still reads correctly because the artwork is already
 * gold. Colour is never the only carrier of meaning in this app, so losing the
 * tint on an old browser costs nothing.
 */

export interface GameIconProps {
  src: string;
  /** Rendered size in px. Width and height are always equal. */
  size?: number;
  color?: string;
  className?: string;
  /** Provide when the icon is the only label; omit when text sits beside it. */
  label?: string;
  /** 0..1, for the muted locked treatment. */
  opacity?: number;
}

/**
 * Feature-detected once, lazily, on the client. `null` until known, so the
 * first paint does not commit to the wrong branch.
 */
let maskSupport: boolean | null = null;

function detectMaskSupport(): boolean {
  if (maskSupport !== null) return maskSupport;
  if (typeof window === 'undefined' || typeof CSS === 'undefined' || !CSS.supports) {
    return true;
  }
  maskSupport =
    CSS.supports('mask-image', 'url("a.png")') ||
    CSS.supports('-webkit-mask-image', 'url("a.png")');
  return maskSupport;
}

export function GameIcon({
  src,
  size = 40,
  color = ICON_GOLD,
  className,
  label,
  opacity,
}: GameIconProps) {
  // Assume masking on the server and first paint; correct it if absent.
  const [masked, setMasked] = useState(true);

  useEffect(() => {
    setMasked(detectMaskSupport());
  }, []);

  const a11y = label
    ? ({ role: 'img' as const, 'aria-label': label })
    : ({ 'aria-hidden': true } as const);

  // Reserving the box up front is what stops icons shifting the layout while
  // the mask or image loads.
  const box = { width: size, height: size, flexShrink: 0 } as const;

  if (!masked) {
    /*
     * A plain <img> on purpose: next/image adds a wrapper and sizing behaviour
     * the mask branch does not have, so the two paths would lay out
     * differently. These files are already optimised at build time by
     * scripts/build-icons.mjs, and this branch only runs where CSS masking is
     * unavailable.
     */
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={label ?? ''}
        width={size}
        height={size}
        className={cn('inline-block object-contain', className)}
        style={{ ...box, opacity }}
        draggable={false}
        {...(label ? {} : { 'aria-hidden': true })}
      />
    );
  }

  return (
    <span
      {...a11y}
      className={cn('inline-block', className)}
      style={{
        ...box,
        display: 'inline-block',
        backgroundColor: color,
        opacity,
        WebkitMaskImage: `url("${src}")`,
        maskImage: `url("${src}")`,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        // `contain` is what guarantees the symbol is never cropped or
        // stretched by a flexible container.
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
      }}
    />
  );
}
