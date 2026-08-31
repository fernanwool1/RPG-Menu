import { canComplete, canFail, canRetry, canStart, findMission } from '@/domain/campaigns';
import { newId, nowIso } from '@/domain/ids';
import type { Campaign, CampaignMission, Id, XpTransaction } from '@/domain/types';

/**
 * The only code allowed to move a mission between statuses.
 *
 * Written as pure functions over a slice, like the Daily Quest reducers, so
 * the whole unlock chain — sequencing, one-time XP, failure and retry — can be
 * exercised in Node without a store or a browser. `useAppStore` wires them up.
 *
 * Two invariants are enforced here and nowhere else:
 *
 *   1. A mission pays XP at most once, guarded by `xpAwardedAt`. A retry can
 *      never mint a second transaction.
 *   2. A mission only becomes actionable because the mission before it was
 *      completed. Nothing derives status from the current time.
 */

export interface CampaignSlice {
  campaigns: Campaign[];
  transactions: XpTransaction[];
}

export type CampaignResult = Partial<CampaignSlice> | { error: string };

/** Replaces one mission, leaving every other record identity-stable. */
function withMission(
  campaign: Campaign,
  missionId: Id,
  update: (mission: CampaignMission) => CampaignMission,
): Campaign {
  return {
    ...campaign,
    chapters: campaign.chapters.map((chapter) =>
      chapter.missions.some((m) => m.id === missionId)
        ? {
            ...chapter,
            missions: chapter.missions.map((m) => (m.id === missionId ? update(m) : m)),
          }
        : chapter,
    ),
  };
}

/**
 * Opens the mission that follows `order`, if it is still locked.
 *
 * Only ever promotes locked -> available: a mission that was already started,
 * completed or failed keeps the state the user put it in.
 */
function unlockAfter(campaign: Campaign, order: number): Campaign {
  return {
    ...campaign,
    chapters: campaign.chapters.map((chapter) => ({
      ...chapter,
      missions: chapter.missions.map((m) =>
        m.order === order + 1 && m.status === 'locked' ? { ...m, status: 'available' } : m,
      ),
    })),
  };
}

function everyMissionCompleted(campaign: Campaign): boolean {
  return campaign.chapters.every((chapter) =>
    chapter.missions.every((mission) => mission.status === 'completed'),
  );
}

function replace(slice: CampaignSlice, campaign: Campaign): Campaign[] {
  return slice.campaigns.map((c) => (c.id === campaign.id ? campaign : c));
}

/**
 * Explicitly discriminated on `ok`. Inference would otherwise normalise the
 * union so that every member carries an optional `error`, which silently
 * defeats narrowing at the call sites.
 */
type Located =
  | { ok: true; campaign: Campaign; mission: CampaignMission }
  | { ok: false; error: string };

function locate(slice: CampaignSlice, campaignId: Id, missionId: Id): Located {
  const campaign = slice.campaigns.find((c) => c.id === campaignId);
  if (!campaign) return { ok: false, error: 'That campaign no longer exists.' };
  const found = findMission(campaign, missionId);
  if (!found) return { ok: false, error: 'That mission no longer exists.' };
  return { ok: true, campaign, mission: found.mission };
}

/* ------------------------------------------------------------------ */
/* Reducers                                                            */
/* ------------------------------------------------------------------ */

export function startMission(
  slice: CampaignSlice,
  campaignId: Id,
  missionId: Id,
): CampaignResult {
  const located = locate(slice, campaignId, missionId);
  if (!located.ok) return { error: located.error };
  const { campaign, mission } = located;

  if (!canStart(mission)) {
    return {
      error:
        mission.status === 'locked'
          ? 'Complete the mission before this one first.'
          : 'That mission has already been started.',
    };
  }

  const at = nowIso();
  const updated = withMission(campaign, missionId, (m) => ({
    ...m,
    status: 'in-progress',
    startedAt: at,
  }));

  return { campaigns: replace(slice, { ...updated, updatedAt: at }) };
}

/**
 * Completing a mission: pay its XP once, write the immutable transaction, mark
 * it done, and open the next mission in the sequence. Completing the last
 * mission completes the campaign, which itself pays nothing extra.
 */
