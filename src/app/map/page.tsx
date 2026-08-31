import type { Metadata } from 'next';

import { GamePanel } from '@/components/ui/GamePanel';

export const metadata: Metadata = { title: 'Map — Menu' };

/**
 * Deliberately not implemented in version one.
 *
 * The Map route exists so the header matches the reference and so the slot is
 * reserved, but shipping a half-working map would be worse than an honest
 * placeholder. Nothing on this page pretends to be interactive.
 */
export default function MapPage() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center">
      <GamePanel className="w-full max-w-xl" title="Map" bodyClassName="p-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-gold/30 text-gold/70">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M9 4 L3 6.5 v13.5 L9 17.5 L15 20 L21 17.5 V4 L15 6.5 Z M9 4 v13.5 M15 6.5 V20"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
            </svg>
          </span>

          <h1 className="font-display text-2xl uppercase tracking-wider3 text-gold-bright">
            Coming later
          </h1>

          <div className="divider-diamond w-40" />

          <p className="max-w-sm text-base leading-relaxed text-ivory-dim">
            The Map is reserved for placing quests, locations and routines in space rather than in a
            list. It is not part of version one, and nothing here is wired up yet.
          </p>

          <p className="max-w-sm text-sm leading-relaxed text-ivory-faint">
            Everything else in the menu is fully functional. This is the one screen that is
            deliberately a placeholder rather than a partial feature.
          </p>
        </div>
      </GamePanel>
    </div>
  );
}
