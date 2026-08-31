import type {
  Campaign,
  CampaignChapter,
  CampaignMission,
  Id,
  MissionStatus,
} from './types';

/**
 * Campaign rules: sequencing, progress and the small formatting decisions the
 * mission path needs.
 *
 * Pure, and free of React and storage, so the whole unlock chain can be
 * exercised in Node. The reducers in `store/campaignActions.ts` are the only
 * thing allowed to change a mission's status; everything here reads.
 */

export const MISSION_STATUS_LABEL: Record<MissionStatus, string> = {
  locked: 'Locked',
  available: 'Available',
  'in-progress': 'In Progress',
  completed: 'Completed',
  failed: 'Failed',
};

/* ------------------------------------------------------------------ */
/* Reading a campaign                                                  */
/* ------------------------------------------------------------------ */

/** Every mission in campaign order, chapters flattened away. */
export function allMissions(campaign: Campaign): CampaignMission[] {
  return campaign.chapters
    .slice()
    .sort((a, b) => a.order - b.order)
    .flatMap((chapter) => chapter.missions.slice().sort((a, b) => a.order - b.order));
}

export function findMission(
  campaign: Campaign,
  missionId: Id,
): { chapter: CampaignChapter; mission: CampaignMission } | null {
  for (const chapter of campaign.chapters) {
    const mission = chapter.missions.find((m) => m.id === missionId);
    if (mission) return { chapter, mission };
  }
  return null;
}

export function chapterOfMission(campaign: Campaign, missionId: Id): CampaignChapter | null {
  return findMission(campaign, missionId)?.chapter ?? null;
}

export interface CampaignProgress {
  completed: number;
  total: number;
  /** 0..1, by mission count. */
  fraction: number;
  earnedXp: number;
  totalXp: number;
  failed: number;
}

export function campaignProgress(campaign: Campaign): CampaignProgress {
  const missions = allMissions(campaign);
  const completed = missions.filter((m) => m.status === 'completed');

  return {
    completed: completed.length,
    total: missions.length,
    fraction: missions.length === 0 ? 0 : completed.length / missions.length,
    // Read from xpAwardedAt, not from status: this is what the ledger actually
    // paid, so the readout cannot drift away from the transactions.
    earnedXp: missions.filter((m) => m.xpAwardedAt !== null).reduce((sum, m) => sum + m.xp, 0),
    totalXp: missions.reduce((sum, m) => sum + m.xp, 0),
    failed: missions.filter((m) => m.status === 'failed').length,
  };
}

export function chapterProgress(chapter: CampaignChapter): {
  completed: number;
  total: number;
  fraction: number;
  xp: number;
  earnedXp: number;
} {
  const completed = chapter.missions.filter((m) => m.status === 'completed').length;
  return {
    completed,
    total: chapter.missions.length,
    fraction: chapter.missions.length === 0 ? 0 : completed / chapter.missions.length,
    xp: chapter.missions.reduce((sum, m) => sum + m.xp, 0),
    earnedXp: chapter.missions
      .filter((m) => m.xpAwardedAt !== null)
      .reduce((sum, m) => sum + m.xp, 0),
  };
}

/**
 * The mission the user is on: whatever is in progress, else the first thing
 * that is actionable, else the last completed one so a finished campaign still
 * has something to point at.
 */
export function currentMission(campaign: Campaign): CampaignMission | null {
  const missions = allMissions(campaign);
  return (
    missions.find((m) => m.status === 'in-progress') ??
    missions.find((m) => m.status === 'available') ??
    missions.find((m) => m.status === 'failed') ??
    missions.filter((m) => m.status === 'completed').at(-1) ??
    missions[0] ??
    null
  );
}

/** The next mission that has not been finished yet. Null once all are done. */
export function nextMission(campaign: Campaign): CampaignMission | null {
  return allMissions(campaign).find((m) => m.status !== 'completed') ?? null;
}

/** A chapter is "current" when it holds the mission the user is on. */
export function currentChapter(campaign: Campaign): CampaignChapter | null {
  const mission = currentMission(campaign);
  return mission ? chapterOfMission(campaign, mission.id) : null;
}

