'use client';

import { useEffect, useState } from 'react';
import { z } from 'zod';

import { Field } from '@/components/inventory/ItemEditor';
import { GameButton } from '@/components/ui/GameButton';
import { Modal } from '@/components/ui/Modal';
import { ICON_CHOICES, iconFor } from '@/lib/icons';
import type { Id } from '@/domain/types';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/cn';

const nameSchema = z.string().trim().min(1, 'Give it a name.').max(60, 'Keep it under 60 characters.');

export type HierarchyTarget =
  | { kind: 'domain'; id?: Id }
  | { kind: 'branch'; id?: Id; domainId: Id }
  | { kind: 'node'; id?: Id; branchId: Id };

const TITLES: Record<HierarchyTarget['kind'], { create: string; edit: string }> = {
  domain: { create: 'Add domain', edit: 'Edit domain' },
  branch: { create: 'Add branch', edit: 'Edit branch' },
  node: { create: 'Add skill node', edit: 'Edit skill node' },
};

/**
 * Create and edit anything in the Domain -> Branch -> Node hierarchy.
 *
 * Seeded records are ordinary records: everything here works on the sample
 * data exactly as it does on something the user just made.
 */
export function HierarchyEditor({
  open,
  target,
  onClose,
}: {
  open: boolean;
  target: HierarchyTarget | null;
  onClose: () => void;
}) {
  const domains = useAppStore((s) => s.domains);
  const branches = useAppStore((s) => s.branches);
  const nodes = useAppStore((s) => s.nodes);

  const addDomain = useAppStore((s) => s.addDomain);
  const updateDomain = useAppStore((s) => s.updateDomain);
  const addBranch = useAppStore((s) => s.addBranch);
  const updateBranch = useAppStore((s) => s.updateBranch);
  const addNode = useAppStore((s) => s.addNode);
  const updateNode = useAppStore((s) => s.updateNode);

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('sparkles');
  const [parentIds, setParentIds] = useState<Id[]>([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const existing =
    target?.id === undefined
      ? null
      : target.kind === 'domain'
        ? domains.find((d) => d.id === target.id)
        : target.kind === 'branch'
          ? branches.find((b) => b.id === target.id)
          : nodes.find((n) => n.id === target.id);

  useEffect(() => {
    if (!open || !target) return;
    setError('');
    if (existing) {
      setName(existing.name);
      setIcon(existing.icon);
      setParentIds('parentIds' in existing ? existing.parentIds : []);
      setNotes('notes' in existing ? (existing.notes ?? '') : '');
    } else {
      setName('');
      setIcon(target.kind === 'node' ? 'sparkles' : 'layers');
      setParentIds([]);
      setNotes('');
    }
  }, [open, target, existing]);

  if (!target) return null;

  const siblingNodes =
    target.kind === 'node'
      ? nodes.filter((n) => !n.archived && n.branchId === target.branchId && n.id !== target.id)
      : [];

  const submit = () => {
    const parsed = nameSchema.safeParse(name);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    if (target.kind === 'domain') {
      if (target.id) updateDomain(target.id, { name: parsed.data, icon });
      else addDomain({ name: parsed.data, icon });
    } else if (target.kind === 'branch') {
      if (target.id) updateBranch(target.id, { name: parsed.data, icon });
      else addBranch(target.domainId, { name: parsed.data, icon });
    } else {
      if (target.id) updateNode(target.id, { name: parsed.data, icon, parentIds, notes });
      else addNode(target.branchId, { name: parsed.data, icon, parentIds });
    }

    onClose();
  };

  const titles = TITLES[target.kind];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={target.id ? titles.edit : titles.create}
      size="md"
      footer={
        <>
          <GameButton variant="ghost" onClick={onClose}>
            Cancel
          </GameButton>
          <GameButton variant="primary" onClick={submit}>
            {target.id ? 'Save changes' : 'Create'}
          </GameButton>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label="Name" error={error}>
          <input
            className="field"
            value={name}
            autoFocus
            aria-invalid={Boolean(error)}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <Field label="Icon">
          <div className="grid max-h-40 grid-cols-8 gap-1 overflow-y-auto scroll-thin rounded-[2px] border border-gold/20 p-2 sm:grid-cols-12">
            {ICON_CHOICES.map((choice) => {
              const Icon = iconFor(choice);
              const active = choice === icon;
              return (
                <button
                  key={choice}
                  type="button"
                  onClick={() => setIcon(choice)}
                  title={choice}
                  aria-label={choice}
                  aria-pressed={active}
                  className={cn(
                    'inline-flex h-7 w-7 items-center justify-center rounded-[2px] border transition-colors duration-200',
                    active
                      ? 'border-teal text-teal-bright'
                      : 'border-transparent text-ivory-faint hover:border-gold/40 hover:text-ivory',
                  )}
                >
                  <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={1.4} />
                </button>
              );
            })}
          </div>
        </Field>

        {target.kind === 'node' && (
          <>
            <Field
              label="Follows"
              hint="Pick the nodes this one builds on. The tree lays itself out from these links."
            >
              {siblingNodes.length === 0 ? (
                <p className="text-sm text-ivory-faint">
                  This is the first node in the branch, so it starts as a root.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {siblingNodes.map((sibling) => {
                    const active = parentIds.includes(sibling.id);
                    return (
                      <button
                        key={sibling.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() =>
                          setParentIds((current) =>
                            current.includes(sibling.id)
                              ? current.filter((p) => p !== sibling.id)
                              : [...current, sibling.id],
                          )
                        }
                        className={cn(
                          'rounded-[2px] border px-2 py-1 text-xs transition-colors duration-200',
                          active
                            ? 'border-teal/60 bg-teal/10 text-teal-bright'
                            : 'border-gold/30 text-ivory-dim hover:border-gold/60 hover:text-ivory',
                        )}
                      >
                        {sibling.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </Field>

            <Field label="Notes (optional)">
              <textarea
                className="field"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
          </>
        )}
      </div>
    </Modal>
  );
}
