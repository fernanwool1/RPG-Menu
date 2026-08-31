import type { ActivityTemplate } from '../types';
import { domainId, nodeId } from './skills';

/* ------------------------------------------------------------------ */
/* Repeatable activity rules                                           */
/*                                                                     */
/* Every one of these is editable and archivable at runtime; they are  */
/* seeded defaults, not hard-coded behaviour. The formula object is    */
/* what the XP engine actually reads - see domain/activities.ts.       */
/* ------------------------------------------------------------------ */

interface TemplateSpec {
  slug: string;
  name: string;
  description: string;
  unit: ActivityTemplate['unit'];
  formula: ActivityTemplate['formula'];
  defaultNode?: string;
  restrictToDomain?: string;
  requiresFinished?: boolean;
}

const SPEC: TemplateSpec[] = [
  /* --- Reading and knowledge ------------------------------------- */
  {
    slug: 'reading',
    name: 'Reading',
    description: 'General reading, routed to whichever knowledge or language node it feeds.',
    unit: 'page',
    formula: { kind: 'rate', unitsPerXp: 1, xpPerBlock: 1 },
  },
  {
    slug: 'technical-reading',
    name: 'Technical Reading',
    description: 'Documentation, technical books and papers.',
    unit: 'page',
    formula: { kind: 'rate', unitsPerXp: 1, xpPerBlock: 1 },
    defaultNode: 'foundations',
    restrictToDomain: 'computer-science',
  },
  {
    slug: 'business-reading',
    name: 'Business Reading',
    description: 'Business books, reports and market material.',
    unit: 'page',
    formula: { kind: 'rate', unitsPerXp: 1, xpPerBlock: 1 },
    restrictToDomain: 'business-administration',
  },
  {
    slug: 'language-reading',
    name: 'Language Reading',
    description: 'Reading in a language you are building.',
    unit: 'page',
    formula: { kind: 'rate', unitsPerXp: 1, xpPerBlock: 1 },
    restrictToDomain: 'languages-communication',
  },
  {
    slug: 'music-theory-reading',
    name: 'Music Theory & History',
    description: 'Theory texts, history and score study.',
    unit: 'page',
    formula: { kind: 'rate', unitsPerXp: 1, xpPerBlock: 1 },
    defaultNode: 'music-history',
    restrictToDomain: 'music',
  },

  /* --- Physical --------------------------------------------------- */
  {
    slug: 'calories-burned',
    name: 'Calories Burned',
    description:
      'Any tracked physical effort. Partial blocks earn nothing - 95 calories is 9 XP.',
    unit: 'calorie',
    formula: { kind: 'rate', unitsPerXp: 10, xpPerBlock: 1 },
    restrictToDomain: 'physical-development',
  },
  {
    slug: 'cycling',
    name: 'Cycling',
    description:
      'Time in the saddle. Logging both the ride time and the calories from the same ride is intentional - they measure different things.',
    unit: 'minute',
    formula: { kind: 'rate', unitsPerXp: 1, xpPerBlock: 1 },
    defaultNode: 'cycling',
    restrictToDomain: 'physical-development',
  },

  /* --- Music ------------------------------------------------------ */
  {
    slug: 'instrument-practice',
    name: 'Instrument Practice',
    description: 'Time on the instrument, routed to whichever one you played.',
    unit: 'minute',
    formula: { kind: 'rate', unitsPerXp: 1, xpPerBlock: 1 },
    defaultNode: 'guitar',
    restrictToDomain: 'music',
  },
  {
    slug: 'ear-training',
    name: 'Ear Training',
    description: 'Interval, chord and transcription drilling.',
    unit: 'minute',
    formula: { kind: 'rate', unitsPerXp: 1, xpPerBlock: 1 },
    defaultNode: 'interval-recognition',
    restrictToDomain: 'music',
  },

  /* --- Computer science ------------------------------------------- */
  {
    slug: 'focused-coding',
    name: 'Focused Coding',
    description: 'Uninterrupted build time. Five minutes to the XP.',
    unit: 'minute',
    formula: { kind: 'rate', unitsPerXp: 5, xpPerBlock: 1 },
    defaultNode: 'app-development',
    restrictToDomain: 'computer-science',
  },
  {
    slug: 'coding-exercise',
    name: 'Coding Exercise',
    description: 'A single problem solved. Pick the award to match how hard it actually was.',
    unit: 'piece',
    formula: { kind: 'range', minXp: 5, maxXp: 15 },
    defaultNode: 'data-structures',
    restrictToDomain: 'computer-science',
  },

  /* --- Business --------------------------------------------------- */
  {
    slug: 'business-case-analysis',
    name: 'Business Case Analysis',
    description: 'A case worked end to end, with a recommendation.',
    unit: 'piece',
    formula: { kind: 'range', minXp: 10, maxXp: 25 },
    defaultNode: 'market-analysis',
    restrictToDomain: 'business-administration',
  },

  /* --- Language and communication --------------------------------- */
  {
    slug: 'language-practice',
    name: 'Speaking, Listening & Writing Practice',
    description: 'Active language practice of any kind.',
    unit: 'minute',
    formula: { kind: 'rate', unitsPerXp: 5, xpPerBlock: 1 },
    restrictToDomain: 'languages-communication',
  },

  /* --- Leadership and service -------------------------------------- */
  {
    slug: 'service-time',
    name: 'Tutoring, Volunteering & Coordination',
    description: 'Time spent teaching, mentoring, volunteering or coordinating a team.',
    unit: 'minute',
    formula: { kind: 'rate', unitsPerXp: 5, xpPerBlock: 1 },
    defaultNode: 'tutoring',
    restrictToDomain: 'leadership-service',
  },

  /* --- Creative Arts: OUTPUT ONLY ---------------------------------- */
  /* Time spent earns nothing here. Only a finished piece pays out,    */
  /* and every one of these carries requiresFinished.                  */
  {
    slug: 'finished-drawing',
    name: 'Finished Drawing',
    description: 'One completed drawing. Output only - time spent earns nothing.',
    unit: 'piece',
    formula: { kind: 'fixed', fixedXp: 50 },
    defaultNode: 'sketching',
    restrictToDomain: 'creative-arts',
    requiresFinished: true,
  },
  {
    slug: 'finished-poem',
    name: 'Finished Poem',
    description: 'One completed poem. Output only.',
    unit: 'piece',
    formula: { kind: 'fixed', fixedXp: 50 },
    defaultNode: 'poetry',
    restrictToDomain: 'creative-arts',
    requiresFinished: true,
  },
  {
    slug: 'finished-creative-writing',
    name: 'Finished Creative Writing',
    description: 'One completed piece of creative writing. Output only.',
    unit: 'piece',
    formula: { kind: 'fixed', fixedXp: 50 },
    defaultNode: 'short-fiction',
    restrictToDomain: 'creative-arts',
    requiresFinished: true,
  },
  {
    slug: 'selected-photograph',
    name: 'Selected Final Photograph',
    description: 'One photograph you actually selected as final. Output only.',
    unit: 'piece',
    formula: { kind: 'fixed', fixedXp: 5 },
    defaultNode: 'photo-composition',
    restrictToDomain: 'creative-arts',
    requiresFinished: true,
  },
  {
    slug: 'simple-interface-design',
    name: 'Simple Interface Design',
    description: 'One completed simple website or interface design. Output only.',
    unit: 'piece',
    formula: { kind: 'fixed', fixedXp: 10 },
    defaultNode: 'ui-design',
    restrictToDomain: 'creative-arts',
    requiresFinished: true,
  },
  {
    slug: 'detailed-interface-design',
    name: 'Detailed Interface Design',
    description: 'One completed detailed website or interface design. Output only.',
    unit: 'piece',
    formula: { kind: 'fixed', fixedXp: 15 },
    defaultNode: 'ui-design',
    restrictToDomain: 'creative-arts',
    requiresFinished: true,
  },
];

export const templateId = (slug: string) => `atp_${slug}`;

export function buildActivityTemplateSeed(at: string): ActivityTemplate[] {
  return SPEC.map((spec) => ({
    id: templateId(spec.slug),
    name: spec.name,
    description: spec.description,
    unit: spec.unit,
    formula: spec.formula,
    defaultNodeId: spec.defaultNode ? nodeId(spec.defaultNode) : null,
    restrictToDomainId: spec.restrictToDomain ? domainId(spec.restrictToDomain) : null,
    requiresFinished: spec.requiresFinished ?? false,
    archived: false,
    builtIn: true,
    createdAt: at,
    updatedAt: at,
  }));
}
