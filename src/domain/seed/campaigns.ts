import type { Campaign, CampaignChapter, CampaignMission } from '../types';

/* ------------------------------------------------------------------ */
/* NSOP Week campaign seed                                             */
/*                                                                     */
/* A real, dated schedule rather than sample data: every mission is one */
/* scheduled Orientation Leader responsibility, in the order it happens.*/
/*                                                                     */
/* Ids are stable and derived from the slug, so re-running the seed on  */
/* an existing save recognises the campaign it already has and adds     */
/* nothing. Progress therefore survives both a refresh and a release.   */
/* ------------------------------------------------------------------ */

export const CAMPAIGN_SLUG = 'nsop-2026';
export const campaignId = (slug: string) => `cmp_${slug}`;
export const chapterId = (slug: string, day: number) => `cch_${slug}_day-${day}`;
export const missionId = (slug: string, order: number) =>
  `msn_${slug}_${String(order).padStart(2, '0')}`;

interface MissionSpec {
  title: string;
  description: string;
  start: string;
  end: string;
  location: string;
  xp: number;
  locationUnconfirmed?: boolean;
}

interface ChapterSpec {
  day: number;
  title: string;
  description: string;
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  missions: MissionSpec[];
}

const CHAPTERS: ChapterSpec[] = [
  {
    day: 1,
    title: 'Day 1 — Welcome and Convocation',
    description:
      'Begin NSOP by preparing the campus, welcoming the incoming class, and guiding Group 13 through its first official Columbia experience.',
    date: '2026-08-31',
    missions: [
      {
        title: 'OL Breakfast',
        description:
          'Arrive on time, eat breakfast, meet the other Orientation Leaders, and prepare yourself for the long opening day ahead.',
        start: '6:30 AM',
        end: '6:45 AM',
        location: 'Broadway Room, Lerner Hall, second floor',
        xp: 5,
      },
      {
        title: 'Orientation Setup',
        description:
          'Help organize the welcome area before students arrive. Follow staff instructions and make sure the entrance is ready for check-in.',
        start: '6:45 AM',
        end: '7:30 AM',
        location: 'North Lobby, Lerner Hall',
        xp: 15,
      },
      {
        title: 'Mingle at Student Breakfast',
        description:
          'Welcome incoming students at the South Lawns. Introduce yourself, begin conversations, answer basic questions, and help nervous students feel included.',
        start: '7:30 AM',
        end: '8:45 AM',
        location: 'South Lawns',
        xp: 20,
      },
      {
        title: 'Line Up for Convocation',
        description:
          'Report to the designated lineup area and join the Orientation Leaders, GS staff, and stage party for the procession.',
        start: '8:45 AM',
        end: '9:00 AM',
        location: 'College Walk and Butler Pathways',
        xp: 5,
      },
      {
        title: 'GS Convocation',
        description:
          'Support the official welcome ceremony. Remain engaged, represent GS positively, and bring energy to the welcome moment by standing, clapping, and cheering.',
        start: '9:00 AM',
        end: '10:30 AM',
        location: 'South Lawns',
        xp: 25,
      },
      {
        title: 'Guide Group 13 to the Next Session',
        description:
          'Locate the students in Group 13 and guide them safely from Convocation to their next scheduled session without leaving anyone behind.',
        start: '10:30 AM',
        end: '11:00 AM',
        location: 'Walk with Group 13',
        xp: 15,
      },
      {
        title: 'Academic Advisor Session',
        description:
          'Accompany or support Group 13 during its academic-advising session. Confirm the correct room with a Crew Captain before beginning this mission.',
        start: '11:00 AM',
        end: '12:20 PM',
        location: 'Confirm with Crew Captain',
        xp: 20,
        locationUnconfirmed: true,
      },
      {
        title: 'OL Lunch',
        description:
          'Take a short break, eat, recover your energy, and reconnect with the Orientation Leader team before the afternoon sessions.',
        start: '12:20 PM',
        end: '1:10 PM',
        location: 'South Lawns',
        xp: 5,
      },
      {
        title: 'Focus on the Financials',
        description:
          'Help Group 13 attend the financial-information session in Havemeyer 309. Remain available if students need directions or basic assistance.',
        start: '1:30 PM',
        end: '2:20 PM',
        location: 'Havemeyer 309',
        xp: 15,
      },
      {
        title: 'Title IX Information Session',
        description:
          'Support an attentive and respectful environment while Group 13 completes its required Title IX session.',
        start: '2:20 PM',
        end: '3:20 PM',
        location: 'Havemeyer 309',
        xp: 15,
      },
      {
        title: 'Dean & Alumni Keynote — Connections',
        description:
          'Assist with the keynote discussion about building connections at Columbia. Welcome attendees, support the speakers and staff, and remain available throughout the session.',
        start: '3:30 PM',
        end: '4:30 PM',
        location: 'Low Library Rotunda, second floor',
        xp: 30,
      },
    ],
  },
  {
    day: 2,
    title: 'Day 2 — Group 13 Training',
    description:
      'Lead Group 13 through a full sequence of mandatory training sessions, institutional resources, social activities, and community-building events.',
    date: '2026-09-01',
    missions: [
      {
        title: 'OL Breakfast and Arrival',
        description:
          'Report to the Baer Room, check in with the Orientation Leader team, eat breakfast, and prepare for the Group 13 training schedule.',
        start: '8:15 AM',
        end: '8:45 AM',
        location: 'Baer Room, 408 Lewisohn Hall',
        xp: 5,
      },
      {
        title: 'Group 13 Check-In and Greeting',
        description:
          'Welcome Group 13 at Uris 301, verify that students reach the correct room, and create an approachable atmosphere before training begins.',
        start: '8:45 AM',
        end: '9:00 AM',
        location: 'Uris 301',
        xp: 10,
      },
      {
        title: 'SVR Training',
        description:
          'Accompany Group 13 through SVR training. Help maintain a serious, attentive, and respectful environment during the session.',
        start: '9:00 AM',
        end: '10:10 AM',
        location: 'Uris 301',
        xp: 20,
      },
      {
        title: 'Academic Integrity Information Session',
        description:
          'Support Group 13 during its introduction to Columbia’s academic-integrity expectations and help students remain focused and engaged.',
        start: '10:20 AM',
        end: '11:10 AM',
        location: 'Uris 301',
        xp: 15,
      },
      {
        title: 'Introduction to Dean of Students',
        description:
          'Help students connect the Dean of Students Office with the support and guidance available during their time at Columbia.',
        start: '11:10 AM',
        end: '11:40 AM',
        location: 'Uris 301',
        xp: 10,
      },
      {
        title: 'Academic Resource Center Information Session',
        description:
          'Assist Group 13 while students learn where to find tutoring, academic coaching, and other academic-support resources.',
        start: '11:40 AM',
        end: '12:10 PM',
        location: 'Uris 301',
        xp: 10,
      },
      {
        title: 'Title VI and University Life',
        description:
          'Support an inclusive and respectful environment while students learn about Title VI and their responsibilities within the university community.',
        start: '12:10 PM',
        end: '1:10 PM',
        location: 'Uris 301',
        xp: 15,
      },
      {
        title: 'Lunch with Group 13',
        description:
          'Eat with Group 13, encourage conversation between students, answer questions when possible, and make sure nobody is unintentionally excluded.',
        start: '1:10 PM',
        end: '2:20 PM',
        location: 'GS Lounge',
        xp: 10,
      },
      {
        title: 'Being a Successful Writer at Columbia',
        description:
          'Help facilitate the writing session by welcoming students, supporting the presenters, encouraging participation, and assisting with the room as needed.',
        start: '3:30 PM',
        end: '4:20 PM',
        location: 'Mathematics 203',
        xp: 25,
      },
      {
        title: 'New Student Pizza Party',
        description:
          'Welcome students to the GS Lounge, help distribute or organize food if requested, and use the gathering to strengthen the new community.',
        start: '6:00 PM',
        end: '6:45 PM',
        location: 'GS Lounge',
        xp: 15,
      },
      {
        title: 'Speed Meeting',
        description:
          'Help students make several quick introductions on Lewisohn Lawn. Encourage participation, maintain the flow of the activity, and include anyone who appears isolated.',
        start: '6:45 PM',
        end: '7:45 PM',
        location: 'Lewisohn Lawn',
        xp: 25,
      },
    ],
  },
  {
    day: 3,
    title: 'Day 3 — Transition and Facilitation',
    description:
      'Help students understand the transition into Columbia, introduce important campus resources, and take an active role as a peer facilitator.',
    date: '2026-09-02',
    missions: [
      {
        title: 'Mindset — More Than a Cat Poster',
        description:
          'Support a conversation about mindset, resilience, and personal growth. Encourage students to think beyond motivational clichés and engage with the actual discussion.',
        start: '9:00 AM',
        end: '10:10 AM',
        location: 'Uris 142',
        xp: 20,
      },
      {
        title: 'Making the Transition',
        description:
          'Help incoming students discuss the academic, personal, and social transition into Columbia. Share useful guidance while allowing students to express their own concerns.',
        start: '11:30 AM',
        end: '12:30 PM',
        location: 'Mathematics 203',
        xp: 20,
      },
      {
        title: 'Insider’s Guide to the Libraries',
        description:
          'Help students discover Columbia’s library system, important study spaces, and the resources they can use throughout the semester.',
        start: '3:30 PM',
        end: '4:30 PM',
        location: 'Butler 203',
        xp: 20,
      },
      {
        title: 'Civility & Inclusivity Workshop — Peer Facilitator',
        description:
          'Facilitate a respectful small-group conversation using the provided prompts. Encourage balanced participation, make space for different perspectives, and report serious concerns to GS staff.',
        start: '5:00 PM',
        end: '6:15 PM',
        location: 'Mathematics 312',
        xp: 50,
      },
    ],
  },
  {
    day: 4,
    title: 'Day 4 — Columbia Community',
    description:
      'Complete the final stage of the campaign by helping students understand Columbia’s community, housing resources, and expectations for inclusive participation.',
    date: '2026-09-03',
    missions: [
      {
        title: 'This Place Called Columbia',
        description:
          'Help incoming students explore Columbia’s culture, history, expectations, and their emerging place within the university community.',
        start: '9:00 AM',
        end: '10:10 AM',
        location: 'Uris 142',
        xp: 20,
      },
      {
        title: 'Guide to Housing and Residence Life',
        description:
          'Support the housing session and help students understand the resources, expectations, and support systems connected to residential life.',
        start: '10:20 AM',
        end: '11:30 AM',
        location: 'Uris 303',
        xp: 20,
      },
      {
        title: 'Civility & Inclusivity Workshop — Peer Facilitator',
        description:
          'Lead a second small-group workshop with greater confidence. Encourage thoughtful participation, maintain a respectful environment, and ensure every student has an opportunity to contribute.',
        start: '2:30 PM',
        end: '3:45 PM',
        location: 'Mathematics 312',
        xp: 50,
      },
      {
        title: 'New Student Dinner',
        description:
          'Finish the NSOP campaign by welcoming students at the GS Lounge, supporting the dinner, strengthening new connections, and helping the community close the week positively.',
        start: '5:30 PM',
        end: '6:30 PM',
        location: 'GS Lounge',
        xp: 20,
      },
    ],
  },
];