export function completeMission(
  slice: CampaignSlice,
  campaignId: Id,
  missionId: Id,
): CampaignResult {
  const located = locate(slice, campaignId, missionId);
  if (!located.ok) return { error: located.error };
  const { campaign, mission } = located;

  if (!canComplete(mission)) {
    return {
      error:
        mission.status === 'locked'
          ? 'Complete the mission before this one first.'
          : mission.status === 'failed'
            ? 'Retry this mission before completing it.'
            : 'That mission is already completed.',
    };
  }

  const at = nowIso();
  // Belt and braces. A completed mission cannot be failed and a failed mission
  // was never paid, so this should always be false — but the ledger guard is
  // the one thing that must not depend on the status machine being perfect.
  const alreadyPaid = mission.xpAwardedAt !== null;

  let updated = withMission(campaign, missionId, (m) => ({
    ...m,
    status: 'completed',
    completedAt: at,
    failedAt: null,
    xpAwardedAt: m.xpAwardedAt ?? at,
  }));

  updated = unlockAfter(updated, mission.order);

  const finished = everyMissionCompleted(updated);
  updated = {
    ...updated,
    status: finished ? 'completed' : updated.status,
    completedAt: finished ? (updated.completedAt ?? at) : updated.completedAt,
    updatedAt: at,
  };

  const campaigns = replace(slice, updated);
  if (alreadyPaid || mission.xp <= 0) return { campaigns };

  const transaction: XpTransaction = {
    id: newId('xtx'),
    createdAt: at,
    sourceType: 'campaign-mission',
    sourceId: mission.id,
    // Campaign XP is character XP only. Routing it to a skill node would move
    // node and branch levels, which this feature is not allowed to touch.
    skillNodeId: null,
    amount: mission.xp,
    note: `${campaign.title} · ${mission.title}`,
  };

  return { campaigns, transactions: [...slice.transactions, transaction] };
}

/**
 * Failing a mission ends the attempt, not the progress. No XP is removed and
 * no transaction is written; lifetime XP and level are untouchable.
 *
 * A failed mission does NOT open the next one. That is deliberate: the
 * sequence only advances on a completion, and Retry is the way back out — so
 * a missed session never has to be recorded as a false completion.
 */
export function failMission(slice: CampaignSlice, campaignId: Id, missionId: Id): CampaignResult {
  const located = locate(slice, campaignId, missionId);
  if (!located.ok) return { error: located.error };
  const { campaign, mission } = located;

  if (!canFail(mission)) {
    return {
      error:
        mission.status === 'completed'
          ? 'A completed mission cannot be marked failed.'
          : mission.status === 'failed'
            ? 'That mission is already marked failed.'
            : 'That mission is still locked.',
    };
  }

  const at = nowIso();
  const updated = withMission(campaign, missionId, (m) => ({
    ...m,
    status: 'failed',
    failedAt: at,
  }));

  return { campaigns: replace(slice, { ...updated, updatedAt: at }) };
}

/** Puts a failed mission back on the board so the campaign can continue. */
export function retryMission(slice: CampaignSlice, campaignId: Id, missionId: Id): CampaignResult {
  const located = locate(slice, campaignId, missionId);
  if (!located.ok) return { error: located.error };
  const { campaign, mission } = located;

  if (!canRetry(mission)) return { error: 'Only a failed mission can be retried.' };

  const at = nowIso();
  const updated = withMission(campaign, missionId, (m) => ({
    ...m,
    status: 'available',
    failedAt: null,
    startedAt: null,
    // notes and xpAwardedAt are untouched: the write-up survives, and a
    // mission that never paid still has nothing to un-pay.
  }));

  return { campaigns: replace(slice, { ...updated, updatedAt: at }) };
}

/**
 * The user's own notes, kept apart from the official description and never
 * cleared by completing, failing or retrying.
 */
export function setMissionNotes(
  slice: CampaignSlice,
  campaignId: Id,
  missionId: Id,
  notes: string,
): CampaignResult {
  const located = locate(slice, campaignId, missionId);
  if (!located.ok) return { error: located.error };
  const { campaign } = located;

  const updated = withMission(campaign, missionId, (m) => ({ ...m, notes }));
  return { campaigns: replace(slice, { ...updated, updatedAt: nowIso() }) };
}
