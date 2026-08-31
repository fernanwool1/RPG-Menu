import { existsSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  FALLBACK_ICON,
  abilityIcon,
  abilityIcons,
  domainIcon,
  domainIcons,
  hasAbilityIcon,
  hasDomainIcon,
  navigationIcon,
  navigationIcons,
  toIconSlug,
} from '@/lib/gameIcons';
import { buildSampleBundle } from '@/domain/seed';

/**
 * The registry is only useful if every path it hands out resolves to a file
 * that is actually on disk, and if every record in the app finds its own
 * artwork rather than a neighbour's. Both are checked against the real
 * filesystem here, so a renamed or missing export fails the suite.
 */

const PUBLIC = path.resolve(__dirname, '..', 'public');
const onDisk = (webPath: string) => existsSync(path.join(PUBLIC, webPath.replace(/^\//, '')));

const bundle = buildSampleBundle(new Date().toISOString());

describe('navigation icons', () => {
  const keys = ['abilities', 'skills', 'inventory', 'map', 'quests', 'character'] as const;

  it('covers all six routes', () => {
    expect(Object.keys(navigationIcons).sort()).toEqual([...keys].sort());
  });

  it.each(keys)('%s resolves to a file that exists', (key) => {
    const file = navigationIcon(key);
    expect(file).not.toBe(FALLBACK_ICON);
    expect(onDisk(file)).toBe(true);
  });
});

describe('domain icons', () => {
  it('ships exactly seven distinct images', () => {
    const distinct = new Set(Object.values(domainIcons));
    expect(distinct.size).toBe(7);
  });

  it('every mapped path exists on disk', () => {
    for (const file of new Set(Object.values(domainIcons))) {
      expect(onDisk(file), file).toBe(true);
    }
  });

  it('resolves every seeded skill domain', () => {
    for (const domain of bundle.domains) {
      expect(hasDomainIcon(domain.id), domain.id).toBe(true);
      expect(onDisk(domainIcon(domain.id)), domain.id).toBe(true);
    }
  });

  it('resolves every seeded ability path', () => {
    for (const abilityPath of bundle.paths) {
      expect(hasDomainIcon(abilityPath.id), abilityPath.id).toBe(true);
      expect(onDisk(domainIcon(abilityPath.id)), abilityPath.id).toBe(true);
    }
  });

  it('shares one file between Skills and Abilities rather than duplicating art', () => {
    // Abilities > "Business" and Skills > "Business Administration" are the
    // same emblem; likewise Communication, Creative and Physical.
    expect(domainIcon('pth_business')).toBe(domainIcon('dom_business-administration'));
    expect(domainIcon('pth_communication')).toBe(domainIcon('dom_languages-communication'));
    expect(domainIcon('pth_creative')).toBe(domainIcon('dom_creative-arts'));
    expect(domainIcon('pth_physical')).toBe(domainIcon('dom_physical-development'));
    expect(domainIcon('pth_computer-science')).toBe(domainIcon('dom_computer-science'));
    expect(domainIcon('pth_music')).toBe(domainIcon('dom_music'));
  });
});

describe('ability icons', () => {
  it('maps exactly 34 abilities', () => {
    expect(Object.keys(abilityIcons)).toHaveLength(34);
  });

  it('gives every ability its own distinct image', () => {
    const files = Object.values(abilityIcons);
    expect(new Set(files).size).toBe(files.length);
  });

  it('every mapped path exists on disk', () => {
    for (const [slug, file] of Object.entries(abilityIcons)) {
      expect(onDisk(file), `${slug} -> ${file}`).toBe(true);
    }
  });

  it('resolves all 34 seeded abilities, none falling back', () => {
    expect(bundle.abilities).toHaveLength(34);

    const unresolved: string[] = [];
    for (const ability of bundle.abilities) {
      if (!hasAbilityIcon(ability.id) || !onDisk(abilityIcon(ability.id))) {
        unresolved.push(ability.id);
      }
    }
    expect(unresolved).toEqual([]);
  });

  it('never serves one ability another ability’s artwork', () => {
    for (const ability of bundle.abilities) {
      const slug = ability.id.replace(/^abl_/, '');
      expect(abilityIcon(ability.id)).toContain(`/${slug}.png`);
    }
  });

  it('files an ability under its own path folder', () => {
    const folderForPath: Record<string, string> = {
      pth_computer_science: 'computer-science',
    };
    for (const ability of bundle.abilities) {
      const pathSlug = ability.pathId.replace(/^pth_/, '');
      const folder = folderForPath[ability.pathId] ?? pathSlug;
      expect(abilityIcon(ability.id), ability.id).toContain(`/abilities/${folder}/`);
    }
  });
});

describe('slug normalisation', () => {
  it('strips record prefixes', () => {
    expect(toIconSlug('abl_full-stack-builder')).toBe('full-stack-builder');
    expect(toIconSlug('dom_computer-science')).toBe('computer-science');
    expect(toIconSlug('pth_music')).toBe('music');
  });

  it('converts display names without being used as an identifier', () => {
    expect(toIconSlug('Computer Science')).toBe('computer-science');
    expect(toIconSlug('Languages & Communication')).toBe('languages-and-communication');
    expect(toIconSlug('  Full-Stack Builder  ')).toBe('full-stack-builder');
  });

  it('handles accents', () => {
    expect(toIconSlug('Zampoña')).toBe('zampona');
  });
});

describe('unknown records', () => {
  it('fall back to the generic mark rather than a wrong icon', () => {
    expect(abilityIcon('abl_does-not-exist')).toBe(FALLBACK_ICON);
    expect(domainIcon('dom_does-not-exist')).toBe(FALLBACK_ICON);
    expect(navigationIcon('nope')).toBe(FALLBACK_ICON);
  });

  it('ships the fallback mark itself', () => {
    expect(onDisk(FALLBACK_ICON)).toBe(true);
  });

  it('does not throw', () => {
    expect(() => abilityIcon('')).not.toThrow();
    expect(() => domainIcon('  ')).not.toThrow();
  });
});
