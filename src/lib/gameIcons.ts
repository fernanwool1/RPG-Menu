/**
 * The icon registry.
 *
 * Every icon path in the application resolves through this file. Components
 * ask for a record's id or slug, never for a file path, so the artwork can be
 * renamed, re-exported or re-optimised without touching a single component.
 *
 * Files are generated from the masters by `npm run icons`; see
 * scripts/build-icons.mjs.
 */

export const ICON_BASE = '/assets/icons';

/** Shown when a record has no mapping, rather than a wrong or missing icon. */
export const FALLBACK_ICON = `${ICON_BASE}/fallback.svg`;

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

export const navigationIcons = {
  abilities: `${ICON_BASE}/navigation/abilities.png`,
  skills: `${ICON_BASE}/navigation/skills.png`,
  inventory: `${ICON_BASE}/navigation/inventory.png`,
  map: `${ICON_BASE}/navigation/map.png`,
  quests: `${ICON_BASE}/navigation/quests.png`,
  character: `${ICON_BASE}/navigation/character.png`,
} as const;

export type NavigationIconKey = keyof typeof navigationIcons;

/* ------------------------------------------------------------------ */
/* Domains                                                             */
/*                                                                     */
/* One set of files, shared by Skills > Domains and Abilities > Paths.  */
/* The short keys are the ability-path slugs; the long keys are the     */
/* skill-domain slugs. Both point at the same file - there is no        */
/* duplicated artwork.                                                 */
/* ------------------------------------------------------------------ */

export const domainIcons: Record<string, string> = {
  'computer-science': `${ICON_BASE}/domains/computer-science.png`,

  business: `${ICON_BASE}/domains/business-administration.png`,
  'business-administration': `${ICON_BASE}/domains/business-administration.png`,

  music: `${ICON_BASE}/domains/music.png`,

  communication: `${ICON_BASE}/domains/languages-communication.png`,
  'languages-communication': `${ICON_BASE}/domains/languages-communication.png`,

  creative: `${ICON_BASE}/domains/creative-arts.png`,
  'creative-arts': `${ICON_BASE}/domains/creative-arts.png`,

  physical: `${ICON_BASE}/domains/physical-development.png`,
  'physical-development': `${ICON_BASE}/domains/physical-development.png`,

  leadership: `${ICON_BASE}/domains/leadership-service.png`,
  'leadership-service': `${ICON_BASE}/domains/leadership-service.png`,
};

/* ------------------------------------------------------------------ */
/* Abilities                                                           */
/*                                                                     */
/* Keyed by ability slug. Slugs are unique across every path, so this   */
/* stays flat - a lookup can never fall through to a neighbouring       */
/* path's artwork.                                                     */
/* ------------------------------------------------------------------ */

const abilityGroup = (group: string, slugs: string[]): Record<string, string> =>
  Object.fromEntries(slugs.map((slug) => [slug, `${ICON_BASE}/abilities/${group}/${slug}.png`]));

export const abilityIcons: Record<string, string> = {
  ...abilityGroup('computer-science', [
    'full-stack-builder',
    'data-pipeline-architect',
    'automation-engineer',
    'mobile-app-creator',
    'systems-problem-solver',
    'applied-ai-developer',
  ]),
  ...abilityGroup('business', [
    'client-prospector',
    'solution-seller',
    'operations-optimizer',
    'financial-planner',
    'strategic-planner',
    'venture-builder',
  ]),
  ...abilityGroup('music', [
    'live-guitar-performer',
    'multi-instrumentalist',
    'song-arranger',
    'play-by-ear',
    'music-composer',
    'ensemble-performer',
  ]),
  ...abilityGroup('creative', [
    'visual-storyteller',
    'poetry-crafter',
    'long-form-storyteller',
    'interface-designer',
    'brand-designer',
    'photographic-storyteller',
  ]),
  ...abilityGroup('communication', [
    'academic-researcher',
    'public-presenter',
    'discussion-facilitator',
    'teacher-and-mentor',
    'team-leader',
    'community-organizer',
  ]),
  ...abilityGroup('physical', [
    'endurance-cyclist',
    'strength-foundation',
    'mobility-practitioner',
    'consistent-athlete',
  ]),
};

/* ------------------------------------------------------------------ */
/* Slugs                                                               */
/* ------------------------------------------------------------------ */

/**
 * Normalises an id or a display name into a lookup slug.
 *
 * Records in this app already carry stable prefixed ids (`abl_`, `dom_`,
 * `pth_`), so the prefix is simply stripped. The display-name path exists only
 * as a migration convenience for records that predate stable ids - a display
 * name is never written back as an identifier.
 */
export function toIconSlug(value: string): string {
  return value
    .trim()
    .replace(/^(abl|dom|brn|nod|pth)_/, '')
    .toLowerCase()
    .normalize('NFD')
    // Strip combining diacritics, so an accented display name still resolves.
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/* ------------------------------------------------------------------ */
/* Resolution                                                          */
/* ------------------------------------------------------------------ */

/** Reported once per key so a missing mapping is visible but not noisy. */
const warned = new Set<string>();

function missing(kind: string, key: string): string {
  if (process.env.NODE_ENV !== 'production') {
    const id = `${kind}:${key}`;
    if (!warned.has(id)) {
      warned.add(id);
      // Deliberately not an exception: one unmapped record must never take the
      // page down, and it must never quietly borrow another record's artwork.
      console.warn(
        `[icons] No ${kind} icon for "${key}". Falling back to the generic mark. ` +
          `Add it to src/lib/gameIcons.ts.`,
      );
    }
  }
  return FALLBACK_ICON;
}

export function navigationIcon(key: string): string {
  return navigationIcons[key as NavigationIconKey] ?? missing('navigation', key);
}

/**
 * Domain / ability-path artwork. Accepts a `dom_` or `pth_` id, a bare slug,
 * or a display name.
 */
export function domainIcon(idOrName: string): string {
  const slug = toIconSlug(idOrName);
  return domainIcons[slug] ?? missing('domain', idOrName);
}

/** Ability artwork. Accepts an `abl_` id, a bare slug, or a display name. */
export function abilityIcon(idOrName: string): string {
  const slug = toIconSlug(idOrName);
  return abilityIcons[slug] ?? missing('ability', idOrName);
}

/** True when the value maps to real artwork, for tests and diagnostics. */
export function hasAbilityIcon(idOrName: string): boolean {
  return Boolean(abilityIcons[toIconSlug(idOrName)]);
}

export function hasDomainIcon(idOrName: string): boolean {
  return Boolean(domainIcons[toIconSlug(idOrName)]);
}

/* ------------------------------------------------------------------ */
/* Status colours                                                      */
/* ------------------------------------------------------------------ */

/**
 * Colour is a *reinforcement* of ability state, never the only signal - every
 * card and detail panel also prints the state in words.
 */
export const abilityIconColor: Record<string, string> = {
  mastered: 'var(--icon-cyan)',
  advanced: 'var(--icon-cyan)',
  unlocked: 'var(--icon-cyan)',
  eligible: 'var(--icon-cyan-bright)',
  developing: 'var(--icon-developing)',
  locked: 'var(--icon-locked)',
};

export const ICON_GOLD = 'var(--icon-gold)';
export const ICON_CYAN = 'var(--icon-cyan)';
export const ICON_CYAN_BRIGHT = 'var(--icon-cyan-bright)';
export const ICON_LOCKED = 'var(--icon-locked)';
