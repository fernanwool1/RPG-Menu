'use client';

import { SlidersHorizontal, X } from 'lucide-react';

import { GameButton } from '@/components/ui/GameButton';
import { Modal } from '@/components/ui/Modal';
import { QUEST_TYPE_LABEL } from '@/domain/quests';
import type { QuestType } from '@/domain/types';
import { cn } from '@/lib/cn';

/**
 * Mobile-only presentation for the Quests page.
 *
 * Everything here reads the same state the desktop panels read - these are
 * rearrangements, not parallel features.
 */

/* ------------------------------------------------------------------ */
/* Compact Today summary                                               */
/* ------------------------------------------------------------------ */

/**
 * The four numbers worth carrying at the top of a phone screen. The full
 * desktop Today sidebar (deadlines, daily progress, seven-day history) stays
 * on its own level rather than being crammed in here.
 */
export function MobileTodayStrip({
  open,
  dueToday,
  overdue,
  xpToday,
  onOpenToday,
}: {
  open: number;
  dueToday: number;
  overdue: number;
  xpToday: number;
  onOpenToday: () => void;
}) {
  const cells: Array<{ label: string; value: string; tone?: 'teal' | 'danger' }> = [
    { label: 'Open', value: String(open) },
    { label: 'Due today', value: String(dueToday), tone: dueToday > 0 ? 'teal' : undefined },
    { label: 'Overdue', value: String(overdue), tone: overdue > 0 ? 'danger' : undefined },
    { label: 'XP earned', value: `+${xpToday}`, tone: xpToday > 0 ? 'teal' : undefined },
  ];

  return (
    <section aria-label="Today at a glance" className="shrink-0">
      <div className="grid grid-cols-4 gap-1.5">
        {cells.map((cell) => (
          <div
            key={cell.label}
            className="rounded-[2px] border border-gold/25 bg-ink-950/40 px-1 py-2 text-center"
          >
            <div
              className={cn(
                // Deliberately NOT the display serif: its "1" reads as "I"
                // at this size, which is unacceptable for a count.
                'text-xl font-semibold tabular-nums',
                cell.tone === 'danger'
                  ? 'text-danger'
                  : cell.tone === 'teal'
                    ? 'text-teal'
                    : 'text-ivory',
              )}
            >
              {cell.value}
            </div>
            <div className="mt-0.5 truncate text-[0.8125rem] leading-tight text-ivory-faint">
              {cell.label}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onOpenToday}
        className="tap-target mt-1.5 w-full rounded-[2px] border border-gold/25 px-3 text-sm text-ivory-dim transition-colors duration-200"
      >
        Daily progress, streak and deadlines
      </button>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Filters                                                             */
/* ------------------------------------------------------------------ */

export interface QuestFilterState {
  type: QuestType | 'all';
  category: string;
}

/** Active filters as a horizontally scrollable, individually clearable row. */
export function ActiveFilterChips({
  filters,
  onClearType,
  onClearCategory,
  onOpenFilters,
  resultCount,
}: {
  filters: QuestFilterState;
  onClearType: () => void;
  onClearCategory: () => void;
  onOpenFilters: () => void;
  resultCount: number;
}) {
  const chips: Array<{ key: string; label: string; onClear: () => void }> = [];
  if (filters.type !== 'all') {
    chips.push({
      key: 'type',
      label: QUEST_TYPE_LABEL[filters.type],
      onClear: onClearType,
    });
  }
  if (filters.category !== 'all') {
    chips.push({ key: 'category', label: filters.category, onClear: onClearCategory });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onOpenFilters}
        className={cn(
          'tap-target inline-flex shrink-0 items-center gap-1.5 rounded-[2px] border px-3 text-sm transition-colors duration-200',
          chips.length > 0
            ? 'border-teal/55 bg-teal/[0.08] text-teal-bright'
            : 'border-gold/30 text-ivory-dim',
        )}
      >
        <SlidersHorizontal aria-hidden className="h-4 w-4" strokeWidth={1.5} />
        Filters
        {chips.length > 0 && <span className="tabular-nums">({chips.length})</span>}
      </button>

      {chips.length === 0 ? (
        <span className="min-w-0 flex-1 truncate text-right text-sm text-ivory-faint">
          {resultCount} {resultCount === 1 ? 'quest' : 'quests'}
        </span>
      ) : (
        <div className="rail min-w-0 flex-1">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onClear}
              aria-label={`Clear filter: ${chip.label}`}
              className="tap-target inline-flex items-center gap-1.5 rounded-full border border-teal/50 bg-teal/[0.08] px-3 text-sm text-teal-bright"
            >
              <span className="max-w-[9rem] truncate">{chip.label}</span>
              <X aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** The advanced filters, as a bottom sheet rather than a cramped select row. */
export function QuestFiltersSheet({
  open,
  filters,
  categories,
  resultCount,
  onChange,
  onReset,
  onClose,
}: {
  open: boolean;
  filters: QuestFilterState;
  categories: string[];
  resultCount: number;
  onChange: (next: Partial<QuestFilterState>) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Filters"
      description={`${resultCount} ${resultCount === 1 ? 'quest matches' : 'quests match'} right now.`}
      size="sm"
      footer={
        <>
          <GameButton variant="ghost" onClick={onReset}>
            Clear all
          </GameButton>
          <GameButton variant="primary" onClick={onClose}>
            Show results
          </GameButton>
        </>
      }
    >
      <div className="space-y-5">
        <fieldset>
          <legend className="field-label">Type</legend>
          <div className="flex flex-wrap gap-2">
            <FilterChip
              label="All types"
              active={filters.type === 'all'}
              onClick={() => onChange({ type: 'all' })}
            />
            {(Object.keys(QUEST_TYPE_LABEL) as QuestType[]).map((type) => (
              <FilterChip
                key={type}
                label={QUEST_TYPE_LABEL[type]}
                active={filters.type === type}
                onClick={() => onChange({ type })}
              />
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="field-label">Category</legend>
          <div className="flex flex-wrap gap-2">
            <FilterChip
              label="All categories"
              active={filters.category === 'all'}
              onClick={() => onChange({ category: 'all' })}
            />
            {categories.map((category) => (
              <FilterChip
                key={category}
                label={category}
                active={filters.category === category}
                onClick={() => onChange({ category })}
              />
            ))}
          </div>
        </fieldset>
      </div>
    </Modal>
  );
}

export function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'tap-target inline-flex items-center rounded-full border px-3.5 text-sm transition-colors duration-200',
        active
          ? 'border-teal/60 bg-teal/10 text-teal-bright'
          : 'border-gold/30 text-ivory-dim',
      )}
    >
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Floating action button                                              */
/* ------------------------------------------------------------------ */

/**
 * Sits above the bottom tab bar, clear of the safe area. Labelled rather than
 * icon-only so its purpose does not depend on recognising a glyph.
 */
export function MobileFab({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'fixed right-4 z-20 inline-flex items-center gap-2 rounded-full border border-teal/60',
        'bg-ink-900/95 px-5 py-3.5 text-base uppercase tracking-wider2 text-teal-bright',
        'shadow-glow backdrop-blur-[3px] transition-colors duration-200',
      )}
      style={{
        bottom: 'calc(var(--mobile-bottomnav-h) + var(--safe-bottom) + 0.875rem)',
      }}
    >
      {label}
    </button>
  );
}
