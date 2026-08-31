'use client';

import { useState } from 'react';

import { GameButton } from '@/components/ui/GameButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ACTIVITY_LABEL, ACTIVITY_UNIT, dailyCheckXp } from '@/domain/daily';
import type { DailyCheck, Id } from '@/domain/types';
import { useAppStore } from '@/store/useAppStore';

/**
 * Today's Daily Check log, with corrections.
 *
 * Every submission is listed, superseded rows included, because that is what
 * makes the day auditable. Correcting an entry appends a revised row and a
 * delta transaction; it never rewrites what was already recorded.
 */
export function TodayLogDialog({
  open,
  check,
  onClose,
  /** Opens on the correction form for this entry. */
  initialEditEntryId,
}: {
  open: boolean;
  check: DailyCheck | null;
  onClose: () => void;
  initialEditEntryId?: Id | null;
}) {
  const correct = useAppStore((s) => s.correctDailyCheckEntry);
  const nodes = useAppStore((s) => s.nodes);

  const [editingId, setEditingId] = useState<Id | null>(initialEditEntryId ?? null);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const nodeName = (id: Id) => nodes.find((n) => n.id === id)?.name ?? 'Unknown node';

  const entries = check ? [...check.entries].reverse() : [];

  const startEdit = (entryId: Id, current: number) => {
    setEditingId(entryId);
    setValue(String(current));
    setError('');
  };

  const submitEdit = (entryId: Id) => {
    const result = correct(entryId, Number(value));
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditingId(null);
    setError('');
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Today's log"
      description="Entries are immutable. Correcting one appends a revision and a balancing XP transaction rather than editing history."
      size="md"
      footer={
        <GameButton variant="ghost" onClick={onClose}>
          Close
        </GameButton>
      }
    >
      {entries.length === 0 ? (
        <EmptyState
          compact
          icon="calendar"
          title="Nothing logged yet"
          body="Add some progress and it will appear here."
        />
      ) : (
        <ul className="divide-y divide-gold/10">
          {entries.map((entry) => {
            const superseded = Boolean(entry.correctedByEntryId);
            const isEditing = editingId === entry.id;

            return (
              <li key={entry.id} className="py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="flex items-baseline gap-2">
                    <span className="text-base text-ivory">{ACTIVITY_LABEL[entry.activity]}</span>
                    {entry.correctsEntryId && (
                      <StatusBadge bare tone="ready">
                        Correction
                      </StatusBadge>
                    )}
                    {superseded && (
                      <StatusBadge bare tone="locked">
                        Superseded
                      </StatusBadge>
                    )}
                  </span>

                  <span
                    className={
                      superseded ? 'text-sm text-ivory-faint line-through' : 'text-sm text-teal'
                    }
                  >
                    +{entry.xpAwarded} XP
                  </span>
                </div>

                <p className="mt-0.5 text-xs text-ivory-faint">
                  {entry.amount} {ACTIVITY_UNIT[entry.activity]} ·{' '}
                  {entry.instrumentName ?? nodeName(entry.skillNodeId)} ·{' '}
                  {new Date(entry.occurredAt).toLocaleTimeString(undefined, {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>

                {isEditing ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      className="field w-32"
                      type="number"
                      min={1}
                      step={1}
                      autoFocus
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          submitEdit(entry.id);
                        }
                      }}
                      aria-label={`Corrected ${ACTIVITY_UNIT[entry.activity]}`}
                    />
                    <span className="text-xs text-ivory-faint">
                      → {dailyCheckXp(entry.activity, Number(value) || 0)} XP
                    </span>
                    <GameButton variant="primary" size="sm" onClick={() => submitEdit(entry.id)}>
                      Save correction
                    </GameButton>
                    <GameButton variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                      Cancel
                    </GameButton>
                  </div>
                ) : (
                  !superseded && (
                    <GameButton
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={() => startEdit(entry.id, entry.amount)}
                    >
                      Correct this entry
                    </GameButton>
                  )
                )}

                {isEditing && error && (
                  <p role="alert" className="mt-1 text-xs text-danger">
                    {error}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
