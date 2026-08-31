'use client';

import { useEffect, useMemo, useState } from 'react';

import { Field } from '@/components/inventory/ItemEditor';
import { GameButton } from '@/components/ui/GameButton';
import { Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import {
  ACTIVITY_FORMULA_LABEL,
  ACTIVITY_LABEL,
  ACTIVITY_UNIT,
  dailyCheckXp,
} from '@/domain/daily';
import type { DailyCheckActivity } from '@/domain/types';
import {
  useInstruments,
  usePhysicalNodes,
  useReadingNodes,
} from '@/store/dailySelectors';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/cn';

/**
 * Records one Daily Check submission.
 *
 * Submissions accumulate across the day rather than replacing each other, and
 * the XP is previewed live so the conversion is never a surprise. Saving
 * writes exactly one immutable transaction.
 */

const TABS: Array<{ value: DailyCheckActivity; label: string }> = [
  { value: 'reading', label: 'Reading' },
  { value: 'calories', label: 'Calories' },
  { value: 'instrument', label: 'Instrument' },
];

export function AddProgressDialog({
  open,
  initialActivity,
  onClose,
}: {
  open: boolean;
  initialActivity?: DailyCheckActivity;
  onClose: () => void;
}) {
  const addEntry = useAppStore((s) => s.addDailyCheckEntry);
  const addInstrument = useAppStore((s) => s.addInstrument);
  const targets = useAppStore((s) => s.dailyTargets);
  const setTargets = useAppStore((s) => s.setDailyTargets);

  const instruments = useInstruments();
  const readingNodes = useReadingNodes();
  const physicalNodes = usePhysicalNodes();

  const [activity, setActivity] = useState<DailyCheckActivity>('reading');
  const [amount, setAmount] = useState('');
  const [nodeId, setNodeId] = useState('');
  const [newInstrument, setNewInstrument] = useState('');
  const [showAddInstrument, setShowAddInstrument] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<string | null>(null);

  const nodeOptions = useMemo(() => {
    if (activity === 'reading') return readingNodes;
    if (activity === 'calories') return physicalNodes;
    return instruments;
  }, [activity, readingNodes, physicalNodes, instruments]);

  // Reopen on the tab the user came from, and remember their last node choice.
  useEffect(() => {
    if (!open) return;
    setActivity(initialActivity ?? 'reading');
    setAmount('');
    setError('');
    setResult(null);
    setNewInstrument('');
    setShowAddInstrument(false);
  }, [open, initialActivity]);

  useEffect(() => {
    const remembered =
      activity === 'reading'
        ? targets.defaultReadingNodeId
        : activity === 'calories'
          ? targets.defaultCaloriesNodeId
          : targets.defaultInstrumentNodeId;

    setNodeId((current) => {
      if (current && nodeOptions.some((n) => n.id === current)) return current;
      if (remembered && nodeOptions.some((n) => n.id === remembered)) return remembered;
      return nodeOptions[0]?.id ?? '';
    });
    // Reset when the tab changes, not on every options identity change.
  }, [activity, nodeOptions, targets]);

  const numeric = amount === '' ? 0 : Number(amount);
  const previewXp = dailyCheckXp(activity, numeric);

  const submit = () => {
    const chosen = nodeOptions.find((n) => n.id === nodeId);
    if (!chosen) {
      setError('Choose the skill node this should count toward.');
      return;
    }

    const outcome = addEntry({
      activity,
      amount: numeric,
      skillNodeId: chosen.id,
      instrumentName: activity === 'instrument' ? chosen.name : undefined,
    });

    if (!outcome.ok) {
      setError(outcome.error);
      setResult(null);
      return;
    }

    // Remember the node so tomorrow's entry starts where today's left off.
    setTargets(
      activity === 'reading'
        ? { defaultReadingNodeId: chosen.id }
        : activity === 'calories'
          ? { defaultCaloriesNodeId: chosen.id }
          : { defaultInstrumentNodeId: chosen.id },
    );

    setError('');
    setResult(`Added ${Math.floor(numeric)} ${ACTIVITY_UNIT[activity]} · +${outcome.xp} XP to ${chosen.name}.`);
    setAmount('');
  };

  const createInstrument = () => {
    const created = addInstrument(newInstrument);
    if (!created) {
      setError('Give the instrument a name.');
      return;
    }
    setNodeId(created);
    setNewInstrument('');
    setShowAddInstrument(false);
    setError('');
  };

  const targetForActivity =
    activity === 'reading'
      ? targets.readingPages
      : activity === 'calories'
        ? targets.calories
        : targets.instrumentMinutes;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add progress"
      description="Each submission is added to today's total, never swapped for it. One entry, one XP transaction."
      size="md"
      footer={
        <>
          <GameButton variant="ghost" onClick={onClose}>
            Done
          </GameButton>
          <GameButton variant="primary" onClick={submit}>
            Save entry
          </GameButton>
        </>
      }
    >
      <Tabs
        items={TABS}
        value={activity}
        onChange={(next) => {
          setActivity(next);
          setAmount('');
          setError('');
          setResult(null);
        }}
        label="Which tracker"
        className="mb-4"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={`${ACTIVITY_LABEL[activity]} (${ACTIVITY_UNIT[activity]})`}
          hint={`${ACTIVITY_FORMULA_LABEL[activity]} · today's target is ${targetForActivity}`}
        >
          <input
            className="field"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            autoFocus
            value={amount}
            aria-invalid={Boolean(error)}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            }}
          />
        </Field>

        <Field
          label={activity === 'instrument' ? 'Instrument' : 'Skill node'}
          hint={
            activity === 'calories'
              ? 'Physical Development'
              : activity === 'instrument'
                ? 'Music › Performance'
                : 'Whichever knowledge or language node these pages feed'
          }
        >
          <select className="field" value={nodeId} onChange={(e) => setNodeId(e.target.value)}>
            {nodeOptions.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {activity === 'instrument' && (
        <div className="mt-3">
          {showAddInstrument ? (
            <div className="flex flex-wrap items-end gap-2">
              <Field label="New instrument" className="flex-1">
                <input
                  className="field"
                  value={newInstrument}
                  placeholder="Charango"
                  onChange={(e) => setNewInstrument(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      createInstrument();
                    }
                  }}
                />
              </Field>
              <GameButton variant="primary" onClick={createInstrument}>
                Add
              </GameButton>
              <GameButton variant="ghost" onClick={() => setShowAddInstrument(false)}>
                Cancel
              </GameButton>
            </div>
          ) : (
            <GameButton variant="ghost" size="sm" onClick={() => setShowAddInstrument(true)}>
              + Add an instrument
            </GameButton>
          )}
          <p className="mt-1.5 text-xs text-ivory-faint">
            New instruments become real skill nodes under Music › Performance, so they level like
            everything else.
          </p>
        </div>
      )}

      <div
        className={cn(
          'mt-4 rounded-[2px] border p-3.5 transition-colors duration-200',
          previewXp > 0 ? 'border-teal/45 bg-teal/[0.06]' : 'border-gold/25 bg-ink-950/40',
        )}
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="label-caps text-gold">Award</span>
          <span
            className={cn(
              'font-display text-2xl',
              previewXp > 0 ? 'text-teal-bright' : 'text-ivory-faint',
            )}
          >
            {previewXp > 0 ? `+${previewXp} XP` : 'No XP yet'}
          </span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-ivory-faint">
          {activity === 'calories' && numeric > 0
            ? `${Math.floor(numeric)} calories at 1 XP per 10 — ${Math.floor(numeric) % 10} short of the next point.`
            : ACTIVITY_FORMULA_LABEL[activity]}
        </p>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
      {result && (
        <p role="status" className="mt-2 text-sm text-teal">
          {result}
        </p>
      )}
    </Modal>
  );
}
