import { CATEGORY_ICON } from '../daily';
import type { DailyQuestCategory, DailyQuestDefinition, DailyTarget, Weekday } from '../types';

/* ------------------------------------------------------------------ */
/* The rotating Daily Quest pool                                       */
/*                                                                     */
/* Nineteen binary quests. None of them carries a numerical tracker -   */
/* trackers belong to the Daily Check alone, which is what keeps the   */
/* same effort from being converted into XP twice. "Complete the       */
/* Planned Workout" pays its flat Character XP and nothing else; the   */
/* calories from that workout are converted once, in the Daily Check.  */
/* ------------------------------------------------------------------ */

/** Seeded Character XP for every rotating quest. Editable per definition. */
export const DEFAULT_DAILY_QUEST_XP = 10;

interface DailyQuestSpec {
  slug: string;
  name: string;
  description: string;
  category: DailyQuestCategory;
  /** Overrides the category icon when a more specific one reads better. */
  icon?: string;
  pinned?: boolean;
  weekdays?: Weekday[];
}

const SPEC: DailyQuestSpec[] = [
  {
    slug: 'plan-the-day',
    name: 'Plan the Day',
    description: "Choose today's primary objective and arrange active quests.",
    category: 'organization',
    icon: 'target',
    pinned: true,
  },
  {
    slug: 'priority-objective',
    name: 'Complete One Priority Objective',
    description: 'Complete at least one objective from a High or Critical priority quest.',
    category: 'organization',
    icon: 'check',
  },
  {
    slug: 'review-class-notes',
    name: 'Review Class Notes',
    description: 'Review notes from one current class.',
    category: 'academic',
    icon: 'book',
  },
  {
    slug: 'programming-practice',
    name: 'Programming Practice',
    description: 'Complete one focused programming-practice session.',
    category: 'technical',
    icon: 'code',
  },
  {
    slug: 'math-or-logic',
    name: 'Solve One Math or Logic Problem',
    description:
      'Independently solve one meaningful mathematics, algorithm, or logic problem.',
    category: 'technical',
    icon: 'sigma',
  },
  {
    slug: 'advance-personal-project',
    name: 'Advance a Personal Project',
    description: 'Make one concrete improvement to an active personal project.',
    category: 'technical',
    icon: 'rocket',
  },
  {
    slug: 'business-development',
    name: 'Business Development',
    description:
      'Complete one business-development action, such as prospect research, company analysis, proposal improvement, or portfolio preparation.',
    category: 'business',
    icon: 'briefcase',
  },
  {
    slug: 'language-practice',
    name: 'Language Practice',
    description:
      'Complete one meaningful activity in English, Italian, Japanese, or another selected language.',
    category: 'academic',
    icon: 'message',
  },
  {
    slug: 'music-knowledge',
    name: 'Music Knowledge',
    description:
      'Study one concept related to music theory, history, culture, analysis, or ear training.',
    category: 'music',
    icon: 'music',
  },
  {
    slug: 'planned-workout',
    name: 'Complete the Planned Workout',
    description: 'Finish the workout planned for that day.',
    category: 'physical',
    icon: 'dumbbell',
  },
  {
    slug: 'mobility-stretching',
    name: 'Mobility and Stretching',
    description: 'Complete one stretching or mobility routine.',
    category: 'physical',
    icon: 'waves',
  },
  {
    slug: 'hydration-check',
    name: 'Hydration Check',
    description: 'Meet your configured hydration goal.',
    category: 'personal-care',
    icon: 'waves',
  },
  {
    slug: 'balanced-meal',
    name: 'Eat a Balanced Meal',
    description: 'Eat at least one proper balanced meal.',
    category: 'personal-care',
    icon: 'apple',
  },
  {
    slug: 'skin-care',
    name: 'Skin-Care Routine',
    description: 'Complete your configured skin-care routine.',
    category: 'personal-care',
    icon: 'sparkles',
  },
  {
    slug: 'reset-workspace',
    name: 'Reset the Workspace',
    description: 'Clean and organize your primary desk or study area.',
    category: 'organization',
    icon: 'layers',
  },
  {
    slug: 'prepare-loadout',
    name: 'Prepare the Loadout',
    description:
      "Confirm tomorrow's required Inventory items are prepared - laptop, iPad, phone, headphones, ID, wallet, or whatever else you have selected.",
    category: 'organization',
    icon: 'backpack',
  },
  {
    slug: 'budget-check',
    name: 'Budget Check',
    description: "Review today's spending and update Cash or Bank values if necessary.",
    category: 'financial',
    icon: 'coins',
  },
  {
    slug: 'social-initiative',
    name: 'Social Initiative',
    description:
      'Initiate at least one greeting, conversation, introduction, or meaningful social interaction.',
    category: 'social',
    icon: 'users',
  },
  {
    slug: 'evening-review',
    name: 'Evening Review',
    description:
      "Review the day, record anything unfinished, and prepare tomorrow's first objective.",
    category: 'organization',
    icon: 'moon',
    pinned: true,
  },
];

export const dailyQuestDefinitionId = (slug: string) => `dqd_${slug}`;

export function buildDailyQuestDefinitions(at: string): DailyQuestDefinition[] {
  return SPEC.map((spec, index) => ({
    id: dailyQuestDefinitionId(spec.slug),
    name: spec.name,
    description: spec.description,
    category: spec.category,
    icon: spec.icon ?? CATEGORY_ICON[spec.category],
    characterXp: DEFAULT_DAILY_QUEST_XP,
    active: true,
    pinned: spec.pinned ?? false,
    weekdays: spec.weekdays ?? [],
    // Linking is opt-in. Left unset, a rotating quest pays Character XP only,
    // which is what prevents it double-counting work tracked elsewhere.
    linkedSkillNodeId: null,
    awardsSkillXp: false,
    skillXp: 0,
    order: index,
    createdAt: at,
    updatedAt: at,
  }));
}

/** Seeded daily targets, all editable. */
export function buildDailyTargets(): DailyTarget {
  return {
    readingPages: 20,
    calories: 400,
    instrumentMinutes: 20,
    defaultReadingNodeId: 'nod_english-reading',
    defaultCaloriesNodeId: 'nod_cycling',
    defaultInstrumentNodeId: 'nod_guitar',
  };
}

/** Instruments offered by the Daily Check picker, by skill node id. */
export const SEED_INSTRUMENT_NODE_IDS = [
  'nod_guitar',
  'nod_piano',
  'nod_zampona',
  'nod_kalimba',
  'nod_violin',
  'nod_ukulele',
  'nod_pipa',
  'nod_harp',
];
