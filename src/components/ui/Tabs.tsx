'use client';

import { useRef, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

export interface TabItem<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
  size?: 'sm' | 'md';
}

/**
 * Roving-tabindex tab strip: one tab stop, arrow keys move between tabs, as
 * per the WAI-ARIA tabs pattern. Used for the filter rows on Quests and
 * Abilities.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  className,
  size = 'md',
}: TabsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (event: React.KeyboardEvent) => {
    const index = items.findIndex((i) => i.value === value);
    let next = index;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % items.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
      next = (index - 1 + items.length) % items.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else return;

    event.preventDefault();
    onChange(items[next].value);
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.[next]?.focus();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        // Wraps on desktop; on a phone it scrolls sideways inside itself so a
        // five-state filter never becomes two cramped rows.
        'flex items-stretch gap-px border border-gold/20',
        'max-md:overflow-x-auto max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden',
        'md:flex-wrap',
        className,
      )}
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.value)}
            className={cn(
              'flex-1 whitespace-nowrap border-b-2 transition-colors duration-200',
              // Comfortable tap target on touch, unchanged on desktop.
              'max-md:min-h-[var(--tap-min)] max-md:shrink-0 max-md:px-4',
              size === 'sm' ? 'px-2 py-1 text-2xs' : 'px-2.5 py-1.5 text-xs',
              'label-caps',
              selected
                ? 'border-teal bg-teal/10 text-teal-bright'
                : 'border-transparent text-ivory-faint hover:bg-gold/5 hover:text-ivory-dim',
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span className={cn('ml-1', selected ? 'text-teal' : 'text-ivory-faint')}>
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** A single labelled section, used where tabs would be overkill. */
export function FieldGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="label-caps mb-1.5 text-gold">{label}</div>
      {children}
    </div>
  );
}
