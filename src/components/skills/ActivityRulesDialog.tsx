'use client';

import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';

import { Field } from '@/components/inventory/ItemEditor';
import { EmptyState } from '@/components/ui/EmptyState';
import { GameButton } from '@/components/ui/GameButton';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { UNIT_LABEL, describeFormula } from '@/domain/activities';
import { newId, nowIso } from '@/domain/ids';
import type { ActivityFormula, ActivityTemplate, ActivityUnit, Id } from '@/domain/types';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/cn';

/**
 * Manage the repeatable activity rules.
 *
 * The seeded rules are ordinary records, so everything here works on them
 * exactly as it does on a rule the user just wrote. `builtIn` only affects the
 * label, never what you are allowed to do.
 */

const UNITS: ActivityUnit[] = ['page', 'minute', 'calorie', 'piece', 'session'];

const ruleSchema = z.object({
  name: z.string().trim().min(1, 'Give the rule a name.').max(60),
  description: z.string().trim().max(400).optional(),
  unitsPerXp: z.number().int().min(1, 'Must be at least 1.').max(10_000),
  xpPerBlock: z.number().int().min(1, 'Must be at least 1.').max(10_000),
  fixedXp: z.number().int().min(1, 'Must be at least 1.').max(10_000),
  minXp: z.number().int().min(1).max(10_000),
  maxXp: z.number().int().min(1).max(10_000),
});

