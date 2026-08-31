import { cumulativeNodeXpForLevel } from '../progression';
import type { AttributeKey, SkillBranch, SkillDomain, SkillNode } from '../types';

/* ------------------------------------------------------------------ */
/* Authoring helpers                                                   */
/*                                                                     */
/* Seed nodes are authored by the LEVEL they should start at. The      */
/* baseline XP is computed from the level curve, so retuning the curve */
/* never leaves the sample data stranded at the wrong level.           */
/* ------------------------------------------------------------------ */

interface NodeSpec {
  slug: string;
  name: string;
  icon: string;
  level: number;
  /** XP earned into the current level, on top of the level baseline. */
  into?: number;
  parents?: string[];
  focus?: boolean;
  evidence?: string[];
  notes?: string;
}

interface BranchSpec {
  slug: string;
  name: string;
  icon: string;
  nodes: NodeSpec[];
}

interface DomainSpec {
  slug: string;
  name: string;
  icon: string;
  attributeWeights: Partial<Record<AttributeKey, number>>;
  branches: BranchSpec[];
}

const SPEC: DomainSpec[] = [
  {
    slug: 'computer-science',
    name: 'Computer Science',
    icon: 'monitor',
    attributeWeights: { knowledge: 1, discipline: 0.4, adaptability: 0.4 },
    branches: [
      {
        slug: 'programming',
        name: 'Programming',
        icon: 'code',
        nodes: [
          { slug: 'foundations', name: 'Foundations', icon: 'pillar', level: 9 },
          {
            slug: 'python',
            name: 'Python',
            icon: 'python',
            level: 7,
            into: 240,
            parents: ['foundations'],
            evidence: ['Academic coursework', 'Data engineering internship', 'Personal applications'],
          },
          { slug: 'cpp', name: 'C++', icon: 'cpp', level: 5, parents: ['foundations'] },
          { slug: 'javascript', name: 'JavaScript', icon: 'js', level: 5, parents: ['foundations'] },
          {
            slug: 'data-structures',
            name: 'Data Structures',
            icon: 'layers',
            level: 5,
            parents: ['python', 'cpp', 'javascript'],
          },
          {
            slug: 'oop',
            name: 'Object-Oriented Programming',
            icon: 'code',
            level: 7,
            parents: ['data-structures'],
          },
          {
            slug: 'app-development',
            name: 'Application Development',
            icon: 'rocket',
            level: 2,
            parents: ['oop'],
            focus: true,
          },
        ],
      },
      {
        slug: 'web-development',
        name: 'Web Development',
        icon: 'globe',
        nodes: [
          { slug: 'html-css', name: 'HTML & CSS', icon: 'globe', level: 7 },
          { slug: 'dom-scripting', name: 'DOM Scripting', icon: 'js', level: 6, parents: ['html-css'] },
          { slug: 'react', name: 'React', icon: 'atom', level: 6, parents: ['dom-scripting'] },
          { slug: 'nextjs', name: 'Next.js', icon: 'rocket', level: 5, parents: ['react'] },
          { slug: 'web-apis', name: 'Web APIs', icon: 'plug', level: 5, parents: ['dom-scripting'] },
        ],
      },
      {
        slug: 'data-engineering',
        name: 'Data Engineering',
        icon: 'database',
        nodes: [
          { slug: 'databases', name: 'Databases', icon: 'database', level: 6 },
          { slug: 'sql', name: 'SQL', icon: 'table', level: 5, parents: ['databases'] },
          { slug: 'pipelines', name: 'Data Pipelines', icon: 'workflow', level: 5, parents: ['sql'] },
          { slug: 'warehousing', name: 'Warehousing', icon: 'boxes', level: 3, parents: ['pipelines'] },
        ],
      },
      {
        slug: 'computer-systems',
        name: 'Computer Systems',
        icon: 'cpu',
        nodes: [
          { slug: 'operating-systems', name: 'Operating Systems', icon: 'cpu', level: 5 },
          { slug: 'networks', name: 'Networks', icon: 'network', level: 5 },
          { slug: 'shell', name: 'Shell & Tooling', icon: 'terminal', level: 4, parents: ['operating-systems'] },
          { slug: 'security', name: 'Security Basics', icon: 'shield', level: 3, parents: ['networks'] },
        ],
      },
      {
        slug: 'theory-mathematics',
        name: 'Theory & Mathematics',
        icon: 'sigma',
        nodes: [
          { slug: 'discrete-math', name: 'Discrete Mathematics', icon: 'sigma', level: 6 },
          { slug: 'linear-algebra', name: 'Linear Algebra', icon: 'grid', level: 6 },
          { slug: 'calculus', name: 'Calculus', icon: 'chart', level: 5 },
          { slug: 'algorithms', name: 'Algorithms', icon: 'workflow', level: 5, parents: ['discrete-math'] },
          { slug: 'statistics', name: 'Statistics', icon: 'chart', level: 4 },
        ],
      },
      {
        slug: 'artificial-intelligence',
        name: 'Artificial Intelligence',
        icon: 'brain',
        nodes: [
          { slug: 'ml-foundations', name: 'ML Foundations', icon: 'brain', level: 4 },
          { slug: 'neural-networks', name: 'Neural Networks', icon: 'network', level: 4, parents: ['ml-foundations'] },
          { slug: 'prompt-engineering', name: 'Prompt Engineering', icon: 'sparkles', level: 5 },
          { slug: 'applied-ai', name: 'Applied AI Systems', icon: 'rocket', level: 3, parents: ['prompt-engineering'] },
        ],
      },
    ],
  },
  {
    slug: 'music',
    name: 'Music',
    icon: 'music',
    attributeWeights: { creativity: 1, discipline: 0.5, knowledge: 0.3 },
    branches: [
      {
        // Named "Performance" because the Daily Check routes instrument
        // practice to Music > Performance > the selected instrument. The slug
        // is unchanged so existing ids and saved data stay valid.
        slug: 'instrumental-practice',
        name: 'Performance',
        icon: 'guitar',
        nodes: [
          { slug: 'guitar', name: 'Guitar', icon: 'guitar', level: 8 },
          { slug: 'piano', name: 'Piano', icon: 'piano', level: 7 },
          { slug: 'bass', name: 'Bass', icon: 'guitar', level: 5 },
          { slug: 'pipa', name: 'Pipa', icon: 'music', level: 3 },
          // Seeded instruments the user has not started. Level 0 keeps them
          // Undiscovered, so they neither claim XP nor shift the branch level.
          { slug: 'zampona', name: 'Zampoña', icon: 'music', level: 0 },
          { slug: 'kalimba', name: 'Kalimba', icon: 'music', level: 0 },
          { slug: 'violin', name: 'Violin', icon: 'music', level: 0 },
          { slug: 'ukulele', name: 'Ukulele', icon: 'guitar', level: 0 },
          { slug: 'harp', name: 'Harp', icon: 'music', level: 0 },
        ],
      },
      {
        slug: 'theory-history',
        name: 'Theory & History',
        icon: 'book',
        nodes: [
          { slug: 'harmony', name: 'Harmony', icon: 'music', level: 7 },
          { slug: 'music-history', name: 'Music History', icon: 'book', level: 7 },
          { slug: 'notation', name: 'Notation', icon: 'pen', level: 6 },
          { slug: 'score-analysis', name: 'Score Analysis', icon: 'search', level: 5, parents: ['harmony'] },
        ],
      },
      {
        slug: 'ear-training',
        name: 'Ear Training',
        icon: 'ear',
        nodes: [
          { slug: 'interval-recognition', name: 'Interval Recognition', icon: 'ear', level: 7 },
          { slug: 'chord-recognition', name: 'Chord Recognition', icon: 'ear', level: 7 },
          { slug: 'transcription', name: 'Transcription', icon: 'pen', level: 5, parents: ['chord-recognition'] },
          { slug: 'relative-pitch', name: 'Relative Pitch', icon: 'music', level: 5 },
        ],
      },
      {
        slug: 'composition',
        name: 'Composition & Arrangement',
        icon: 'pen',
        nodes: [
          { slug: 'songwriting', name: 'Songwriting', icon: 'pen', level: 6 },
          { slug: 'arranging', name: 'Arranging', icon: 'layers', level: 6 },
          { slug: 'lyric-writing', name: 'Lyric Writing', icon: 'quote', level: 5 },
          { slug: 'production', name: 'Production', icon: 'sliders', level: 4 },
        ],
      },
    ],
  },
  {
    slug: 'business-administration',
    name: 'Business Administration',
    icon: 'briefcase',
    attributeWeights: { knowledge: 0.6, discipline: 0.8, communication: 0.5, adaptability: 0.3 },
    branches: [
      {
        slug: 'sales-clients',
        name: 'Sales & Client Development',
        icon: 'handshake',
        nodes: [
          { slug: 'prospecting', name: 'Prospecting', icon: 'search', level: 7 },
          { slug: 'negotiation', name: 'Negotiation', icon: 'handshake', level: 7 },
          { slug: 'client-presentations', name: 'Client Presentations', icon: 'presentation', level: 6 },
          { slug: 'crm', name: 'CRM Discipline', icon: 'table', level: 5 },
        ],
      },
      {
        slug: 'operations',
        name: 'Operations',
        icon: 'workflow',
        nodes: [
          { slug: 'process-design', name: 'Process Design', icon: 'workflow', level: 7 },
          { slug: 'logistics', name: 'Logistics', icon: 'truck', level: 7 },
          { slug: 'vendor-management', name: 'Vendor Management', icon: 'handshake', level: 5 },
          { slug: 'quality-control', name: 'Quality Control', icon: 'shield', level: 5 },
        ],
      },
      {
        slug: 'finance',
        name: 'Finance & Accounting',
        icon: 'coins',
        nodes: [
          { slug: 'budgeting', name: 'Budgeting', icon: 'coins', level: 7 },
          { slug: 'financial-analysis', name: 'Financial Analysis', icon: 'chart', level: 7 },
          { slug: 'accounting', name: 'Accounting', icon: 'table', level: 6 },
          { slug: 'capital-planning', name: 'Capital Planning', icon: 'bank', level: 4 },
        ],
      },
      {
        slug: 'strategy',
        name: 'Strategy & Ventures',
        icon: 'target',
        nodes: [
          { slug: 'market-analysis', name: 'Market Analysis', icon: 'search', level: 6 },
          { slug: 'business-planning', name: 'Business Planning', icon: 'target', level: 6 },
          { slug: 'venture-building', name: 'Venture Building', icon: 'rocket', level: 5 },
        ],
      },
    ],
  },
  {
    slug: 'languages-communication',
    name: 'Languages & Communication',
    icon: 'message',
    attributeWeights: { communication: 1, knowledge: 0.5, adaptability: 0.4 },
    branches: [
      {
        slug: 'spanish',
        name: 'Spanish',
        icon: 'message',
        nodes: [
          { slug: 'spanish-speaking', name: 'Spanish Speaking', icon: 'mic', level: 10 },
          { slug: 'spanish-reading', name: 'Spanish Reading', icon: 'book', level: 9 },
          { slug: 'spanish-writing', name: 'Spanish Writing', icon: 'pen', level: 8 },
        ],
      },
      {
        slug: 'english',
        name: 'English',
        icon: 'message',
        nodes: [
          { slug: 'english-reading', name: 'English Reading', icon: 'book', level: 8 },
          { slug: 'english-speaking', name: 'English Speaking', icon: 'mic', level: 8 },
          { slug: 'english-listening', name: 'English Listening', icon: 'ear', level: 8 },
          { slug: 'english-writing', name: 'English Writing', icon: 'pen', level: 7 },
        ],
      },
      {
        slug: 'mandarin',
        name: 'Mandarin',
        icon: 'message',
        nodes: [
          { slug: 'mandarin-speaking', name: 'Mandarin Speaking', icon: 'mic', level: 3 },
          { slug: 'mandarin-reading', name: 'Mandarin Reading', icon: 'book', level: 3 },
          { slug: 'mandarin-characters', name: 'Character Writing', icon: 'pen', level: 2 },
        ],
      },
      {
        slug: 'writing-rhetoric',
        name: 'Writing & Rhetoric',
        icon: 'pen',
        nodes: [
          { slug: 'academic-writing', name: 'Academic Writing', icon: 'graduation', level: 7 },
          { slug: 'public-speaking', name: 'Public Speaking', icon: 'presentation', level: 7 },
          { slug: 'argumentation', name: 'Argumentation', icon: 'message', level: 6 },
          { slug: 'editing', name: 'Editing', icon: 'search', level: 5 },
        ],
      },
    ],
  },
  {
    slug: 'creative-arts',
    name: 'Creative Arts',
    icon: 'palette',
    attributeWeights: { creativity: 1, communication: 0.3, adaptability: 0.3 },
    branches: [
      {
        slug: 'drawing',
        name: 'Drawing & Illustration',
        icon: 'pen',
        nodes: [
          { slug: 'sketching', name: 'Sketching', icon: 'pen', level: 7 },
          { slug: 'figure-drawing', name: 'Figure Drawing', icon: 'palette', level: 6 },
          { slug: 'digital-illustration', name: 'Digital Illustration', icon: 'palette', level: 6 },
          { slug: 'color-theory', name: 'Color Theory', icon: 'palette', level: 4 },
        ],
      },
      {
        slug: 'creative-writing',
        name: 'Creative Writing',
        icon: 'quote',
        nodes: [
          { slug: 'poetry', name: 'Poetry', icon: 'quote', level: 7 },
          { slug: 'short-fiction', name: 'Short Fiction', icon: 'book', level: 6 },
          { slug: 'worldbuilding', name: 'Worldbuilding', icon: 'map', level: 5 },
        ],
      },
      {
        slug: 'photography',
        name: 'Photography',
        icon: 'camera',
        nodes: [
          { slug: 'photo-composition', name: 'Composition', icon: 'camera', level: 6 },
          { slug: 'photo-editing', name: 'Photo Editing', icon: 'sliders', level: 5 },
          { slug: 'lighting', name: 'Lighting', icon: 'lamp', level: 4 },
        ],
      },
      {
        slug: 'design',
        name: 'Design',
        icon: 'layout',
        nodes: [
          { slug: 'ui-design', name: 'Interface Design', icon: 'layout', level: 7 },
          { slug: 'brand-design', name: 'Brand Design', icon: 'badge', level: 6 },
          { slug: 'typography', name: 'Typography', icon: 'type', level: 6 },
          { slug: 'motion-design', name: 'Motion Design', icon: 'sparkles', level: 4 },
        ],
      },
    ],
  },
  {
    slug: 'physical-development',
    name: 'Physical Development',
    icon: 'dumbbell',
    attributeWeights: { endurance: 1, discipline: 0.6 },
    branches: [
      {
        slug: 'endurance',
        name: 'Endurance',
        icon: 'activity',
        nodes: [
          { slug: 'cycling', name: 'Cycling', icon: 'bike', level: 6 },
          { slug: 'running', name: 'Running', icon: 'activity', level: 5 },
          { slug: 'swimming', name: 'Swimming', icon: 'waves', level: 3 },
        ],
      },
      {
        slug: 'strength',
        name: 'Strength',
        icon: 'dumbbell',
        nodes: [
          { slug: 'calisthenics', name: 'Calisthenics', icon: 'dumbbell', level: 5 },
          { slug: 'weight-training', name: 'Weight Training', icon: 'dumbbell', level: 5 },
          { slug: 'core-training', name: 'Core Training', icon: 'activity', level: 4 },
        ],
      },
      {
        slug: 'mobility',
        name: 'Mobility',
        icon: 'waves',
        nodes: [
          { slug: 'stretching', name: 'Stretching', icon: 'waves', level: 5 },
          { slug: 'balance', name: 'Balance', icon: 'activity', level: 4 },
        ],
      },
      {
        slug: 'recovery-habits',
        name: 'Recovery & Habits',
        icon: 'moon',
        nodes: [
          { slug: 'sleep-discipline', name: 'Sleep Discipline', icon: 'moon', level: 6 },
          { slug: 'nutrition', name: 'Nutrition', icon: 'apple', level: 5 },
        ],
      },
    ],
  },
  {
    slug: 'leadership-service',
    name: 'Leadership & Service',
    icon: 'users',
    attributeWeights: { communication: 0.9, discipline: 0.5, adaptability: 0.4, knowledge: 0.2 },
    branches: [
      {
        slug: 'teaching-mentoring',
        name: 'Teaching & Mentoring',
        icon: 'graduation',
        nodes: [
          { slug: 'tutoring', name: 'Tutoring', icon: 'graduation', level: 8 },
          { slug: 'mentoring', name: 'Mentoring', icon: 'users', level: 7 },
          { slug: 'curriculum-design', name: 'Curriculum Design', icon: 'book', level: 6 },
        ],
      },
      {
        slug: 'team-leadership',
        name: 'Team Leadership',
        icon: 'users',
        nodes: [
          { slug: 'delegation', name: 'Delegation', icon: 'users', level: 7 },
          { slug: 'team-coordination', name: 'Team Coordination', icon: 'workflow', level: 7 },
          { slug: 'conflict-resolution', name: 'Conflict Resolution', icon: 'handshake', level: 6 },
        ],
      },
      {
        slug: 'community-service',
        name: 'Community Service',
        icon: 'heart',
        nodes: [
          { slug: 'volunteering', name: 'Volunteering', icon: 'heart', level: 7 },
          { slug: 'community-organizing', name: 'Community Organizing', icon: 'users', level: 6 },
          { slug: 'outreach', name: 'Outreach', icon: 'message', level: 6 },
        ],
      },
      {
        slug: 'facilitation',
        name: 'Facilitation',
        icon: 'presentation',
        nodes: [
          { slug: 'discussion-facilitation', name: 'Discussion Facilitation', icon: 'message', level: 7 },
          { slug: 'workshop-design', name: 'Workshop Design', icon: 'presentation', level: 6 },
          { slug: 'moderation', name: 'Moderation', icon: 'shield', level: 6 },
        ],
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Materialisation                                                     */
/* ------------------------------------------------------------------ */

export const domainId = (slug: string) => `dom_${slug}`;
export const branchId = (slug: string) => `brn_${slug}`;
export const nodeId = (slug: string) => `nod_${slug}`;

export interface SeededSkills {
  domains: SkillDomain[];
  branches: SkillBranch[];
  nodes: SkillNode[];
}

export function buildSkillSeed(at: string): SeededSkills {
  const domains: SkillDomain[] = [];
  const branches: SkillBranch[] = [];
  const nodes: SkillNode[] = [];

  SPEC.forEach((domain, domainIndex) => {
    domains.push({
      id: domainId(domain.slug),
      name: domain.name,
      icon: domain.icon,
      order: domainIndex,
      archived: false,
      attributeWeights: domain.attributeWeights,
      createdAt: at,
      updatedAt: at,
    });

    domain.branches.forEach((branch, branchIndex) => {
      branches.push({
        id: branchId(branch.slug),
        domainId: domainId(domain.slug),
        name: branch.name,
        icon: branch.icon,
        order: branchIndex,
        archived: false,
        createdAt: at,
        updatedAt: at,
      });

      branch.nodes.forEach((node, nodeIndex) => {
        nodes.push({
          id: nodeId(node.slug),
          branchId: branchId(branch.slug),
          name: node.name,
          icon: node.icon,
          order: nodeIndex,
          archived: false,
          parentIds: (node.parents ?? []).map(nodeId),
          seedXp: cumulativeNodeXpForLevel(node.level) + (node.into ?? 0),
          focus: node.focus ?? false,
          evidence: node.evidence ?? [],
          notes: node.notes,
          createdAt: at,
          updatedAt: at,
        });
      });
    });
  });

  return { domains, branches, nodes };
}
