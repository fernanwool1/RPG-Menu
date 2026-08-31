'use client';

import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { ChevronDown, ChevronUp, X } from 'lucide-react';

import { Field } from '@/components/inventory/ItemEditor';
import { GameButton } from '@/components/ui/GameButton';
import { Modal } from '@/components/ui/Modal';
import { newId } from '@/domain/ids';
import {
  QUEST_DIFFICULTY_LABEL,
  QUEST_PRIORITY_LABEL,
  QUEST_TYPE_LABEL,
  QUEST_XP_RANGE,
  isXpWithinSuggestedRange,
  suggestedXpFor,
} from '@/domain/quests';
import type {
  Id,
  Quest,
  QuestDifficulty,
  QuestObjective,
  QuestPriority,
  QuestRecurrence,
  QuestSkillAllocation,
  QuestType,
} from '@/domain/types';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/cn';

const questSchema = z.object({
  title: z.string().trim().min(1, 'Give the quest a title.').max(120),
  description: z.string().max(2000).optional(),
  category: z.string().trim().min(1, 'Pick a category.').max(60),
  characterXp: z
    .number({ invalid_type_error: 'XP must be a number.' })
    .int('XP must be a whole number.')
    .min(0, 'XP cannot be negative.')
    .max(100_000),
  notes: z.string().max(2000).optional(),
});

const TYPES = Object.keys(QUEST_TYPE_LABEL) as QuestType[];
const DIFFICULTIES = Object.keys(QUEST_DIFFICULTY_LABEL) as QuestDifficulty[];
const PRIORITIES = Object.keys(QUEST_PRIORITY_LABEL) as QuestPriority[];
const RECURRENCES: QuestRecurrence[] = ['none', 'daily', 'weekly', 'monthly'];

