'use client';

import { useState } from 'react';
import { z } from 'zod';

import { Field } from '@/components/inventory/ItemEditor';
import { GameButton } from '@/components/ui/GameButton';
import { Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import type { AbilityEvidenceKind, Id } from '@/domain/types';
import { useAppStore } from '@/store/useAppStore';

/**
 * Attach existing evidence to an ability.
 *
 * Evidence is a claim about work already done - an item you own, a link, a
 * file you have, a quest you finished, or a written note. Attaching enough of
 * it satisfies proof, which is the second half of unlocking an ability.
 */

const KIND_TABS: Array<{ value: AbilityEvidenceKind; label: string }> = [
  { value: 'quest', label: 'Quest' },
  { value: 'inventory-item', label: 'Item' },
  { value: 'url', label: 'Link' },
  { value: 'file', label: 'File' },
  { value: 'note', label: 'Note' },
];

const urlSchema = z.string().trim().url('Enter a full URL, including https://');
const labelSchema = z.string().trim().min(1, 'Describe the evidence.').max(160);

export function EvidenceDialog({
  open,
  abilityId,
  onClose,
}: {
  open: boolean;
  abilityId: Id | null;
  onClose: () => void;
}) {
  const attachEvidence = useAppStore((s) => s.attachEvidence);
  const quests = useAppStore((s) => s.quests);
  const items = useAppStore((s) => s.items);

  const [kind, setKind] = useState<AbilityEvidenceKind>('quest');
  const [label, setLabel] = useState('');
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');

  const completedQuests = quests.filter((q) => q.status === 'completed');
  const liveItems = items.filter((i) => !i.archived);

  const reset = () => {
    setLabel('');
    setReference('');
    setError('');
  };

  const attach = (payload: { label: string; reference?: string; refId?: Id }) => {
    if (!abilityId) return;
    attachEvidence(abilityId, { kind, ...payload });
    reset();
    onClose();
  };

  const submitFreeform = () => {
    const parsedLabel = labelSchema.safeParse(label);
    if (!parsedLabel.success) {
      setError(parsedLabel.error.issues[0].message);
      return;
    }

    if (kind === 'url') {
      const parsedUrl = urlSchema.safeParse(reference);
      if (!parsedUrl.success) {
        setError(parsedUrl.error.issues[0].message);
        return;
      }
      attach({ label: parsedLabel.data, reference: parsedUrl.data });
      return;
    }

    if (kind === 'file') {
      if (!reference.trim()) {
        setError('Name the file so you can find it again.');
        return;
      }
      // Filename only. The file itself is never read or stored.
      attach({ label: parsedLabel.data, reference: reference.trim() });
      return;
    }

    attach({ label: parsedLabel.data });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Attach existing evidence"
      description="Point at work you have already done. Enough evidence satisfies the proof requirement without running a proof quest."
      size="md"
      footer={
        <GameButton variant="ghost" onClick={onClose}>
          Close
        </GameButton>
      }
    >
      <Tabs
        items={KIND_TABS}
        value={kind}
        onChange={(next) => {
          setKind(next);
          reset();
        }}
        label="Evidence type"
        className="mb-3"
      />

      {kind === 'quest' &&
        (completedQuests.length === 0 ? (
          <p className="py-6 text-center text-base text-ivory-faint">
            No completed quests yet. Finish one and it becomes attachable here.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {completedQuests.map((quest) => (
              <li key={quest.id}>
                <button
                  type="button"
                  onClick={() => attach({ label: quest.title, refId: quest.id })}
                  className="w-full rounded-[2px] border border-gold/25 px-3 py-2 text-left transition-colors duration-200 hover:border-gold/60 hover:bg-gold/5"
                >
                  <span className="block text-base text-ivory">{quest.title}</span>
                  <span className="block text-xs text-ivory-faint">
                    {quest.category} · completed{' '}
                    {quest.completedAt ? new Date(quest.completedAt).toLocaleDateString() : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ))}

      {kind === 'inventory-item' &&
        (liveItems.length === 0 ? (
          <p className="py-6 text-center text-base text-ivory-faint">
            Nothing in your inventory yet.
          </p>
        ) : (
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {liveItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => attach({ label: item.name, refId: item.id })}
                  className="w-full rounded-[2px] border border-gold/25 px-3 py-2 text-left transition-colors duration-200 hover:border-gold/60 hover:bg-gold/5"
                >
                  <span className="block text-base text-ivory">{item.name}</span>
                  <span className="block text-xs text-ivory-faint">{item.category}</span>
                </button>
              </li>
            ))}
          </ul>
        ))}

      {(kind === 'url' || kind === 'file' || kind === 'note') && (
        <div className="grid gap-3">
          <Field label="Description" error={error}>
            <input
              className="field"
              value={label}
              aria-invalid={Boolean(error)}
              placeholder="What does this prove?"
              onChange={(e) => setLabel(e.target.value)}
            />
          </Field>

          {kind === 'url' && (
            <Field label="URL">
              <input
                className="field"
                type="url"
                inputMode="url"
                placeholder="https://"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </Field>
          )}

          {kind === 'file' && (
            <Field
              label="File name"
              hint="Only the name is stored. The file itself is never read, uploaded or copied."
            >
              <input
                className="field"
                value={reference}
                placeholder="final-report.pdf"
                onChange={(e) => setReference(e.target.value)}
              />
            </Field>
          )}

          <div className="flex justify-end">
            <GameButton variant="primary" onClick={submitFreeform}>
              Attach evidence
            </GameButton>
          </div>
        </div>
      )}
    </Modal>
  );
}
