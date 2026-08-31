import type { Ability, AbilityEvidence, AbilityPath } from '../types';
import { branchId, nodeId } from './skills';

/* ------------------------------------------------------------------ */
/* Authoring helpers                                                   */
/*                                                                     */
/* Abilities hold no XP and no level. They are gated purely on skill    */
/* requirements plus proof, so the seed only declares those two things. */
/* ------------------------------------------------------------------ */

type ReqSpec = [target: 'node' | 'branch' | 'domain', slug: string, label: string, minLevel: number];

interface AbilitySpec {
  slug: string;
  name: string;
  icon: string;
  description: string;
  proof: string;
  requirements: ReqSpec[];
  /** Seeded evidence. Anything with evidence starts Unlocked. */
  evidence?: Array<{ kind: AbilityEvidence['kind']; label: string; reference?: string }>;
}

interface PathSpec {
  slug: string;
  name: string;
  icon: string;
  abilities: AbilitySpec[];
}

const SPEC: PathSpec[] = [
  {
    slug: 'computer-science',
    name: 'Computer Science',
    icon: 'monitor',
    abilities: [
      {
        slug: 'full-stack-builder',
        name: 'Full-Stack Builder',
        icon: 'code',
        description: 'Design, build, and deploy a complete web application.',
        proof: 'Build and deploy a complete application',
        requirements: [
          ['branch', 'web-development', 'Web Development', 6],
          ['branch', 'programming', 'Programming', 6],
          ['node', 'databases', 'Databases', 4],
        ],
      },
      {
        slug: 'data-pipeline-architect',
        name: 'Data Pipeline Architect',
        icon: 'database',
        description: 'Move data from a raw source to a queryable, trusted destination.',
        proof: 'Ship a pipeline that runs unattended on a schedule',
        requirements: [
          ['branch', 'data-engineering', 'Data Engineering', 5],
          ['node', 'sql', 'SQL', 5],
          ['node', 'python', 'Python', 6],
        ],
        evidence: [{ kind: 'note', label: 'Internship ingestion pipeline, ran nightly for a semester' }],
      },
      {
        slug: 'automation-engineer',
        name: 'Automation Engineer',
        icon: 'workflow',
        description: 'Replace a repeated manual process with something that runs itself.',
        proof: 'Automate a task you currently do by hand every week',
        requirements: [
          ['branch', 'programming', 'Programming', 5],
          ['node', 'shell', 'Shell & Tooling', 4],
          ['node', 'python', 'Python', 5],
        ],
        evidence: [{ kind: 'note', label: 'Report generator that replaced a weekly spreadsheet' }],
      },
      {
        slug: 'mobile-app-creator',
        name: 'Mobile App Creator',
        icon: 'phone',
        description: 'Build and ship an application that runs on a phone.',
        proof: 'Publish a working mobile app to a device or store',
        requirements: [
          ['branch', 'programming', 'Programming', 6],
          ['node', 'app-development', 'Application Development', 5],
          ['node', 'ui-design', 'Interface Design', 5],
        ],
      },
      {
        slug: 'systems-problem-solver',
        name: 'Systems Problem Solver',
        icon: 'puzzle',
        description: 'Diagnose a failure across the stack and repair the real cause.',
        proof: 'Document a diagnosis from symptom to root cause to fix',
        requirements: [
          ['branch', 'computer-systems', 'Computer Systems', 5],
          ['node', 'algorithms', 'Algorithms', 5],
          ['node', 'networks', 'Networks', 4],
        ],
        evidence: [{ kind: 'note', label: 'Traced an intermittent outage to a DNS cache, wrote it up' }],
      },
      {
        slug: 'applied-ai-developer',
        name: 'Applied AI Developer',
        icon: 'brain',
        description: 'Build a working product where a model does real work.',
        proof: 'Ship an AI feature someone other than you relies on',
        requirements: [
          ['branch', 'artificial-intelligence', 'Artificial Intelligence', 6],
          ['node', 'ml-foundations', 'ML Foundations', 6],
          ['node', 'neural-networks', 'Neural Networks', 5],
        ],
      },
    ],
  },
  {
    slug: 'business',
    name: 'Business',
    icon: 'briefcase',
    abilities: [
      {
        slug: 'client-prospector',
        name: 'Client Prospector',
        icon: 'search',
        description: 'Find and open a conversation with a client who was not looking for you.',
        proof: 'Convert a cold approach into a real meeting',
        requirements: [
          ['node', 'prospecting', 'Prospecting', 6],
          ['node', 'negotiation', 'Negotiation', 5],
        ],
        evidence: [{ kind: 'note', label: 'Two cold accounts opened last quarter' }],
      },
      {
        slug: 'solution-seller',
        name: 'Solution Seller',
        icon: 'handshake',
        description: 'Diagnose what a client actually needs and sell that, not the catalogue.',
        proof: 'Close a sale you reshaped after hearing the real problem',
        requirements: [
          ['node', 'negotiation', 'Negotiation', 6],
          ['node', 'client-presentations', 'Client Presentations', 5],
        ],
        evidence: [{ kind: 'note', label: 'Repositioned a proposal mid-pitch and closed it' }],
      },
      {
        slug: 'operations-optimizer',
        name: 'Operations Optimizer',
        icon: 'workflow',
        description: 'Take an existing process and make it measurably cheaper or faster.',
        proof: 'Show a before and after with real numbers',
        requirements: [
          ['node', 'process-design', 'Process Design', 6],
          ['node', 'logistics', 'Logistics', 6],
        ],
        evidence: [{ kind: 'note', label: 'Cut a delivery route by two stops without losing coverage' }],
      },
      {
        slug: 'financial-planner',
        name: 'Financial Planner',
        icon: 'coins',
        description: 'Build a budget and a forecast that survive contact with reality.',
        proof: 'Run a real budget for a full cycle and review the variance',
        requirements: [
          ['node', 'budgeting', 'Budgeting', 6],
          ['node', 'financial-analysis', 'Financial Analysis', 6],
          ['node', 'accounting', 'Accounting', 5],
        ],
        evidence: [{ kind: 'note', label: 'Semester budget held to within 6% of forecast' }],
      },
      {
        slug: 'strategic-planner',
        name: 'Strategic Planner',
        icon: 'target',
        description: 'Choose a direction under uncertainty and defend the trade-offs.',
        proof: 'Write a strategy with an explicit list of what you will not do',
        requirements: [
          ['node', 'business-planning', 'Business Planning', 7],
          ['node', 'market-analysis', 'Market Analysis', 6],
        ],
      },
      {
        slug: 'venture-builder',
        name: 'Venture Builder',
        icon: 'rocket',
        description: 'Take a venture from idea to first paying customer.',
        proof: 'Earn revenue from something you started',
        requirements: [
          ['node', 'venture-building', 'Venture Building', 7],
          ['node', 'business-planning', 'Business Planning', 7],
          ['node', 'financial-analysis', 'Financial Analysis', 8],
        ],
      },
    ],
  },
  {
    slug: 'music',
    name: 'Music',
    icon: 'music',
    abilities: [
      {
        slug: 'live-guitar-performer',
        name: 'Live Guitar Performer',
        icon: 'guitar',
        description: 'Hold a full set in front of an audience without stopping.',
        proof: 'Perform a complete set live',
        requirements: [
          ['node', 'guitar', 'Guitar', 7],
          ['node', 'harmony', 'Harmony', 5],
        ],
        evidence: [{ kind: 'note', label: 'Forty-minute set, no restarts' }],
      },
      {
        slug: 'multi-instrumentalist',
        name: 'Multi-Instrumentalist',
        icon: 'piano',
        description: 'Carry a piece competently on three separate instruments.',
        proof: 'Record the same piece on three instruments',
        requirements: [
          ['node', 'guitar', 'Guitar', 6],
          ['node', 'piano', 'Piano', 6],
          ['node', 'bass', 'Bass', 6],
        ],
      },
      {
        slug: 'song-arranger',
        name: 'Song Arranger',
        icon: 'layers',
        description: 'Rebuild an existing song for a different set of instruments.',
        proof: 'Arrange and notate a song for a new ensemble',
        requirements: [
          ['node', 'arranging', 'Arranging', 6],
          ['node', 'harmony', 'Harmony', 6],
          ['node', 'notation', 'Notation', 6],
        ],
      },
      {
        slug: 'play-by-ear',
        name: 'Play by Ear',
        icon: 'ear',
        description: 'Hear a piece once and reproduce it without notation.',
        proof: 'Play back an unfamiliar piece after a single listen',
        requirements: [
          ['node', 'interval-recognition', 'Interval Recognition', 6],
          ['node', 'chord-recognition', 'Chord Recognition', 6],
        ],
        evidence: [{ kind: 'note', label: 'Reproduced a request on the spot at a rehearsal' }],
      },
      {
        slug: 'music-composer',
        name: 'Music Composer',
        icon: 'pen',
        description: 'Write an original piece from a blank page to a finished score.',
        proof: 'Finish and record an original composition',
        requirements: [
          ['node', 'songwriting', 'Songwriting', 7],
          ['node', 'harmony', 'Harmony', 7],
          ['node', 'production', 'Production', 5],
        ],
      },
      {
        slug: 'ensemble-performer',
        name: 'Ensemble Performer',
        icon: 'users',
        description: 'Hold your part inside a group and adjust to everyone else in real time.',
        proof: 'Perform in an ensemble that rehearsed together',
        requirements: [
          ['node', 'piano', 'Piano', 8],
          ['node', 'transcription', 'Transcription', 7],
          ['node', 'relative-pitch', 'Relative Pitch', 7],
        ],
      },
    ],
  },
  {
    slug: 'creative',
    name: 'Creative',
    icon: 'palette',
    abilities: [
      {
        slug: 'visual-storyteller',
        name: 'Visual Storyteller',
        icon: 'palette',
        description: 'Carry a narrative through images alone.',
        proof: 'Finish a sequence of images that tells one story',
        requirements: [
          ['node', 'sketching', 'Sketching', 6],
          ['node', 'digital-illustration', 'Digital Illustration', 5],
          ['node', 'figure-drawing', 'Figure Drawing', 5],
        ],
        evidence: [{ kind: 'note', label: 'Six-panel sequence, finished and inked' }],
      },
      {
        slug: 'poetry-crafter',
        name: 'Poetry Crafter',
        icon: 'quote',
        description: 'Write poems that survive being read aloud to someone else.',
        proof: 'Finish a set of poems and read them in public',
        requirements: [
          ['node', 'poetry', 'Poetry', 6],
          ['node', 'lyric-writing', 'Lyric Writing', 4],
        ],
        evidence: [{ kind: 'note', label: 'Read three finished poems at an open night' }],
      },
      {
        slug: 'long-form-storyteller',
        name: 'Long-Form Storyteller',
        icon: 'book',
        description: 'Sustain a single story across a long piece without it collapsing.',
        proof: 'Finish a long-form piece and revise it at least once',
        requirements: [
          ['node', 'short-fiction', 'Short Fiction', 7],
          ['node', 'worldbuilding', 'Worldbuilding', 7],
          ['node', 'editing', 'Editing', 6],
        ],
      },
      {
        slug: 'interface-designer',
        name: 'Interface Designer',
        icon: 'layout',
        description: 'Design an interface someone can use without being taught it.',
        proof: 'Design an interface and watch someone use it unaided',
        requirements: [
          ['node', 'ui-design', 'Interface Design', 6],
          ['node', 'typography', 'Typography', 5],
        ],
        evidence: [{ kind: 'note', label: 'Two detailed interface designs shipped' }],
      },
      {
        slug: 'brand-designer',
        name: 'Brand Designer',
        icon: 'badge',
        description: 'Build a visual identity that stays coherent across every surface.',
        proof: 'Produce a small identity system and apply it three ways',
        requirements: [
          ['node', 'brand-design', 'Brand Design', 6],
          ['node', 'typography', 'Typography', 6],
          ['node', 'ui-design', 'Interface Design', 6],
        ],
      },
      {
        slug: 'photographic-storyteller',
        name: 'Photographic Storyteller',
        icon: 'camera',
        description: 'Select and sequence photographs so the set says more than any one frame.',
        proof: 'Edit a shoot down to a sequence and defend every cut',
        requirements: [
          ['node', 'photo-composition', 'Composition', 6],
          ['node', 'photo-editing', 'Photo Editing', 6],
          ['node', 'lighting', 'Lighting', 5],
        ],
      },
    ],
  },
  {
    slug: 'communication',
    name: 'Communication',
    icon: 'message',
    abilities: [
      {
        slug: 'academic-researcher',
        name: 'Academic Researcher',
        icon: 'graduation',
        description: 'Ask a real question and answer it with evidence someone can check.',
        proof: 'Complete a cited research paper',
        requirements: [
          ['node', 'academic-writing', 'Academic Writing', 6],
          ['node', 'english-reading', 'English Reading', 6],
          ['node', 'editing', 'Editing', 5],
        ],
        evidence: [{ kind: 'note', label: 'Term paper with primary sources, graded' }],
      },
      {
        slug: 'public-presenter',
        name: 'Public Presenter',
        icon: 'presentation',
        description: 'Hold a room and land a point without reading from the slide.',
        proof: 'Deliver a prepared talk to a live audience',
        requirements: [
          ['node', 'public-speaking', 'Public Speaking', 6],
          ['node', 'english-speaking', 'English Speaking', 6],
        ],
        evidence: [{ kind: 'note', label: 'Fifteen-minute class presentation, no notes' }],
      },
      {
        slug: 'discussion-facilitator',
        name: 'Discussion Facilitator',
        icon: 'message',
        description: 'Run a discussion where the quiet people also end up speaking.',
        proof: 'Facilitate a session and capture what the group decided',
        requirements: [
          ['node', 'discussion-facilitation', 'Discussion Facilitation', 6],
          ['node', 'moderation', 'Moderation', 5],
        ],
        evidence: [{ kind: 'note', label: 'Weekly study group, ran the whole semester' }],
      },
      {
        slug: 'teacher-and-mentor',
        name: 'Teacher and Mentor',
        icon: 'users',
        description: 'Take someone from not understanding to understanding, repeatedly.',
        proof: 'Mentor one person through a full goal',
        requirements: [
          ['node', 'tutoring', 'Tutoring', 7],
          ['node', 'mentoring', 'Mentoring', 6],
          ['node', 'curriculum-design', 'Curriculum Design', 5],
        ],
        evidence: [{ kind: 'note', label: 'Tutored two students through a full course' }],
      },
      {
        slug: 'team-leader',
        name: 'Team Leader',
        icon: 'users',
        description: 'Own an outcome delivered by other people.',
        proof: 'Lead a team through a project with a real deadline',
        requirements: [
          ['node', 'delegation', 'Delegation', 7],
          ['node', 'team-coordination', 'Team Coordination', 7],
          ['node', 'conflict-resolution', 'Conflict Resolution', 7],
        ],
      },
      {
        slug: 'community-organizer',
        name: 'Community Organizer',
        icon: 'heart',
        description: 'Get people who owe you nothing to show up for something.',
        proof: 'Organise an event that other people attended',
        requirements: [
          ['node', 'community-organizing', 'Community Organizing', 7],
          ['node', 'outreach', 'Outreach', 7],
          ['node', 'volunteering', 'Volunteering', 8],
        ],
      },
    ],
  },
  {
    slug: 'physical',
    name: 'Physical',
    icon: 'dumbbell',
    abilities: [
      {
        slug: 'endurance-cyclist',
        name: 'Endurance Cyclist',
        icon: 'bike',
        description: 'Hold a sustained pace over a long distance without breaking down.',
        proof: 'Complete a long ride at a steady pace',
        requirements: [
          ['node', 'cycling', 'Cycling', 6],
          ['node', 'sleep-discipline', 'Sleep Discipline', 5],
        ],
        evidence: [{ kind: 'note', label: 'Forty kilometres, even splits' }],
      },
      {
        slug: 'strength-foundation',
        name: 'Strength Foundation',
        icon: 'dumbbell',
        description: 'Move your own bodyweight well and load it safely.',
        proof: 'Hit a clean rep target across the core lifts',
        requirements: [
          ['node', 'calisthenics', 'Calisthenics', 6],
          ['node', 'weight-training', 'Weight Training', 5],
          ['node', 'core-training', 'Core Training', 5],
        ],
      },
      {
        slug: 'mobility-practitioner',
        name: 'Mobility Practitioner',
        icon: 'waves',
        description: 'Own a full range of motion and keep it.',
        proof: 'Hold a mobility routine daily for a month',
        requirements: [
          ['node', 'stretching', 'Stretching', 5],
          ['node', 'balance', 'Balance', 5],
        ],
      },
      {
        slug: 'consistent-athlete',
        name: 'Consistent Athlete',
        icon: 'activity',
        description: 'Train, eat and sleep on a schedule that holds through a busy term.',
        proof: 'Keep a full training week for eight consecutive weeks',
        requirements: [
          ['node', 'running', 'Running', 7],
          ['node', 'cycling', 'Cycling', 8],
          ['node', 'nutrition', 'Nutrition', 7],
        ],
      },
    ],
  },
];