export const CAMPAIGN_TITLE = 'NSOP Week: Lead the New Generation';

export function buildCampaignSeed(at: string): Campaign[] {
  // Mission order runs 1..30 across the whole campaign, not per chapter, so the
  // unlock chain is a single sequence that happens to be grouped for display.
  let order = 0;

  const chapters: CampaignChapter[] = CHAPTERS.map((spec) => ({
    id: chapterId(CAMPAIGN_SLUG, spec.day),
    order: spec.day,
    title: spec.title,
    description: spec.description,
    missions: spec.missions.map((mission): CampaignMission => {
      order += 1;
      return {
        id: missionId(CAMPAIGN_SLUG, order),
        order,
        title: mission.title,
        description: mission.description,
        date: spec.date,
        startTime: mission.start,
        endTime: mission.end,
        location: mission.location,
        ...(mission.locationUnconfirmed ? { locationUnconfirmed: true } : {}),
        xp: mission.xp,
        // Only the very first mission opens; everything after it is gated on
        // the mission before it and is unlocked by completing that one.
        status: order === 1 ? 'available' : 'locked',
        startedAt: null,
        completedAt: null,
        failedAt: null,
        xpAwardedAt: null,
        notes: '',
      };
    }),
  }));

  return [
    {
      id: campaignId(CAMPAIGN_SLUG),
      title: CAMPAIGN_TITLE,
      description:
        'Welcome Columbia’s incoming GS students and help them navigate their first days on campus. Complete every orientation responsibility in sequence, support Group 13, facilitate inclusive conversations, and help transform an unfamiliar campus into a new community.',
      type: 'main',
      category: 'Leadership',
      status: 'active',
      startDate: '2026-08-31',
      endDate: '2026-09-03',
      chapters,
      completedAt: null,
      createdAt: at,
      updatedAt: at,
    },
  ];
}

/**
 * Tops a save up with any campaign it does not already have.
 *
 * Keyed on the stable campaign id, so this is safe to run on every load: a
 * save that already holds NSOP keeps its exact mission progress, XP stamps and
 * notes, and a save written before this release picks the campaign up without
 * a second copy ever being created.
 */
export function ensureCampaigns(existing: Campaign[] | undefined, at: string): Campaign[] {
  const saved = existing ?? [];
  const known = new Set(saved.map((c) => c.id));
  const missing = buildCampaignSeed(at).filter((c) => !known.has(c.id));
  return missing.length === 0 ? saved : [...saved, ...missing];
}