export function QuestEditor({
  open,
  quest,
  onClose,
}: {
  open: boolean;
  /** Null creates a new quest. */
  quest: Quest | null;
  onClose: () => void;
}) {
  const createQuest = useAppStore((s) => s.createQuest);
  const updateQuest = useAppStore((s) => s.updateQuest);
  const nodes = useAppStore((s) => s.nodes);
  const branches = useAppStore((s) => s.branches);
  const domains = useAppStore((s) => s.domains);
  const locations = useAppStore((s) => s.locations);

  const [form, setForm] = useState(() => blankForm());
  const [objectives, setObjectives] = useState<QuestObjective[]>([]);
  const [allocations, setAllocations] = useState<QuestSkillAllocation[]>([]);
  const [rewards, setRewards] = useState<Quest['rewards']>([]);
  const [attachments, setAttachments] = useState<Quest['attachments']>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newObjective, setNewObjective] = useState('');

  const categories = useMemo(() => {
    const fromDomains = domains.filter((d) => !d.archived).map((d) => d.name);
    return [...new Set([...fromDomains, 'Personal', 'Abilities'])];
  }, [domains]);

  const nodeLabel = (id: Id) => {
    const node = nodes.find((n) => n.id === id);
    if (!node) return 'Unknown node';
    const branch = branches.find((b) => b.id === node.branchId);
    return branch ? `${branch.name} · ${node.name}` : node.name;
  };

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setNewObjective('');

    if (quest) {
      setForm({
        title: quest.title,
        description: quest.description,
        type: quest.type,
        category: quest.category,
        difficulty: quest.difficulty,
        priority: quest.priority,
        recurrence: quest.recurrence,
        characterXp: String(quest.characterXp),
        deadline: quest.deadline ? toLocalInput(quest.deadline) : '',
        notes: quest.notes ?? '',
      });
      setObjectives([...quest.objectives].sort((a, b) => a.order - b.order));
      setAllocations(quest.skillAllocations);
      setRewards(quest.rewards);
      setAttachments(quest.attachments);
    } else {
      setForm(blankForm());
      setObjectives([]);
      setAllocations([]);
      setRewards([]);
      setAttachments([]);
    }
  }, [open, quest]);

  const allocatedTotal = allocations.reduce((sum, a) => sum + a.xp, 0);
  const characterXp = form.characterXp === '' ? 0 : Number(form.characterXp);
  const overAllocated = allocatedTotal > characterXp;
  const band = QUEST_XP_RANGE[form.type];

  const addObjective = () => {
    const label = newObjective.trim();
    if (!label) return;
    setObjectives((current) => [
      ...current,
      { id: newId('obj'), label, done: false, order: current.length },
    ]);
    setNewObjective('');
  };

  const moveObjectiveLocal = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= objectives.length) return;
    const next = [...objectives];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    setObjectives(next.map((o, i) => ({ ...o, order: i })));
  };

  const submit = () => {
    const parsed = questSchema.safeParse({
      title: form.title,
      description: form.description || undefined,
      category: form.category,
      characterXp,
      notes: form.notes || undefined,
    });

    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }

    if (overAllocated) {
      setErrors({
        characterXp: `Skill allocations total ${allocatedTotal} XP, more than the quest's ${characterXp} XP. Allocations are carved out of the quest total, never added on top.`,
      });
      return;
    }

    const payload = {
      title: parsed.data.title,
      description: parsed.data.description ?? '',
      type: form.type,
      category: parsed.data.category,
      difficulty: form.difficulty,
      priority: form.priority,
      recurrence: form.recurrence,
      characterXp: parsed.data.characterXp,
      deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
      notes: parsed.data.notes,
      objectives: objectives.map((o, i) => ({ ...o, order: i })),
      skillAllocations: allocations.filter((a) => a.xp > 0),
      rewards,
      attachments,
    };

    if (quest) {
      updateQuest(quest.id, payload);
    } else {
      createQuest({
        ...payload,
        status: 'planned',
        completedAt: null,
        failedAt: null,
        xpAwardedAt: null,
        abilityId: null,
      } as Omit<Quest, 'id' | 'createdAt' | 'updatedAt'>);
    }

    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={quest ? `Edit ${quest.title}` : 'New quest'}
      size="lg"
      footer={
        <>
          <GameButton variant="ghost" onClick={onClose}>
            Cancel
          </GameButton>
          <GameButton variant="primary" onClick={submit}>
            {quest ? 'Save changes' : 'Create quest'}
          </GameButton>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title" error={errors.title} className="sm:col-span-2">
          <input
            className="field"
            value={form.title}
            autoFocus
            aria-invalid={Boolean(errors.title)}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </Field>

        <Field label="Description" className="sm:col-span-2">
          <textarea
            className="field"
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>

        <Field label="Type">
          <select
            className="field"
            value={form.type}
            onChange={(e) => {
              const type = e.target.value as QuestType;
              // Nudge XP into the new type's band when it was left at the old
              // suggestion, but never overwrite a deliberate number.
              const wasSuggested = characterXp === suggestedXpFor(form.type);
              setForm({
                ...form,
                type,
                characterXp: wasSuggested ? String(suggestedXpFor(type)) : form.characterXp,
              });
            }}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {QUEST_TYPE_LABEL[t]} ({QUEST_XP_RANGE[t].min}-{QUEST_XP_RANGE[t].max} XP)
              </option>
            ))}
          </select>
        </Field>

        <Field label="Category" error={errors.category}>
          <input
            className="field"
            list="quest-categories"
            value={form.category}
            aria-invalid={Boolean(errors.category)}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
          <datalist id="quest-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>

        <Field label="Difficulty">
          <select
            className="field"
            value={form.difficulty}
            onChange={(e) => setForm({ ...form, difficulty: e.target.value as QuestDifficulty })}
          >
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {QUEST_DIFFICULTY_LABEL[d]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Priority">
          <select
            className="field"
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value as QuestPriority })}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {QUEST_PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Recurrence">
          <select
            className="field"
            value={form.recurrence}
            onChange={(e) => setForm({ ...form, recurrence: e.target.value as QuestRecurrence })}
          >
            {RECURRENCES.map((r) => (
              <option key={r} value={r}>
                {r === 'none' ? 'One-off' : r[0].toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Deadline (optional)">
          <input
            className="field"
            type="datetime-local"
            value={form.deadline}
            onChange={(e) => setForm({ ...form, deadline: e.target.value })}
          />
        </Field>

        <Field
          label="Character XP"
          error={errors.characterXp}
          hint={
            isXpWithinSuggestedRange(form.type, characterXp)
              ? undefined
              : `Outside the suggested ${band.min}-${band.max} XP for a ${QUEST_TYPE_LABEL[form.type]} quest. That is allowed.`
          }
          className="sm:col-span-2"
        >
          <input
            className="field"
            type="number"
            min={0}
            step="5"
            value={form.characterXp}
            aria-invalid={Boolean(errors.characterXp)}
            onChange={(e) => setForm({ ...form, characterXp: e.target.value })}
          />
        </Field>
      </div>

      {/* ---------------- objectives ---------------- */}
      <section className="mt-5">
        <h3 className="label-caps mb-2 text-gold">Objectives</h3>
        {objectives.length === 0 ? (
          <p className="mb-2 text-sm text-ivory-faint">
            No objectives yet. A quest with objectives tracks its own progress.
          </p>
        ) : (
          <ul className="mb-2 space-y-1">
            {objectives.map((objective, index) => (
              <li
                key={objective.id}
                className="flex items-center gap-2 rounded-[2px] border border-gold/20 px-2 py-1.5"
              >
                <span className="min-w-0 flex-1 text-base text-ivory">{objective.label}</span>
                <button
                  type="button"
                  onClick={() => moveObjectiveLocal(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move "${objective.label}" up`}
                  title="Move up"
                  className="shrink-0 text-ivory-faint transition-colors duration-200 hover:text-ivory disabled:opacity-30"
                >
                  <ChevronUp aria-hidden className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveObjectiveLocal(index, 1)}
                  disabled={index === objectives.length - 1}
                  aria-label={`Move "${objective.label}" down`}
                  title="Move down"
                  className="shrink-0 text-ivory-faint transition-colors duration-200 hover:text-ivory disabled:opacity-30"
                >
                  <ChevronDown aria-hidden className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setObjectives((current) =>
                      current.filter((o) => o.id !== objective.id).map((o, i) => ({ ...o, order: i })),
                    )
                  }
                  aria-label={`Remove "${objective.label}"`}
                  title="Remove"
                  className="shrink-0 text-ivory-faint transition-colors duration-200 hover:text-danger"
                >
                  <X aria-hidden className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2">
          <input
            className="field"
            placeholder="Add an objective"
            value={newObjective}
            onChange={(e) => setNewObjective(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addObjective();
              }
            }}
          />
          <GameButton variant="secondary" onClick={addObjective} className="shrink-0">
            Add
          </GameButton>
        </div>
      </section>

      {/* ---------------- skill allocation ---------------- */}
      <section className="mt-5">
        <h3 className="label-caps mb-1 text-gold">Skill XP allocation</h3>
        <p className="mb-2 text-xs leading-relaxed text-ivory-faint">
          Routes part of this quest&apos;s {characterXp} XP to specific skill nodes. Allocations are
          carved out of the total, never added on top, so completing the quest always pays exactly{' '}
          {characterXp} XP.
        </p>

        {allocations.length > 0 && (
          <ul className="mb-2 space-y-1">
            {allocations.map((allocation, index) => (
              <li
                key={`${allocation.skillNodeId}-${index}`}
                className="flex items-center gap-2 rounded-[2px] border border-gold/20 px-2 py-1.5"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-ivory">
                  {nodeLabel(allocation.skillNodeId)}
                </span>
                <input
                  className="field w-20 shrink-0 py-1 text-right"
                  type="number"
                  min={0}
                  step="5"
                  aria-label={`XP for ${nodeLabel(allocation.skillNodeId)}`}
                  value={allocation.xp}
                  onChange={(e) =>
                    setAllocations((current) =>
                      current.map((a, i) =>
                        i === index ? { ...a, xp: Math.max(0, Number(e.target.value) || 0) } : a,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  onClick={() => setAllocations((current) => current.filter((_, i) => i !== index))}
                  aria-label="Remove allocation"
                  title="Remove"
                  className="shrink-0 text-ivory-faint transition-colors duration-200 hover:text-danger"
                >
                  <X aria-hidden className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <select
            className="field flex-1"
            value=""
            aria-label="Add a skill node allocation"
            onChange={(e) => {
              if (!e.target.value) return;
              setAllocations((current) => [
                ...current,
                { skillNodeId: e.target.value, xp: 0 },
              ]);
              e.target.value = '';
            }}
          >
            <option value="">Add a skill node…</option>
            {nodes
              .filter((n) => !n.archived)
              .map((node) => (
                <option key={node.id} value={node.id}>
                  {nodeLabel(node.id)}
                </option>
              ))}
          </select>

          <span
            className={cn(
              'shrink-0 text-sm',
              overAllocated ? 'text-danger' : 'text-ivory-dim',
            )}
          >
            {allocatedTotal} / {characterXp} XP allocated
          </span>
        </div>
      </section>

      {/* ---------------- rewards ---------------- */}
      <section className="mt-5">
        <h3 className="label-caps mb-1 text-gold">Object rewards</h3>
        <p className="mb-2 text-xs leading-relaxed text-ivory-faint">
          Anything listed as an item is created in your inventory when the quest completes.
        </p>

        {rewards.length > 0 && (
          <ul className="mb-2 space-y-1">
            {rewards.map((reward) => (
              <li
                key={reward.id}
                className="flex items-center gap-2 rounded-[2px] border border-gold/20 px-2 py-1.5"
              >
                <span className="min-w-0 flex-1 text-sm text-ivory">{reward.label}</span>
                <span className="shrink-0 text-xs uppercase tracking-wider2 text-ivory-faint">
                  {reward.kind.replace('-', ' ')}
                </span>
                <button
                  type="button"
                  onClick={() => setRewards((current) => current.filter((r) => r.id !== reward.id))}
                  aria-label={`Remove reward: ${reward.label}`}
                  title="Remove"
                  className="shrink-0 text-ivory-faint transition-colors duration-200 hover:text-danger"
                >
                  <X aria-hidden className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <RewardAdder
          locationId={locations.find((l) => !l.virtual)?.id}
          onAdd={(reward) => setRewards((current) => [...current, reward])}
        />
      </section>

      {/* ---------------- attachments & notes ---------------- */}
      <section className="mt-5">
        <h3 className="label-caps mb-2 text-gold">Attachments</h3>
        {attachments.length > 0 && (
          <ul className="mb-2 space-y-1">
            {attachments.map((attachment) => (
              <li
                key={attachment.id}
                className="flex items-center gap-2 rounded-[2px] border border-gold/20 px-2 py-1.5"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-ivory">
                  {attachment.label}
                </span>
                <span className="min-w-0 max-w-[40%] truncate text-xs text-ivory-faint">
                  {attachment.url}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setAttachments((current) => current.filter((a) => a.id !== attachment.id))
                  }
                  aria-label={`Remove attachment: ${attachment.label}`}
                  title="Remove"
                  className="shrink-0 text-ivory-faint transition-colors duration-200 hover:text-danger"
                >
                  <X aria-hidden className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <AttachmentAdder onAdd={(a) => setAttachments((current) => [...current, a])} />

        <Field label="Personal notes" className="mt-3">
          <textarea
            className="field"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>
      </section>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

function blankForm() {
  return {
    title: '',
    description: '',
    type: 'standard' as QuestType,
    category: 'Personal',
    difficulty: 'moderate' as QuestDifficulty,
    priority: 'normal' as QuestPriority,
    recurrence: 'none' as QuestRecurrence,
    characterXp: String(suggestedXpFor('standard')),
    deadline: '',
    notes: '',
  };
}

/** datetime-local wants local wall-clock time, not a UTC ISO string. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}

function RewardAdder({
  locationId,
  onAdd,
}: {
  locationId?: Id;
  onAdd: (reward: Quest['rewards'][number]) => void;
}) {
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<Quest['rewards'][number]['kind']>('inventory-item');
  const [value, setValue] = useState('0');

  return (
    <div className="flex flex-wrap gap-2">
      <input
        className="field flex-1"
        placeholder="Reward description"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <select
        className="field w-32 shrink-0"
        aria-label="Reward kind"
        value={kind}
        onChange={(e) => setKind(e.target.value as Quest['rewards'][number]['kind'])}
      >
        <option value="inventory-item">Item</option>
        <option value="note">Note</option>
        <option value="unlock-hint">Unlock hint</option>
      </select>
      {kind === 'inventory-item' && (
        <input
          className="field w-24 shrink-0"
          type="number"
          min={0}
          aria-label="Estimated value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      )}
      <GameButton
        variant="secondary"
        className="shrink-0"
        onClick={() => {
          const trimmed = label.trim();
          if (!trimmed) return;
          onAdd({
            id: newId('rwd'),
            kind,
            label: trimmed,
            itemCategory: kind === 'inventory-item' ? 'Quest reward' : undefined,
            itemLocationId: kind === 'inventory-item' ? locationId : undefined,
            itemEstimatedValue: kind === 'inventory-item' ? Number(value) || 0 : undefined,
          });
          setLabel('');
          setValue('0');
        }}
      >
        Add
      </GameButton>
    </div>
  );
}

function AttachmentAdder({ onAdd }: { onAdd: (a: Quest['attachments'][number]) => void }) {
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <input
          className="field flex-1"
          placeholder="Label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <input
          className="field flex-1"
          type="url"
          placeholder="https://"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <GameButton
          variant="secondary"
          className="shrink-0"
          onClick={() => {
            const parsed = z.string().trim().url().safeParse(url);
            if (!label.trim()) {
              setError('Give the link a label.');
              return;
            }
            if (!parsed.success) {
              setError('Enter a full URL, including https://');
              return;
            }
            onAdd({ id: newId('att'), label: label.trim(), url: parsed.data });
            setLabel('');
            setUrl('');
            setError('');
          }}
        >
          Add
        </GameButton>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
