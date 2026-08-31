'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Landmark } from 'lucide-react';

import { GameIcon } from '@/components/ui/GameIcon';
import { useCharacterProgress } from '@/store/selectors';
import { useAppStore } from '@/store/useAppStore';
import { ICON_CYAN, ICON_GOLD, navigationIcons } from '@/lib/gameIcons';
import { cn } from '@/lib/cn';

/**
 * The mobile application shell: a compact fixed top bar and a fixed bottom
 * tab bar, both padded out of the device safe areas.
 *
 * These replace the desktop header below 768px. They read the same store the
 * desktop header reads - there is no second source of truth, only a second
 * arrangement.
 */

/** The same registry entries the desktop header uses. */
const TABS = [
  { href: '/abilities', label: 'Abilities', icon: navigationIcons.abilities },
  { href: '/skills', label: 'Skills', icon: navigationIcons.skills },
  { href: '/inventory', label: 'Inventory', icon: navigationIcons.inventory },
  { href: '/map', label: 'Map', icon: navigationIcons.map },
  { href: '/quests', label: 'Quests', icon: navigationIcons.quests },
] as const;

export function MobileTopBar() {
  const semester = useAppStore((s) => s.profile.semesterLabel);
  const progress = useCharacterProgress();
  const pathname = usePathname();
  const onCharacter = pathname === '/character';

  return (
    <header
      className="fixed inset-x-0 top-0 z-30 border-b border-gold/25 bg-ink-950 backdrop-blur-[3px]"
      style={{ paddingTop: 'var(--safe-top)' }}
    >
      <div
        className="flex items-center gap-2 px-3"
        style={{ height: 'var(--mobile-topbar-h)' }}
      >
        <Landmark aria-hidden className="h-5 w-5 shrink-0 text-gold" strokeWidth={1.2} />

        <span className="min-w-0 flex-1 truncate font-display text-base uppercase tracking-wider2 text-ivory">
          {semester}
        </span>

        <Link
          href="/character"
          className="tap-target inline-flex shrink-0 items-center rounded-[2px] px-2 font-display text-base uppercase tracking-wider2 text-ivory transition-colors duration-200"
          title={`${progress.rank} — ${progress.lifetimeXp.toLocaleString()} lifetime XP`}
        >
          Lv {progress.level}
        </Link>

        <Link
          href="/character"
          aria-current={onCharacter ? 'page' : undefined}
          className={cn(
            'tap-target inline-flex shrink-0 items-center justify-center rounded-full border transition-colors duration-200',
            onCharacter ? 'border-teal' : 'border-gold/60',
          )}
        >
          <GameIcon
            src={navigationIcons.character}
            size={24}
            color={onCharacter ? ICON_CYAN : ICON_GOLD}
            label="Character sheet"
          />
        </Link>
      </div>
    </header>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-gold/25 bg-ink-950 backdrop-blur-[3px]"
      style={{ paddingBottom: 'var(--safe-bottom)' }}
    >
      <ul className="flex items-stretch" style={{ height: 'var(--mobile-bottomnav-h)' }}>
        {TABS.map((tab) => {
          const active = pathname === tab.href;

          return (
            <li key={tab.href} className="min-w-0 flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'tap-target relative flex h-full w-full flex-col items-center justify-center gap-1 px-1',
                  'transition-colors duration-200',
                  active ? 'text-teal-bright' : 'text-[var(--icon-gold)]',
                )}
              >
                {/* The active marker is a shape, not only a colour. */}
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-x-3 top-0 h-[2px] bg-teal shadow-glow"
                  />
                )}
                <GameIcon src={tab.icon} size={26} color={active ? ICON_CYAN : ICON_GOLD} />
                {/* Sentence case without tracking: "Inventory" needs 105px
                    uppercase-and-tracked but only 62px like this, which fits
                    a fifth of a 360px screen with room to spare. */}
                <span className="w-full truncate text-center text-[0.875rem] leading-none">
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
