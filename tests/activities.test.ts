import { describe, expect, it } from 'vitest';

import { computeActivityXp, previewActivityXp } from '@/domain/activities';
import { buildActivityTemplateSeed, templateId } from '@/domain/seed/activities';
import type { ActivityTemplate } from '@/domain/types';

const templates = buildActivityTemplateSeed(new Date().toISOString());
const find = (slug: string): ActivityTemplate => {
  const template = templates.find((t) => t.id === templateId(slug));
  if (!template) throw new Error(`missing seeded template: ${slug}`);
  return template;
};

describe('seeded activity rules', () => {
  it('reading: 1 XP per page', () => {
    expect(computeActivityXp(find('reading').formula, 34)).toBe(34);
  });

  it('calories: 1 XP per 10 COMPLETE calories, partial blocks earn nothing', () => {
    const formula = find('calories-burned').formula;
    expect(computeActivityXp(formula, 380)).toBe(38);
    expect(computeActivityXp(formula, 95)).toBe(9); // not 9.5
    expect(computeActivityXp(formula, 9)).toBe(0);
  });

  it('cycling: 1 XP per minute', () => {
    expect(computeActivityXp(find('cycling').formula, 40)).toBe(40);
  });

  it('focused coding: 1 XP per 5 minutes', () => {
    const formula = find('focused-coding').formula;
    expect(computeActivityXp(formula, 90)).toBe(18);
    expect(computeActivityXp(formula, 4)).toBe(0);
  });

  it('language practice: 1 XP per 5 minutes', () => {
    expect(computeActivityXp(find('language-practice').formula, 45)).toBe(9);
  });

  it('service time: 1 XP per 5 minutes', () => {
    expect(computeActivityXp(find('service-time').formula, 90)).toBe(18);
  });

  it('coding exercise: configurable 5-15 XP, clamped to the band', () => {
    const formula = find('coding-exercise').formula;
    expect(computeActivityXp(formula, 1, 12)).toBe(12);
    expect(computeActivityXp(formula, 1, 99)).toBe(15); // clamped up
    expect(computeActivityXp(formula, 1, 1)).toBe(5); // clamped down
    expect(computeActivityXp(formula, 3, 10)).toBe(30); // three exercises
  });

  it('business case analysis: configurable 10-25 XP', () => {
    const formula = find('business-case-analysis').formula;
    expect(computeActivityXp(formula, 1, 20)).toBe(20);
    expect(computeActivityXp(formula, 1, 40)).toBe(25);
  });
});

describe('Creative Arts is output-only, at fixed rates', () => {
  const cases: Array<[slug: string, xp: number]> = [
    ['finished-drawing', 50],
    ['finished-poem', 50],
    ['finished-creative-writing', 50],
    ['selected-photograph', 5],
    ['simple-interface-design', 10],
    ['detailed-interface-design', 15],
  ];

  it.each(cases)('%s awards exactly %i XP per finished piece', (slug, xp) => {
    const template = find(slug);
    expect(computeActivityXp(template.formula, 1)).toBe(xp);
    expect(computeActivityXp(template.formula, 3)).toBe(xp * 3);
  });

  it.each(cases)('%s requires the piece to be finished', (slug) => {
    const template = find(slug);
    expect(template.requiresFinished).toBe(true);

    // Unfinished work earns nothing, however much of it there is.
    const unfinished = previewActivityXp(template, 5, undefined, false);
    expect(unfinished.xp).toBe(0);

    const finished = previewActivityXp(template, 1, undefined, true);
    expect(finished.xp).toBeGreaterThan(0);
  });

  it('is never scored on time', () => {
    for (const [slug] of cases) {
      expect(find(slug).unit).toBe('piece');
      expect(find(slug).formula.kind).toBe('fixed');
    }
  });
});

describe('preview explains the arithmetic', () => {
  it('says how far short of the next block the amount is', () => {
    const preview = previewActivityXp(find('calories-burned'), 95, undefined, false);
    expect(preview.xp).toBe(9);
    expect(preview.explanation).toContain('5 calories short');
  });

  it('refuses to preview XP for unfinished creative work', () => {
    const preview = previewActivityXp(find('finished-poem'), 1, undefined, false);
    expect(preview.xp).toBe(0);
    expect(preview.explanation).toContain('Unfinished');
  });
});

describe('negative and nonsense input', () => {
  it('never returns negative XP', () => {
    expect(computeActivityXp(find('reading').formula, -50)).toBe(0);
    expect(computeActivityXp(find('cycling').formula, Number.NaN)).toBe(0);
  });
});