export function chapterStatus(chapter: CampaignChapter): MissionStatus {
  if (chapter.missions.length === 0) return 'locked';
  if (chapter.missions.every((m) => m.status === 'completed')) return 'completed';
  if (chapter.missions.some((m) => m.status === 'in-progress')) return 'in-progress';
  if (chapter.missions.some((m) => m.status === 'failed')) return 'failed';
  if (chapter.missions.some((m) => m.status === 'available')) return 'available';
  return 'locked';
}

/* ------------------------------------------------------------------ */
/* What the user may do                                                */
/* ------------------------------------------------------------------ */

export function canStart(mission: CampaignMission): boolean {
  return mission.status === 'available';
}

/** A mission may be finished straight from Available; starting it is optional. */
export function canComplete(mission: CampaignMission): boolean {
  return mission.status === 'available' || mission.status === 'in-progress';
}

export function canFail(mission: CampaignMission): boolean {
  return mission.status === 'available' || mission.status === 'in-progress';
}

export function canRetry(mission: CampaignMission): boolean {
  return mission.status === 'failed';
}

/** Locked and completed missions expand, but offer no way to move XP. */
export function hasActions(mission: CampaignMission): boolean {
  return mission.status !== 'locked' && mission.status !== 'completed';
}

/* ------------------------------------------------------------------ */
/* Presentation helpers                                                */
/* ------------------------------------------------------------------ */

export function missionTimeRange(mission: CampaignMission): string {
  return `${mission.startTime} – ${mission.endTime}`;
}

/**
 * "Monday, August 31" from a YYYY-MM-DD key.
 *
 * Built from the parts rather than `new Date(key)`, which parses a bare date
 * as UTC and can land on the previous day west of Greenwich.
 */
export function formatMissionDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return date;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function formatCampaignDates(campaign: Campaign): string {
  const [, startMonth, startDay] = campaign.startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = campaign.endDate.split('-').map(Number);
  if (!startMonth || !endYear) return `${campaign.startDate} – ${campaign.endDate}`;

  const start = new Date(endYear, startMonth - 1, startDay).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
  });
  const end = new Date(endYear, endMonth - 1, endDay).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  return `${start} – ${end}`;
}

/**
 * The one-line preview shown on a collapsed mission card. Cuts on a word
 * boundary so the preview never ends mid-word.
 */
export function shortDescription(text: string, max = 96): string {
  const clean = text.trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  const trimmed = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${trimmed.replace(/[.,;:]$/, '')}…`;
}

/**
 * Concrete things a mission actually asks of the user. Highlighting these
 * makes a wall of description scannable: the verb tells you what the job is.
 */
export const ACTION_VERBS = [
  'arrive',
  'guide',
  'welcome',
  'support',
  'facilitate',
  'lead',
  'help',
  'accompany',
  'assist',
  'prepare',
  'organize',
  'introduce',
  'encourage',
  'maintain',
  'report',
  'verify',
  'confirm',
  'locate',
  'complete',
  'eat',
  'meet',
  'join',
  'share',
  'distribute',
  'finish',
] as const;

/**
 * Ordinary inflections of each verb, including the dropped `e` English uses
 * before `-ing`: "welcome" has to catch "welcoming", which is the form the
 * descriptions actually use. The word boundaries keep "help" out of "helpful"
 * and "guide" out of "guidance".
 */
const VERB_PATTERN = new RegExp(
  `\\b(?:${ACTION_VERBS.map((verb) =>
    verb.endsWith('e') ? `${verb}[sd]?|${verb.slice(0, -1)}ing` : `${verb}(?:s|ed|ing)?`,
  ).join('|')})\\b`,
  'gi',
);

/**
 * Splits a description into plain and highlighted runs. Returns data rather
 * than markup so the domain stays free of React; the renderer decides what a
 * highlighted run looks like.
 */
export function highlightActionVerbs(text: string): Array<{ text: string; verb: boolean }> {
  const parts: Array<{ text: string; verb: boolean }> = [];
  let last = 0;

  for (const match of text.matchAll(VERB_PATTERN)) {
    const start = match.index ?? 0;
    if (start > last) parts.push({ text: text.slice(last, start), verb: false });
    parts.push({ text: match[0], verb: true });
    last = start + match[0].length;
  }

  if (last < text.length) parts.push({ text: text.slice(last), verb: false });
  return parts.length > 0 ? parts : [{ text, verb: false }];
}