export function ActivityRulesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const templates = useAppStore((s) => s.templates);
  const domains = useAppStore((s) => s.domains);
  const nodes = useAppStore((s) => s.nodes);
  const branches = useAppStore((s) => s.branches);
  const saveTemplate = useAppStore((s) => s.saveTemplate);
  const archiveTemplate = useAppStore((s) => s.archiveTemplate);

  const [editingId, setEditingId] = useState<Id | 'new' | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<Id | null>(null);

  const live = useMemo(
    () => templates.filter((t) => !t.archived).sort((a, b) => a.name.localeCompare(b.name)),
    [templates],
  );

  const domainName = (id: Id | null) =>
    id ? (domains.find((d) => d.id === id)?.name ?? 'Unknown domain') : 'Any domain';

  const nodeName = (id: Id | null) =>
    id ? (nodes.find((n) => n.id === id)?.name ?? 'Unknown node') : 'Chosen when logging';

  return (
    <>
      <Modal
        open={open && editingId === null}
        onClose={onClose}
        title="Activity rules"
        description="How each kind of work converts into XP. Every rule is editable, including the seeded ones."
        size="lg"
        footer={
          <>
            <GameButton variant="ghost" onClick={onClose}>
              Close
            </GameButton>
            <GameButton variant="primary" onClick={() => setEditingId('new')}>
              + New rule
            </GameButton>
          </>
        }
      >
        {live.length === 0 ? (
          <EmptyState
            icon="sparkles"
            title="No activity rules"
            body="Without a rule there is nothing to log. Create one to get started."
            action={
              <GameButton variant="primary" onClick={() => setEditingId('new')}>
                + New rule
              </GameButton>
            }
          />
        ) : (
          <ul className="divide-y divide-gold/10">
            {live.map((template) => (
              <li key={template.id} className="flex items-start gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-base text-ivory">{template.name}</span>
                    <span className="text-xs text-teal">{describeFormula(template)}</span>
                    {template.requiresFinished && (
                      <StatusBadge bare tone="progress">
                        Output only
                      </StatusBadge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-ivory-faint">
                    {domainName(template.restrictToDomainId)} · defaults to{' '}
                    {nodeName(template.defaultNodeId)}
                  </p>
                </div>

                <div className="flex shrink-0 gap-1.5">
                  <GameButton variant="ghost" size="sm" onClick={() => setEditingId(template.id)}>
                    Edit
                  </GameButton>
                  <GameButton
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmArchive(template.id)}
                  >
                    Archive
                  </GameButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <RuleEditor
        open={editingId !== null}
        template={editingId && editingId !== 'new' ? (templates.find((t) => t.id === editingId) ?? null) : null}
        domains={domains}
        branches={branches}
        nodes={nodes}
        onSave={(template) => {
          saveTemplate(template);
          setEditingId(null);
        }}
        onCancel={() => setEditingId(null)}
      />

      <ConfirmDialog
        open={confirmArchive !== null}
        title="Archive this rule?"
        body="It stops appearing in the log form. Everything already logged with it stays in the ledger untouched."
        confirmLabel="Archive"
        onConfirm={() => {
          if (confirmArchive) archiveTemplate(confirmArchive);
          setConfirmArchive(null);
        }}
        onCancel={() => setConfirmArchive(null)}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */

function RuleEditor({
  open,
  template,
  domains,
  branches,
  nodes,
  onSave,
  onCancel,
}: {
  open: boolean;
  template: ActivityTemplate | null;
  domains: ReturnType<typeof useAppStore.getState>['domains'];
  branches: ReturnType<typeof useAppStore.getState>['branches'];
  nodes: ReturnType<typeof useAppStore.getState>['nodes'];
  onSave: (template: ActivityTemplate) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState<ActivityUnit>('minute');
  const [kind, setKind] = useState<ActivityFormula['kind']>('rate');
  const [unitsPerXp, setUnitsPerXp] = useState('1');
  const [xpPerBlock, setXpPerBlock] = useState('1');
  const [fixedXp, setFixedXp] = useState('50');
  const [minXp, setMinXp] = useState('5');
  const [maxXp, setMaxXp] = useState('15');
  const [restrictToDomainId, setRestrictToDomainId] = useState('');
  const [defaultNodeId, setDefaultNodeId] = useState('');
  const [requiresFinished, setRequiresFinished] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');

    if (template) {
      setName(template.name);
      setDescription(template.description);
      setUnit(template.unit);
      setKind(template.formula.kind);
      if (template.formula.kind === 'rate') {
        setUnitsPerXp(String(template.formula.unitsPerXp));
        setXpPerBlock(String(template.formula.xpPerBlock));
      } else if (template.formula.kind === 'fixed') {
        setFixedXp(String(template.formula.fixedXp));
      } else {
        setMinXp(String(template.formula.minXp));
        setMaxXp(String(template.formula.maxXp));
      }
      setRestrictToDomainId(template.restrictToDomainId ?? '');
      setDefaultNodeId(template.defaultNodeId ?? '');
      setRequiresFinished(template.requiresFinished);
    } else {
      setName('');
      setDescription('');
      setUnit('minute');
      setKind('rate');
      setUnitsPerXp('1');
      setXpPerBlock('1');
      setFixedXp('50');
      setMinXp('5');
      setMaxXp('15');
      setRestrictToDomainId('');
      setDefaultNodeId('');
      setRequiresFinished(false);
    }
  }, [open, template]);

  /** Node choices honour the domain restriction, same as the log form. */
  const eligibleNodes = useMemo(() => {
    const liveNodes = nodes.filter((n) => !n.archived);
    if (!restrictToDomainId) return liveNodes;
    const allowed = new Set(
      branches.filter((b) => b.domainId === restrictToDomainId).map((b) => b.id),
    );
    return liveNodes.filter((n) => allowed.has(n.branchId));
  }, [nodes, branches, restrictToDomainId]);

  const submit = () => {
    const parsed = ruleSchema.safeParse({
      name,
      description: description || undefined,
      unitsPerXp: Number(unitsPerXp) || 0,
      xpPerBlock: Number(xpPerBlock) || 0,
      fixedXp: Number(fixedXp) || 0,
      minXp: Number(minXp) || 0,
      maxXp: Number(maxXp) || 0,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    if (kind === 'range' && parsed.data.minXp > parsed.data.maxXp) {
      setError('The minimum XP cannot be above the maximum.');
      return;
    }

    const formula: ActivityFormula =
      kind === 'rate'
        ? { kind: 'rate', unitsPerXp: parsed.data.unitsPerXp, xpPerBlock: parsed.data.xpPerBlock }
        : kind === 'fixed'
          ? { kind: 'fixed', fixedXp: parsed.data.fixedXp }
          : { kind: 'range', minXp: parsed.data.minXp, maxXp: parsed.data.maxXp };

    const at = nowIso();
    onSave({
      id: template?.id ?? newId('atp'),
      name: parsed.data.name,
      description: parsed.data.description ?? '',
      unit,
      formula,
      defaultNodeId: defaultNodeId || null,
      restrictToDomainId: restrictToDomainId || null,
      requiresFinished,
      archived: false,
      builtIn: template?.builtIn ?? false,
      createdAt: template?.createdAt ?? at,
      updatedAt: at,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={template ? `Edit ${template.name}` : 'New activity rule'}
      size="md"
      footer={
        <>
          <GameButton variant="ghost" onClick={onCancel}>
            Cancel
          </GameButton>
          <GameButton variant="primary" onClick={submit}>
            {template ? 'Save changes' : 'Create rule'}
          </GameButton>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2">
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        <Field label="Description" className="sm:col-span-2">
          <textarea
            className="field"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        <Field label="Measured in">
          <select
            className="field"
            value={unit}
            onChange={(e) => setUnit(e.target.value as ActivityUnit)}
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {UNIT_LABEL[u]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Scoring">
          <select
            className="field"
            value={kind}
            onChange={(e) => setKind(e.target.value as ActivityFormula['kind'])}
          >
            <option value="rate">Rate — XP per block of units</option>
            <option value="fixed">Fixed — flat XP per piece</option>
            <option value="range">Range — pick a value per piece</option>
          </select>
        </Field>

        {kind === 'rate' && (
          <>
            <Field label={`${UNIT_LABEL[unit]} per block`} hint="Partial blocks earn nothing.">
              <input
                className="field"
                type="number"
                min={1}
                value={unitsPerXp}
                onChange={(e) => setUnitsPerXp(e.target.value)}
              />
            </Field>
            <Field label="XP per block">
              <input
                className="field"
                type="number"
                min={1}
                value={xpPerBlock}
                onChange={(e) => setXpPerBlock(e.target.value)}
              />
            </Field>
          </>
        )}

        {kind === 'fixed' && (
          <Field label="XP per finished piece" className="sm:col-span-2">
            <input
              className="field"
              type="number"
              min={1}
              value={fixedXp}
              onChange={(e) => setFixedXp(e.target.value)}
            />
          </Field>
        )}

        {kind === 'range' && (
          <>
            <Field label="Minimum XP">
              <input
                className="field"
                type="number"
                min={1}
                value={minXp}
                onChange={(e) => setMinXp(e.target.value)}
              />
            </Field>
            <Field label="Maximum XP">
              <input
                className="field"
                type="number"
                min={1}
                value={maxXp}
                onChange={(e) => setMaxXp(e.target.value)}
              />
            </Field>
          </>
        )}

        <Field label="Restrict to domain">
          <select
            className="field"
            value={restrictToDomainId}
            onChange={(e) => {
              setRestrictToDomainId(e.target.value);
              setDefaultNodeId('');
            }}
          >
            <option value="">Any domain</option>
            {domains
              .filter((d) => !d.archived)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
          </select>
        </Field>

        <Field label="Default skill node">
          <select
            className="field"
            value={defaultNodeId}
            onChange={(e) => setDefaultNodeId(e.target.value)}
          >
            <option value="">Chosen when logging</option>
            {eligibleNodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        </Field>

        <label
          className={cn(
            'sm:col-span-2 flex items-start gap-2.5 rounded-[2px] border p-2.5 transition-colors duration-200',
            requiresFinished ? 'border-teal/45 bg-teal/[0.06]' : 'border-gold/25',
          )}
        >
          <input
            type="checkbox"
            checked={requiresFinished}
            onChange={(e) => setRequiresFinished(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--teal)]"
          />
          <span className="text-sm leading-relaxed text-ivory-dim">
            <strong className="text-ivory">Output only.</strong> Requires an explicit confirmation
            that the piece is finished before any XP is awarded. This is how Creative Arts is
            scored — on what you produced, never on the time it took.
          </span>
        </label>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </Modal>
  );
}
