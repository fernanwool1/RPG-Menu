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
    slug: 'ship-portfolio',
    title: 'Ship the Portfolio Site',
    description:
      'Take the portfolio from a local folder to a real URL other people can open. Design is done; what is missing is the last mile.',
    type: 'main',
    category: 'Computer Science',
    status: 'active',
    difficulty: 'hard',
    priority: 'high',
    recurrence: 'none',
    characterXp: 160,
    dueInDays: 3,
    atHour: 21,
    objectives: [
      ['Finish the project detail pages', true],
      ['Wire the contact form to a real endpoint', true],
      ['Pass an accessibility pass on every page', false],
      ['Deploy to production and check on a phone', false],
    ],
    allocations: [
      ['nextjs', 60],
      ['ui-design', 40],
      ['app-development', 30],
    ],
    rewards: [{ kind: 'unlock-hint', label: 'Evidence toward Full-Stack Builder' }],
    attachments: [['Design file', 'https://example.com/portfolio-design']],
    notes: 'The accessibility pass is the part that will actually take time.',
  },
  {
    slug: 'algorithms-midterm',
    title: 'Algorithms Midterm',
    description:
      'Sit the midterm. Preparation is the quest; the exam itself is the final objective.',
    type: 'boss',
    category: 'Computer Science',
    status: 'active',
    difficulty: 'severe',
    priority: 'critical',
    recurrence: 'none',
    characterXp: 300,
    dueInDays: 6,
    atHour: 9,
    objectives: [
      ['Re-derive every sorting proof by hand', true],
      ['Work the graph problem set', false],
      ['Two full practice papers under time', false],
      ['Sit the exam', false],
    ],
    allocations: [
      ['algorithms', 140],
      ['discrete-math', 80],
      ['data-structures', 60],
    ],
  },
  {
    slug: 'daily-practice',
    title: 'Daily Instrument Practice',
    description: 'Thirty minutes on the instrument. Every day, however badly.',
    type: 'daily',
    category: 'Music',
    status: 'active',
    difficulty: 'easy',
    priority: 'normal',
    recurrence: 'daily',
    characterXp: 30,
    dueInDays: 0,
    atHour: 22,
    objectives: [
      ['Warm up and run scales', true],
      ['Work the hard bar slowly', false],
      ['Play one piece all the way through', false],
    ],
    allocations: [['guitar', 30]],
  },
  {
    slug: 'weekly-review',
    title: 'Weekly Review',
    description:
      'Close the week honestly: what moved, what stalled, what gets dropped rather than carried forward again.',
    type: 'weekly',
    category: 'Personal',
    status: 'planned',
    difficulty: 'trivial',
    priority: 'normal',
    recurrence: 'weekly',
    characterXp: 60,
    dueInDays: 2,
    atHour: 18,
    objectives: [
      ['Review every active quest', false],
      ['Log anything not yet logged', false],
      ['Set next week', false],
    ],
  },
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
    slug: 'client-proposal',
    title: 'Client Proposal Draft',
    description: 'Write the proposal for the produce distribution account and send it.',
    type: 'standard',
    category: 'Business Administration',
    status: 'planned',
    difficulty: 'moderate',
    priority: 'normal',
    recurrence: 'none',
    characterXp: 65,
    dueInDays: 8,
    atHour: 17,
    objectives: [
      ['Pull last quarter numbers', false],
      ['Draft the scope and pricing', false],
      ['Internal review', false],
      ['Send', false],
    ],
    allocations: [
      ['business-planning', 35],
      ['client-presentations', 30],
    ],
  },
  {
    slug: 'illustration-series',
    title: 'Finish the Illustration Series',
    description:
      'Six panels, one story. Unfinished panels are worth nothing, so the objective is finishing.',
    type: 'side',
    category: 'Creative Arts',
    status: 'active',
    difficulty: 'moderate',
    priority: 'low',
    recurrence: 'none',
    characterXp: 40,
    dueInDays: 14,
    atHour: 20,
    objectives: [
      ['Thumbnail all six', true],
      ['Line art', false],
      ['Colour and finish', false],
    ],
    allocations: [['digital-illustration', 40]],
  },
  {
    slug: 'century-ride',
    title: 'Build to a Long Ride',
    description: 'Work the weekly distance up until a long ride is routine rather than an event.',
    type: 'main',
    category: 'Physical Development',
    status: 'active',
    difficulty: 'hard',
    priority: 'normal',
    recurrence: 'weekly',
    characterXp: 120,
    dueInDays: 21,
    atHour: 8,
    objectives: [
      ['Three rides a week for a month', true],
      ['One long ride every weekend', true],
      ['Hold an even pace over distance', false],
    ],
    allocations: [
      ['cycling', 80],
      ['nutrition', 20],
    ],
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
