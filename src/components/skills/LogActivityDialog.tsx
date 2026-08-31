'use client';

import { useEffect, useMemo, useState } from 'react';

import { Field } from '@/components/inventory/ItemEditor';
import { GameButton } from '@/components/ui/GameButton';
import { Modal } from '@/components/ui/Modal';
import { UNIT_LABEL, describeFormula, previewActivityXp } from '@/domain/activities';
import type { Id } from '@/domain/types';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/cn';

/**
 * Log a repeatable activity.
 *
 * The XP award is previewed live before saving, including the reason a
 * partial block earns nothing, so the arithmetic is never a surprise. Every
 * successful save writes exactly one ledger transaction.
 */
export function LogActivityDialog({
  open,
  defaultNodeId,
  onManageRules,
  onClose,
}: {
  open: boolean;
  defaultNodeId: Id | null;
  /** Opens the rule editor. Every rule below, seeded or not, is editable. */
  onManageRules?: () => void;
  onClose: () => void;
}) {
  const templates = useAppStore((s) => s.templates);
  const nodes = useAppStore((s) => s.nodes);
  const branches = useAppStore((s) => s.branches);
  const logActivity = useAppStore((s) => s.logActivity);

  const liveTemplates = useMemo(
    () => templates.filter((t) => !t.archived).sort((a, b) => a.name.localeCompare(b.name)),
    [templates],
  );

  const [templateId, setTemplateId] = useState<Id>('');
  const [nodeId, setNodeId] = useState<Id>('');
  const [amount, setAmount] = useState('');
  const [chosenXp, setChosenXp] = useState('');
  const [finished, setFinished] = useState(false);
  const [note, setNote] = useState('');
  const [occurredAt, setOccurredAt] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<string | null>(null);

  const template = liveTemplates.find((t) => t.id === templateId) ?? null;

  /** Nodes this template is allowed to feed, honouring its domain restriction. */
  const eligibleNodes = useMemo(() => {
    const live = nodes.filter((n) => !n.archived);
    if (!template?.restrictToDomainId) return live;
    const allowedBranches = new Set(
      branches.filter((b) => b.domainId === template.restrictToDomainId).map((b) => b.id),
    );
    const restricted = live.filter((n) => allowedBranches.has(n.branchId));
    // Never present an empty picker: fall back to everything if the domain
    // has been archived out from under the template.
    return restricted.length > 0 ? restricted : live;
  }, [nodes, branches, template?.restrictToDomainId]);

  const branchName = (id: Id) => branches.find((b) => b.id === id)?.name ?? '';

  // Seed the form whenever it opens, preferring the node the user came from.
  useEffect(() => {
    if (!open) return;
    const first = liveTemplates[0];
    setTemplateId(first?.id ?? '');
    setNodeId(defaultNodeId ?? first?.defaultNodeId ?? '');
    setAmount('');
    setChosenXp('');
    setFinished(false);
    setNote('');
    setOccurredAt(new Date().toISOString().slice(0, 16));
    setError('');
    setResult(null);
  }, [open, defaultNodeId, liveTemplates]);

  // Switching template re-points the node, unless the current node is legal.
  useEffect(() => {
    if (!template) return;
    setChosenXp(template.formula.kind === 'range' ? String(template.formula.minXp) : '');
    setFinished(false);
    setNodeId((current) => {
      if (current && eligibleNodes.some((n) => n.id === current)) return current;
      if (template.defaultNodeId && eligibleNodes.some((n) => n.id === template.defaultNodeId)) {
        return template.defaultNodeId;
      }
      return eligibleNodes[0]?.id ?? '';
    });
  }, [template, eligibleNodes]);

  const numericAmount = amount === '' ? 0 : Number(amount);
  const preview = template
    ? previewActivityXp(
        template,
        numericAmount,
        chosenXp === '' ? undefined : Number(chosenXp),
        finished,
      )
    : { xp: 0, explanation: '' };

  const submit = () => {
    if (!template) {
      setError('Choose an activity.');
      return;
    }
    if (!nodeId) {
      setError('Choose a skill node to receive the XP.');
      return;
    }
    if (amount === '' || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError(`Enter how many ${UNIT_LABEL[template.unit]} to log.`);
      return;
    }

    const outcome = logActivity({
      templateId: template.id,
      skillNodeId: nodeId,
      amount: numericAmount,
      chosenXp: chosenXp === '' ? undefined : Number(chosenXp),
      occurredAt: occurredAt ? new Date(occurredAt).toISOString() : undefined,
      note: note.trim() || undefined,
      finished,
    });

    if (!outcome.ok) {
      setError(outcome.error);
      return;
    }

    setError('');
    const nodeName = nodes.find((n) => n.id === nodeId)?.name ?? 'that node';
    setResult(`+${outcome.xp} XP to ${nodeName}, and +${outcome.xp} to your character.`);
    setAmount('');
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log activity"
      description="Every entry writes one ledger transaction. The node and your character each receive the same amount, once."
      size="md"
      footer={
        <>
          {onManageRules && (
            <GameButton variant="ghost" className="mr-auto" onClick={onManageRules}>
              Edit rules
            </GameButton>
          )}
          <GameButton variant="ghost" onClick={onClose}>
            Done
          </GameButton>
          <GameButton variant="primary" onClick={submit} disabled={!template}>
            Log it
          </GameButton>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Activity" className="sm:col-span-2">
          <select
            className="field"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            {liveTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} — {describeFormula(t)}
              </option>
            ))}
          </select>
        </Field>

        {template && (
          <p className="sm:col-span-2 -mt-1 text-xs leading-relaxed text-ivory-faint">
            {template.description}
          </p>
        )}

        <Field label="Skill node">
          <select className="field" value={nodeId} onChange={(e) => setNodeId(e.target.value)}>
            {eligibleNodes.map((n) => (
              <option key={n.id} value={n.id}>
                {branchName(n.branchId)} · {n.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label={template ? `Amount (${UNIT_LABEL[template.unit]})` : 'Amount'}>
          <input
            className="field"
            type="number"
            min={0}
            step="1"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>

        {template?.formula.kind === 'range' && (
          <Field
            label={`XP per piece (${template.formula.minXp}-${template.formula.maxXp})`}
            hint="Set it to match how demanding the piece actually was."
          >
            <input
              className="field"
              type="number"
              min={template.formula.minXp}
              max={template.formula.maxXp}
              value={chosenXp}
              onChange={(e) => setChosenXp(e.target.value)}
            />
          </Field>
        )}

        <Field label="When">
          <input
            className="field"
            type="datetime-local"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
          />
        </Field>

        <Field label="Note (optional)" className="sm:col-span-2">
          <input className="field" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>

        {template?.requiresFinished && (
          <label className="sm:col-span-2 flex items-start gap-2.5 rounded-[2px] border border-gold/30 bg-gold/[0.04] p-2.5">
            <input
              type="checkbox"
              checked={finished}
              onChange={(e) => setFinished(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--teal)]"
            />
            <span className="text-sm leading-relaxed text-ivory-dim">
              <strong className="text-ivory">The piece is finished.</strong> Creative work is scored
              on output, not on time. Unfinished work earns nothing, however long it took.
            </span>
          </label>
        )}
      </div>

      {/* Live preview of the award */}
      <div
        className={cn(
          'mt-4 rounded-[2px] border p-3 transition-colors duration-200',
          preview.xp > 0 ? 'border-teal/45 bg-teal/[0.06]' : 'border-gold/25 bg-ink-950/40',
        )}
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="label-caps text-gold">Award</span>
          <span
            className={cn(
              'font-display text-xl',
              preview.xp > 0 ? 'text-teal-bright' : 'text-ivory-faint',
            )}
          >
            {preview.xp > 0 ? `+${preview.xp} XP` : 'No XP yet'}
          </span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-ivory-faint">{preview.explanation}</p>
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
