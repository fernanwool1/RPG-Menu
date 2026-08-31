'use client';

import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';

import { GameButton } from '@/components/ui/GameButton';
import { Modal } from '@/components/ui/Modal';
import { CONDITION_LABEL } from '@/domain/inventory';
import type { InventoryItem, InventoryLocation, ItemCondition } from '@/domain/types';
import { useAppStore } from '@/store/useAppStore';

/**
 * Validation lives in a Zod schema rather than in the JSX, so the same rules
 * could be reused server-side if this ever gains a backend.
 */
const itemSchema = z.object({
  name: z.string().trim().min(1, 'Give the item a name.').max(80, 'Keep the name under 80 characters.'),
  category: z.string().trim().min(1, 'Pick or type a category.').max(40),
  locationId: z.string().min(1, 'Choose where it lives.'),
  condition: z.enum(['new', 'good', 'worn', 'damaged', 'unknown']),
  estimatedValue: z
    .number({ invalid_type_error: 'Estimated value must be a number.' })
    .min(0, 'Value cannot be negative.')
    .max(10_000_000, 'That value looks like a typo.'),
  purchaseDate: z.string().nullable(),
  notes: z.string().max(600, 'Keep notes under 600 characters.').optional(),
  sensitiveIdentifier: z.string().max(120).optional(),
});

const CATEGORIES = [
  'Computer',
  'Tablet',
  'Desktop',
  'Phone',
  'Audio',
  'Documents',
  'Instrument',
  'Creative',
  'Furniture',
  'Sport',
  'Clothing',
  'Everyday',
];

export function ItemEditor({
  open,
  item,
  locations,
  onClose,
}: {
  open: boolean;
  /** Null creates a new item. */
  item: InventoryItem | null;
  locations: InventoryLocation[];
  onClose: () => void;
}) {
  const addItem = useAppStore((s) => s.addItem);
  const updateItem = useAppStore((s) => s.updateItem);

  // Memoised so the reset effect below can depend on it honestly rather than
  // on a stand-in like its length.
  const realLocations = useMemo(() => locations.filter((l) => !l.virtual), [locations]);
  const [form, setForm] = useState(() => blank(realLocations[0]?.id ?? ''));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [revealSensitive, setRevealSensitive] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setRevealSensitive(false);
    setForm(
      item
        ? {
            name: item.name,
            category: item.category,
            locationId: item.locationId,
            condition: item.condition,
            estimatedValue: String(item.estimatedValue),
            purchaseDate: item.purchaseDate ? item.purchaseDate.slice(0, 10) : '',
            notes: item.notes ?? '',
            sensitiveIdentifier: item.sensitiveIdentifier ?? '',
          }
        : blank(realLocations[0]?.id ?? ''),
    );
  }, [open, item, realLocations]);

  const submit = () => {
    const parsed = itemSchema.safeParse({
      name: form.name,
      category: form.category,
      locationId: form.locationId,
      condition: form.condition,
      estimatedValue: form.estimatedValue === '' ? 0 : Number(form.estimatedValue),
      purchaseDate: form.purchaseDate ? new Date(form.purchaseDate).toISOString() : null,
      notes: form.notes || undefined,
      sensitiveIdentifier: form.sensitiveIdentifier || undefined,
    });

    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        next[String(issue.path[0])] = issue.message;
      }
      setErrors(next);
      return;
    }

    if (item) {
      updateItem(item.id, { ...parsed.data, lastCheckedAt: new Date().toISOString() });
    } else {
      addItem({ ...parsed.data, image: 'generic', carried: false });
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item ? `Edit ${item.name}` : 'Add item'}
      size="md"
      footer={
        <>
          <GameButton variant="ghost" onClick={onClose}>
            Cancel
          </GameButton>
          <GameButton variant="primary" onClick={submit}>
            {item ? 'Save changes' : 'Add item'}
          </GameButton>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" error={errors.name} className="sm:col-span-2">
          <input
            className="field"
            value={form.name}
            aria-invalid={Boolean(errors.name)}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>

        <Field label="Category" error={errors.category}>
          <input
            className="field"
            list="item-categories"
            value={form.category}
            aria-invalid={Boolean(errors.category)}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
          <datalist id="item-categories">
            {CATEGORIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>

        <Field label="Location" error={errors.locationId}>
          <select
            className="field"
            value={form.locationId}
            onChange={(e) => setForm({ ...form, locationId: e.target.value })}
          >
            {realLocations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Condition">
          <select
            className="field"
            value={form.condition}
            onChange={(e) => setForm({ ...form, condition: e.target.value as ItemCondition })}
          >
            {(Object.keys(CONDITION_LABEL) as ItemCondition[]).map((c) => (
              <option key={c} value={c}>
                {CONDITION_LABEL[c]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Estimated value" error={errors.estimatedValue}>
          <input
            className="field"
            type="number"
            min={0}
            step="1"
            value={form.estimatedValue}
            aria-invalid={Boolean(errors.estimatedValue)}
            onChange={(e) => setForm({ ...form, estimatedValue: e.target.value })}
          />
        </Field>

        <Field label="Purchase date (optional)">
          <input
            className="field"
            type="date"
            value={form.purchaseDate}
            onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
          />
        </Field>

        <Field label="Notes" error={errors.notes} className="sm:col-span-2">
          <textarea
            className="field"
            rows={3}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>

        <Field
          label="Sensitive identifier (optional)"
          className="sm:col-span-2"
          hint="Serial or policy numbers. Stored locally, masked everywhere by default, and never shown until you choose to reveal it."
        >
          <div className="flex gap-2">
            <input
              className="field"
              type={revealSensitive ? 'text' : 'password'}
              autoComplete="off"
              value={form.sensitiveIdentifier}
              onChange={(e) => setForm({ ...form, sensitiveIdentifier: e.target.value })}
            />
            <GameButton
              variant="ghost"
              size="sm"
              onClick={() => setRevealSensitive((v) => !v)}
              className="shrink-0"
            >
              {revealSensitive ? 'Hide' : 'Show'}
            </GameButton>
          </div>
        </Field>
      </div>
    </Modal>
  );
}

function blank(locationId: string) {
  return {
    name: '',
    category: 'Everyday',
    locationId,
    condition: 'good' as ItemCondition,
    estimatedValue: '0',
    purchaseDate: '',
    notes: '',
    sensitiveIdentifier: '',
  };
}

export function Field({
  label,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={className}>
      <span className="field-label">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ivory-faint">{hint}</span>}
      {error && (
        <span role="alert" className="mt-1 block text-xs text-danger">
          {error}
        </span>
      )}
    </label>
  );
}
