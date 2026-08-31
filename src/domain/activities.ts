import type { ActivityFormula, ActivityTemplate, ActivityUnit } from './types';

export const UNIT_LABEL: Record<ActivityUnit, string> = {
  page: 'pages',
  minute: 'minutes',
  calorie: 'calories',
  piece: 'finished pieces',
  session: 'sessions',
};

export const UNIT_LABEL_SINGULAR: Record<ActivityUnit, string> = {
  page: 'page',
  minute: 'minute',
  calorie: 'calorie',
  piece: 'finished piece',
  session: 'session',
};

/**
 * XP for one activity entry.
 *
 * `amount` is the raw user input in the template's unit. `chosenXp` only
 * applies to range formulas, where the user picks a value inside the band.
 *
 * Rate formulas floor deliberately: "1 XP per 10 complete calories" means 95
 * calories is 9 XP, not 9.5. Partial blocks earn nothing.
 */
export function computeActivityXp(
  formula: ActivityFormula,
  amount: number,
  chosenXp?: number,
): number {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;

  switch (formula.kind) {
    case 'rate': {
      const blocks = Math.floor(safeAmount / formula.unitsPerXp);
      return Math.max(0, blocks * formula.xpPerBlock);
    }
    case 'fixed': {
      const count = Math.floor(safeAmount);
      return Math.max(0, count * formula.fixedXp);
    }
    case 'range': {
      const count = Math.max(0, Math.floor(safeAmount));
      const picked = clamp(
        Math.floor(chosenXp ?? formula.minXp),
        formula.minXp,
        formula.maxXp,
      );
      return count * picked;
    }
    default:
      return 0;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Human-readable rule, shown next to every template so the maths is visible. */
export function describeFormula(template: ActivityTemplate): string {
  const { formula, unit } = template;
  switch (formula.kind) {
    case 'rate': {
      const per =
        formula.unitsPerXp === 1
          ? UNIT_LABEL_SINGULAR[unit]
          : `${formula.unitsPerXp} ${UNIT_LABEL[unit]}`;
      const xp = formula.xpPerBlock === 1 ? '1 XP' : `${formula.xpPerBlock} XP`;
      return `${xp} per ${per}`;
    }
    case 'fixed':
      return `${formula.fixedXp} XP per ${UNIT_LABEL_SINGULAR[unit]}`;
    case 'range':
      return `${formula.minXp}-${formula.maxXp} XP per ${UNIT_LABEL_SINGULAR[unit]}`;
    default:
      return '';
  }
}

/**
 * Preview string for the log form, so the user sees the award before saving
 * and understands why a partial block earned nothing.
 */
export function previewActivityXp(
  template: ActivityTemplate,
  amount: number,
  chosenXp: number | undefined,
  finished: boolean,
): { xp: number; explanation: string } {
  if (template.requiresFinished && !finished) {
    return {
      xp: 0,
      explanation: 'Unfinished work earns no XP. Mark the piece finished to award it.',
    };
  }

  const xp = computeActivityXp(template.formula, amount, chosenXp);

  if (template.formula.kind === 'rate') {
    const { unitsPerXp } = template.formula;
    const leftover = Math.max(0, Math.floor(amount)) % unitsPerXp;
    const base = `${amount || 0} ${UNIT_LABEL[template.unit]} at ${describeFormula(template)}`;
    return {
      xp,
      explanation:
        leftover > 0 && unitsPerXp > 1
          ? `${base}. ${leftover} ${UNIT_LABEL[template.unit]} short of the next block.`
          : `${base}.`,
    };
  }

  return { xp, explanation: `${describeFormula(template)}.` };
}
