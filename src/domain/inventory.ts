import type { FinancialSnapshot, InventoryItem, ItemCondition } from './types';

export const CONDITION_LABEL: Record<ItemCondition, string> = {
  new: 'New',
  good: 'Good',
  worn: 'Worn',
  damaged: 'Damaged',
  unknown: 'Unknown',
};

export interface AssetTotals {
  cash: number;
  bank: number;
  itemValue: number;
  total: number;
  itemCount: number;
}

/**
 * Version one:  Total Assets = Cash + Bank + estimated value of owned items.
 *
 * Deliberately NOT called net worth: liabilities are not modelled yet, so this
 * number is what you hold, not what you are worth. The breakdown is surfaced
 * in the UI so the arithmetic is never a black box.
 */
export function computeAssetTotals(
  finances: FinancialSnapshot,
  items: InventoryItem[],
): AssetTotals {
  const owned = items.filter((i) => !i.archived);
  const itemValue = owned.reduce((sum, i) => sum + (Number.isFinite(i.estimatedValue) ? i.estimatedValue : 0), 0);

  return {
    cash: finances.cash,
    bank: finances.bank,
    itemValue,
    total: finances.cash + finances.bank + itemValue,
    itemCount: owned.length,
  };
}

export function formatMoney(value: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    }).format(value);
  } catch {
    return `$${value.toLocaleString()}`;
  }
}

/** Masked stand-in used whenever a monetary value is hidden. */
export const MASKED_VALUE = '••••••';

export function itemsInLocation(items: InventoryItem[], locationId: string): InventoryItem[] {
  return items.filter((i) => !i.archived && i.locationId === locationId);
}

export function carriedItems(items: InventoryItem[]): InventoryItem[] {
  return items.filter((i) => !i.archived && i.carried);
}

/** Generic local placeholder art, so no real device photography is required. */
export function placeholderFor(category: string): string {
  const key = category.toLowerCase();
  if (key.includes('laptop') || key.includes('computer')) return 'laptop';
  if (key.includes('tablet')) return 'tablet';
  if (key.includes('desktop')) return 'desktop';
  if (key.includes('phone')) return 'phone';
  if (key.includes('audio') || key.includes('headphone')) return 'headphones';
  if (key.includes('document') || key.includes('id')) return 'card';
  if (key.includes('wallet')) return 'wallet';
  return 'generic';
}
