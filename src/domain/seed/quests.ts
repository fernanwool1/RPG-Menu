import type { Quest, QuestDifficulty, QuestPriority, QuestType } from '../types';
import { nodeId } from './skills';

/* ------------------------------------------------------------------ */
/* Quest seed                                                          */
/*                                                                     */
/* Deadlines are authored as an offset in days from the moment the     */
/* sample data is created, so the board always opens with something    */
/* overdue, something due today and something ahead - never a wall of  */
/* stale dates.                                                        */
/* ------------------------------------------------------------------ */

interface QuestSpec {
  slug: string;
  title: string;
  description: string;
  type: QuestType;
  category: string;
  status: Quest['status'];
  difficulty: QuestDifficulty;
  priority: QuestPriority;
  recurrence: Quest['recurrence'];
  characterXp: number;
  /** Days from now. Negative is in the past. */
  dueInDays?: number;
  atHour?: number;
  objectives: Array<[label: string, done: boolean]>;
  allocations?: Array<[slug: string, xp: number]>;
  rewards?: Array<{ kind: Quest['rewards'][number]['kind']; label: string }>;
  notes?: string;
  attachments?: Array<[label: string, url: string]>;
  /** Days ago the quest was completed / failed. */
  completedDaysAgo?: number;
  failedDaysAgo?: number;
}

const SPEC: QuestSpec[] = [
  {
    slug: 'spanish-essay',
    title: 'Spanish Literature Essay',
    description: 'Two thousand words on the assigned novel, in Spanish, with citations.',
    type: 'standard',
    category: 'Languages & Communication',
    status: 'active',
    difficulty: 'moderate',
    priority: 'high',
    recurrence: 'none',
    characterXp: 70,
    dueInDays: -1,
    atHour: 23,
    objectives: [
      ['Finish the novel', true],
      ['Outline the argument', true],
      ['Draft', false],
      ['Revise and cite', false],
    ],
    allocations: [
      ['spanish-writing', 45],
      ['academic-writing', 25],
    ],
    notes: 'Already a day past the deadline. Ask for the extension or take the hit.',
  },
  {
    slug: 'study-group',
    title: 'Run the Study Group',
    description: 'Facilitate the weekly session and make sure the quiet half also speaks.',
    type: 'side',
    category: 'Leadership & Service',
    status: 'completed',
    difficulty: 'easy',
    priority: 'normal',
    recurrence: 'weekly',
    characterXp: 35,
    dueInDays: -4,
    atHour: 16,
    completedDaysAgo: 5,
    objectives: [
      ['Set the agenda', true],
      ['Run the session', true],
      ['Write up what was decided', true],
    ],
    allocations: [
      ['discussion-facilitation', 20],
      ['moderation', 15],
    ],
  },
  {
    slug: 'data-pipeline',
    title: 'Nightly Data Pipeline',
    description: 'Build the ingestion job and leave it running unattended on a schedule.',
    type: 'main',
    category: 'Computer Science',
    status: 'completed',
    difficulty: 'hard',
    priority: 'high',
    recurrence: 'none',
    characterXp: 150,
    dueInDays: -12,
    atHour: 12,
    completedDaysAgo: 13,
    objectives: [
      ['Model the source schema', true],
      ['Write the transform', true],
      ['Schedule it and add alerting', true],
      ['Watch it run clean for a week', true],
    ],
    allocations: [
      ['pipelines', 70],
      ['sql', 50],
      ['python', 30],
    ],
  },
  {
    slug: 'reading-challenge',
    title: 'Finish the Systems Book',
    description: 'Four hundred pages, logged as you go rather than in one heroic weekend.',
    type: 'standard',
    category: 'Computer Science',
    status: 'completed',
    difficulty: 'moderate',
    priority: 'normal',
    recurrence: 'none',
    characterXp: 75,
    dueInDays: -20,
    atHour: 20,
    completedDaysAgo: 22,
    objectives: [
      ['Part one', true],
      ['Part two', true],
      ['Part three', true],
    ],
    allocations: [
      ['operating-systems', 45],
      ['networks', 30],
    ],
  },
  {
    slug: 'conference-talk',
    title: 'Submit a Conference Talk',
    description: 'Write and submit the proposal before the call for papers closed.',
    type: 'side',
    category: 'Languages & Communication',
    status: 'failed',
    difficulty: 'moderate',
    priority: 'low',
    recurrence: 'none',
    characterXp: 40,
    dueInDays: -9,
    atHour: 23,
    failedDaysAgo: 8,
    objectives: [
      ['Pick the topic', true],
      ['Write the abstract', true],
      ['Submit before the deadline', false],
    ],
    allocations: [['public-speaking', 40]],
    notes:
      'Missed the window. The XP already earned along the way stays earned - failing a quest never takes anything back.',
  },
  {
    slug: 'old-side-quest',
    title: 'Sort the Cable Box',
    description: 'An old side quest kept for reference. Archived rather than deleted.',
    type: 'side',
    category: 'Personal',
    status: 'archived',
    difficulty: 'trivial',
    priority: 'low',
    recurrence: 'none',
    characterXp: 25,
    objectives: [['Empty it out', false]],
  },

];

export const questId = (slug: string) => `qst_${slug}`;

function offsetIso(base: Date, days: number, hour: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

export function buildQuestSeed(at: string): Quest[] {
  const base = new Date(at);

  return SPEC.map((spec) => {
    const completedAt =
      spec.completedDaysAgo !== undefined ? offsetIso(base, -spec.completedDaysAgo, 12) : null;
    const failedAt =
      spec.failedDaysAgo !== undefined ? offsetIso(base, -spec.failedDaysAgo, 12) : null;

    return {
      id: questId(spec.slug),
      title: spec.title,
      description: spec.description,
      type: spec.type,
      category: spec.category,
      status: spec.status,
      objectives: spec.objectives.map(([label, done], i) => ({
        id: `obj_${spec.slug}_${i}`,
        label,
        done,
        order: i,
      })),
      skillAllocations: (spec.allocations ?? []).map(([slug, xp]) => ({
        skillNodeId: nodeId(slug),
        xp,
      })),
      deadline:
        spec.dueInDays === undefined ? null : offsetIso(base, spec.dueInDays, spec.atHour ?? 18),
      difficulty: spec.difficulty,
      priority: spec.priority,
      recurrence: spec.recurrence,
      characterXp: spec.characterXp,
      rewards: (spec.rewards ?? []).map((r, i) => ({
        id: `rwd_${spec.slug}_${i}`,
        kind: r.kind,
        label: r.label,
      })),
      notes: spec.notes,
      attachments: (spec.attachments ?? []).map(([label, url], i) => ({
        id: `att_${spec.slug}_${i}`,
        label,
        url,
      })),
      completedAt,
      failedAt,
      // Completed sample quests are already paid out, so re-opening one in the
      // UI can never mint their XP a second time.
      xpAwardedAt: completedAt,
      abilityId: null,
      createdAt: at,
      updatedAt: at,
    } satisfies Quest;
  });
}
