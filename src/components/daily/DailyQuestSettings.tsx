'use client';

import { useState } from 'react';
import { Pin } from 'lucide-react';

import { Field } from '@/components/inventory/ItemEditor';
import { EmptyState } from '@/components/ui/EmptyState';
import { GameButton } from '@/components/ui/GameButton';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Tabs } from '@/components/ui/Tabs';
import {
  CATEGORY_LABEL,
  MAX_PINNED,
  WEEKDAY_LABEL,
  isEligibleOn,
} from '@/domain/daily';
import type { DailyQuestCategory, DailyQuestDefinition, DayKey, Id, Weekday } from '@/domain/types';
import { useAppStore } from '@/store/useAppStore';
import { iconFor } from '@/lib/icons';
import { cn } from '@/lib/cn';

/**
 * Everything that shapes the rotation: which quests are in play, which are
 * pinned, which weekdays they run on, and what each is worth. Also the Daily
 * Check targets, since they belong to the same daily settings.
 */

const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

type Tab = 'quests' | 'targets';

export function DailyQuestSettings({
  open,
  today,
  onClose,
}: {
  open: boolean;
  today: DayKey;
  onClose: () => void;
}) {
  const definitions = useAppStore((s) => s.dailyDefinitions);
  const setPinned = useAppStore((s) => s.setDailyQuestPinned);
  const update = useAppStore((s) => s.updateDailyQuestDefinition);
  const targets = useAppStore((s) => s.dailyTargets);
  const setTargets = useAppStore((s) => s.setDailyTargets);

  const [tab, setTab] = useState<Tab>('quests');
  const [categoryFilter, setCategoryFilter] = useState<DailyQuestCategory | 'all'>('all');
  const [error, setError] = useState('');

  const pinnedCount = definitions.filter((d) => d.pinned).length;
  const activeCount = definitions.filter((d) => d.active).length;

  const categories = [...new Set(definitions.map((d) => d.category))].sort();
  const visible = definitions
    .filter((d) => categoryFilter === 'all' || d.category === categoryFilter)
    .sort((a, b) => a.order - b.order);

  const togglePin = (definition: DailyQuestDefinition) => {
    const result = setPinned(definition.id, !definition.pinned);
    setError(result.ok ? '' : result.error);
  };

  const toggleWeekday = (definition: DailyQuestDefinition, day: Weekday) => {
    const next = definition.weekdays.includes(day)
      ? definition.weekdays.filter((w) => w !== day)
      : [...definition.weekdays, day].sort();
    update(definition.id, { weekdays: next });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Daily Quest settings"
      description={`${activeCount} of ${definitions.length} quests active · ${pinnedCount} of ${MAX_PINNED} pinned. Changes apply from tomorrow's roll unless you replace a slot today.`}
      size="lg"
      footer={
        <GameButton variant="ghost" onClick={onClose}>
          Close
        </GameButton>
      }
    >
      <Tabs
        items={[
          { value: 'quests', label: 'Rotating quests' },
          { value: 'targets', label: 'Daily Check targets' },
        ]}
        value={tab}
        onChange={setTab}
        label="Settings section"
        className="mb-4"
      />

      {tab === 'targets' ? (
        <TargetSettings targets={targets} onChange={setTargets} />
      ) : (
        <>
          <div className="mb-3">
            <label>
              <span className="field-label">Filter by category</span>
              <select
                className="field"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as DailyQuestCategory | 'all')}
              >
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error && (
            <p role="alert" className="mb-2 text-sm text-danger">
              {error}
            </p>
          )}

          {visible.length === 0 ? (
            <EmptyState compact icon="search" title="Nothing in that category" />
          ) : (
            <ul className="divide-y divide-gold/10">
              {visible.map((definition) => (
                <QuestSettingRow
                  key={definition.id}
                  definition={definition}
                  today={today}
                  onToggleActive={() => update(definition.id, { active: !definition.active })}
                  onTogglePin={() => togglePin(definition)}
                  onToggleWeekday={(day) => toggleWeekday(definition, day)}
                  onXpChange={(xp) => update(definition.id, { characterXp: xp })}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </Modal>
  );
}

function QuestSettingRow({
  definition,
  today,
  onToggleActive,
  onTogglePin,
  onToggleWeekday,
  onXpChange,
}: {
  definition: DailyQuestDefinition;
  today: DayKey;
  onToggleActive: () => void;
  onTogglePin: () => void;
  onToggleWeekday: (day: Weekday) => void;
  onXpChange: (xp: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = iconFor(definition.icon);
  const eligibleToday = isEligibleOn(definition, today);

  return (
    <li className={cn('py-3', !definition.active && 'opacity-60')}>
      <div className="flex flex-wrap items-start gap-3">
        <Icon aria-hidden className="mt-1 h-[1.15rem] w-[1.15rem] shrink-0 text-gold" strokeWidth={1.4} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="text-base text-ivory">{definition.name}</span>
            <StatusBadge bare tone="progress">
              {CATEGORY_LABEL[definition.category]}
            </StatusBadge>
            {definition.pinned && (
              <span className="inline-flex items-center gap-1 text-xs text-teal">
                <Pin aria-hidden className="h-3.5 w-3.5" strokeWidth={1.6} />
                Pinned
              </span>
            )}
            {!definition.active && (
              <StatusBadge bare tone="locked">
                Inactive
              </StatusBadge>
            )}
            {definition.active && !eligibleToday && (
              <StatusBadge bare tone="locked">
                Not scheduled today
              </StatusBadge>
            )}
          </div>

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="mt-1 text-xs text-ivory-faint underline decoration-gold/40 underline-offset-2 transition-colors duration-200 hover:text-ivory-dim"
          >
            {expanded ? 'Hide schedule and XP' : 'Schedule and XP'}
          </button>
        </div>

        <div className="flex shrink-0 gap-1.5">
          <GameButton variant="ghost" size="sm" onClick={onTogglePin}>
            {definition.pinned ? 'Unpin' : 'Pin'}
          </GameButton>
          <GameButton variant="ghost" size="sm" onClick={onToggleActive}>
            {definition.active ? 'Deactivate' : 'Activate'}
          </GameButton>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 grid gap-3 rounded-[2px] border border-gold/20 bg-ink-950/40 p-3 sm:grid-cols-2">
          <div>
            <span className="field-label">Appears on</span>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((day) => {
                const on = definition.weekdays.length === 0 || definition.weekdays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={definition.weekdays.includes(day)}
                    onClick={() => onToggleWeekday(day)}
                    className={cn(
                      'rounded-[2px] border px-2 py-1 text-xs transition-colors duration-200',
                      definition.weekdays.includes(day)
                        ? 'border-teal/60 bg-teal/10 text-teal-bright'
                        : on
                          ? 'border-gold/30 text-ivory-dim hover:border-gold/60'
                          : 'border-transparent text-ivory-faint hover:border-gold/40',
                    )}
                  >
                    {WEEKDAY_LABEL[day]}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-ivory-faint">
              {definition.weekdays.length === 0
                ? 'No days selected means every day.'
                : `Only ${definition.weekdays.map((d) => WEEKDAY_LABEL[d]).join(', ')}.`}
            </p>
          </div>

          <Field label="Character XP" hint="What completing this quest is worth.">
            <input
              className="field"
              type="number"
              min={0}
              step={5}
              value={definition.characterXp}
              onChange={(e) => onXpChange(Math.max(0, Number(e.target.value) || 0))}
            />
          </Field>
        </div>
      )}
    </li>
  );
}

function TargetSettings({
  targets,
  onChange,
}: {
  targets: { readingPages: number; calories: number; instrumentMinutes: number };
  onChange: (patch: { readingPages?: number; calories?: number; instrumentMinutes?: number }) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Field label="Reading target" hint="pages per day">
        <input
          className="field"
          type="number"
          min={0}
          step={1}
          value={targets.readingPages}
          onChange={(e) => onChange({ readingPages: Math.max(0, Number(e.target.value) || 0) })}
        />
      </Field>

      <Field label="Calorie target" hint="calories burned per day">
        <input
          className="field"
          type="number"
          min={0}
          step={10}
          value={targets.calories}
          onChange={(e) => onChange({ calories: Math.max(0, Number(e.target.value) || 0) })}
        />
      </Field>

      <Field label="Practice target" hint="instrument minutes per day">
        <input
          className="field"
          type="number"
          min={0}
          step={5}
          value={targets.instrumentMinutes}
          onChange={(e) => onChange({ instrumentMinutes: Math.max(0, Number(e.target.value) || 0) })}
        />
      </Field>

      <p className="sm:col-span-3 text-xs leading-relaxed text-ivory-faint">
        Targets shape the progress readouts only. XP comes from the formulas — 1 XP per page, 1 XP
        per 10 calories, 1 XP per minute — so raising a target never changes what an entry pays.
      </p>
    </div>
  );
}

/** Picks a replacement for one incomplete slot. */
export function ReplaceQuestDialog({
  open,
  instanceId,
  options,
  onClose,
}: {
  open: boolean;
  instanceId: Id | null;
  options: DailyQuestDefinition[];
  onClose: () => void;
}) {
  const replace = useAppStore((s) => s.replaceDailyQuest);
  const [error, setError] = useState('');

  const choose = (definitionId?: Id) => {
    if (!instanceId) return;
    const result = replace(instanceId, definitionId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError('');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Replace this Daily Quest"
      description="Only an unfinished quest can be swapped. Completed quests stay put."
      size="md"
      footer={
        <>
          <GameButton variant="ghost" onClick={onClose}>
            Cancel
          </GameButton>
          <GameButton variant="primary" onClick={() => choose()}>
            Pick one for me
          </GameButton>
        </>
      }
    >
      {error && (
        <p role="alert" className="mb-2 text-sm text-danger">
          {error}
        </p>
      )}

      {options.length === 0 ? (
        <EmptyState
          compact
          icon="search"
          title="Nothing else is available today"
          body="Every other quest is either inactive, already on today's board, or not scheduled for today."
        />
      ) : (
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {options.map((definition) => {
            const Icon = iconFor(definition.icon);
            return (
              <li key={definition.id}>
                <button
                  type="button"
                  onClick={() => choose(definition.id)}
                  className="flex h-full w-full items-start gap-2.5 rounded-[2px] border border-gold/25 px-3 py-2.5 text-left transition-colors duration-200 hover:border-gold/60 hover:bg-gold/5"
                >
                  <Icon aria-hidden className="mt-0.5 h-[1.15rem] w-[1.15rem] shrink-0 text-gold" strokeWidth={1.4} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-base leading-tight text-ivory">{definition.name}</span>
                    <span className="mt-0.5 block text-xs text-ivory-faint">
                      {CATEGORY_LABEL[definition.category]} · {definition.characterXp} XP
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
