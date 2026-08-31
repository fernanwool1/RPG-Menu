'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Landmark } from 'lucide-react';

import { GameIcon } from '@/components/ui/GameIcon';
import { ICON_CYAN, ICON_GOLD, navigationIcons } from '@/lib/gameIcons';

import { useCharacterProgress } from '@/store/selectors';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/cn';

const NAV_ITEMS = [
  { href: '/abilities', label: 'Abilities', icon: navigationIcons.abilities },
  { href: '/skills', label: 'Skills', icon: navigationIcons.skills },
  { href: '/inventory', label: 'Inventory', icon: navigationIcons.inventory },
  { href: '/map', label: 'Map', icon: navigationIcons.map },
  { href: '/quests', label: 'Quests', icon: navigationIcons.quests },
] as const;

/** The teal underline + diamond that marks the live route in the references. */
function ActiveMarker() {
  return (
    <span aria-hidden className="pointer-events-none absolute -bottom-[9px] left-0 right-0 flex justify-center">
      <span className="relative block h-px w-full bg-gradient-to-r from-transparent via-teal to-transparent shadow-glow">
        <span className="absolute left-1/2 top-1/2 h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rotate-45 bg-teal" />
      </span>
    </span>
  );
}

export function TopNavigation() {
  const pathname = usePathname();
  const semester = useAppStore((s) => s.profile.semesterLabel);
  const progress = useCharacterProgress();

  const onCharacter = pathname === '/character';

  return (
    <header className="relative z-20 shrink-0 border-b border-gold/25 bg-ink-950/45 backdrop-blur-[3px]">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
        {/* Left: semester */}
        <div className="flex shrink-0 items-center gap-2.5">
          <Landmark aria-hidden className="h-5 w-5 text-gold" strokeWidth={1.2} />
          <span className="font-display text-base uppercase tracking-wider3 text-ivory">
            {semester}
          </span>
        </div>

        {/* Centre: routes. Scrolls horizontally rather than wrapping on narrow screens. */}
        <nav
          aria-label="Main"
          className="flex min-w-0 flex-1 justify-center overflow-x-auto scroll-thin"
        >
          <ul className="flex items-center gap-4 px-2 sm:gap-6 lg:gap-9">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href} className="relative shrink-0">
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group relative flex items-center gap-2 whitespace-nowrap py-1',
                      'font-display text-base uppercase tracking-wider3',
                      'transition-colors duration-200',
                      active ? 'text-teal-bright' : 'text-gold hover:text-gold-bright',
                    )}
                  >
                    {/* Decorative: the label beside it already names the route.
                        24px keeps the header at its approved height. */}
                    <GameIcon
                      src={item.icon}
                      size={24}
                      color={active ? ICON_CYAN : ICON_GOLD}
                      className="transition-[background-color] duration-200 group-hover:!bg-[var(--icon-gold-bright)] group-focus-visible:!bg-[var(--icon-gold-bright)]"
                    />
                    {item.label}
                    {active && <ActiveMarker />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Right: level + character */}
        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          <Link
            href="/character"
            className="hidden font-display text-base uppercase tracking-wider3 text-ivory transition-colors duration-200 hover:text-gold-bright sm:block"
            title={`${progress.rank} — ${progress.lifetimeXp.toLocaleString()} lifetime XP`}
          >
            Level {progress.level}
          </Link>

          <div className="relative">
            <Link
              href="/character"
              aria-current={onCharacter ? 'page' : undefined}
              title="Character"
              className={cn(
                'inline-flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-200',
                onCharacter
                  ? 'border-teal shadow-glow'
                  : 'border-gold/60 hover:border-gold',
              )}
            >
              <GameIcon
                src={navigationIcons.character}
                size={22}
                color={onCharacter ? ICON_CYAN : ICON_GOLD}
                label="Character sheet"
              />
            </Link>

            {/* On Character none of the five text routes is active - the
                profile icon carries the state instead. */}
            {onCharacter && (
              <span className="pointer-events-none absolute -bottom-4 left-1/2 hidden -translate-x-1/2 whitespace-nowrap text-2xs uppercase tracking-wider2 text-teal sm:block">
                Character
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