export const pathId = (slug: string) => `pth_${slug}`;
export const abilityId = (slug: string) => `abl_${slug}`;

export interface SeededAbilities {
  paths: AbilityPath[];
  abilities: Ability[];
}

export function buildAbilitySeed(at: string): SeededAbilities {
  const paths: AbilityPath[] = [];
  const abilities: Ability[] = [];

  SPEC.forEach((path, pathIndex) => {
    paths.push({
      id: pathId(path.slug),
      name: path.name,
      icon: path.icon,
      order: pathIndex,
      createdAt: at,
      updatedAt: at,
    });

    path.abilities.forEach((ability, abilityIndex) => {
      abilities.push({
        id: abilityId(ability.slug),
        pathId: pathId(path.slug),
        name: ability.name,
        description: ability.description,
        icon: ability.icon,
        order: abilityIndex,
        requirements: ability.requirements.map(([target, slug, label, minLevel], i) => ({
          id: `req_${ability.slug}_${i}`,
          target,
          targetId: target === 'branch' ? branchId(slug) : nodeId(slug),
          label,
          minLevel,
        })),
        proofDescription: ability.proof,
        proofMinEvidence: 1,
        proofQuestId: null,
        evidence: (ability.evidence ?? []).map((e, i) => ({
          id: `evd_${ability.slug}_${i}`,
          kind: e.kind,
          label: e.label,
          reference: e.reference,
          createdAt: at,
        })),
        manualPromotion: null,
        archived: false,
        createdAt: at,
        updatedAt: at,
      });
    });
  });

  return { paths, abilities };
}
