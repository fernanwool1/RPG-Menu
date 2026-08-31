import { beforeEach, describe, expect, it } from 'vitest';

import {
  allMissions,
  campaignProgress,
  chapterStatus,
  currentChapter,
  highlightActionVerbs,
  nextMission,
  shortDescription,
} from '@/domain/campaigns';
import { lifetimeXpFromLedger } from '@/domain/progression';
import { buildCampaignSeed, ensureCampaigns } from '@/domain/seed/campaigns';
import type { Campaign, CampaignMission, XpTransaction } from '@/domain/types';
import * as actions from '@/store/campaignActions';
import { runMigrations } from '@/store/persistence';
import { useAppStore } from '@/store/useAppStore';

/**
 * The NSOP campaign.
 *
 * The rules that matter are all here: missions open only because the one
 * before them was completed, XP is paid exactly once, failing costs nothing,
 * and a retry can never mint a second payment.
 */

const AT = '2026-08-20T12:00:00.000Z';
const CAMPAIGN_ID = 'cmp_nsop-2026';

const seed = () => buildCampaignSeed(AT)[0];

/** A slice holding one fresh campaign and an empty ledger. */
function slice(campaign: Campaign = seed()): actions.CampaignSlice {
  return { campaigns: [campaign], transactions: [] };
}

function apply(
  current: actions.CampaignSlice,
  result: actions.CampaignResult,
): actions.CampaignSlice {
  if ('error' in result) throw new Error(`unexpected refusal: ${result.error}`);
  return {
    campaigns: result.campaigns ?? current.campaigns,
    transactions: result.transactions ?? current.transactions,
  };
}

const only = (s: actions.CampaignSlice): Campaign => s.campaigns[0];
const missionAt = (s: actions.CampaignSlice, order: number): CampaignMission => {
  const mission = allMissions(only(s)).find((m) => m.order === order);
  if (!mission) throw new Error(`no mission ${order}`);
  return mission;
};

/** Completes missions 1..through in order, the only way the path opens. */
function completeThrough(through: number): actions.CampaignSlice {
  let state = slice();
  for (let order = 1; order <= through; order += 1) {
    state = apply(state, actions.completeMission(state, CAMPAIGN_ID, missionAt(state, order).id));
  }
  return state;
}

/* ------------------------------------------------------------------ */

describe('the seeded campaign', () => {
  it('is one Main Quest of 30 missions worth 550 XP', () => {
    const campaign = seed();
    const missions = allMissions(campaign);

    expect(campaign.title).toBe('NSOP Week: Lead the New Generation');
    expect(campaign.type).toBe('main');
    expect(campaign.category).toBe('Leadership');
    expect(campaign.status).toBe('active');
    expect(campaign.startDate).toBe('2026-08-31');
    expect(campaign.endDate).toBe('2026-09-03');
    expect(campaign.chapters).toHaveLength(4);
    expect(missions).toHaveLength(30);
    expect(missions.reduce((sum, m) => sum + m.xp, 0)).toBe(550);
  });

  it('splits into the four chapters at 170 / 160 / 110 / 110 XP', () => {
    const chapters = seed().chapters;
    expect(chapters.map((c) => c.missions.length)).toEqual([11, 11, 4, 4]);
    expect(chapters.map((c) => c.missions.reduce((sum, m) => sum + m.xp, 0))).toEqual([
      170, 160, 110, 110,
    ]);
  });

  it('numbers missions 1..30 across the whole campaign, not per chapter', () => {
    expect(allMissions(seed()).map((m) => m.order)).toEqual(
      Array.from({ length: 30 }, (_, i) => i + 1),
    );
  });

  it('opens with exactly one available mission and 29 locked', () => {
    const missions = allMissions(seed());
    expect(missions[0].status).toBe('available');
    expect(missions.slice(1).every((m) => m.status === 'locked')).toBe(true);
  });

  it('gives every mission a description, a schedule and a place', () => {
    for (const mission of allMissions(seed())) {
      expect(mission.description.length, mission.title).toBeGreaterThan(40);
      expect(mission.startTime, mission.title).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
      expect(mission.endTime, mission.title).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
      expect(mission.location.length, mission.title).toBeGreaterThan(0);
      expect(mission.date, mission.title).toMatch(/^2026-0[89]-\d{2}$/);
    }
    for (const chapter of seed().chapters) {
      expect(chapter.description.length).toBeGreaterThan(40);
    }
  });

  it('flags the one room that still has to be confirmed', () => {
    const unconfirmed = allMissions(seed()).filter((m) => m.locationUnconfirmed);
    expect(unconfirmed.map((m) => m.title)).toEqual(['Academic Advisor Session']);
  });

  it('uses ids that are stable across builds, so it is seeded only once', () => {
    const a = allMissions(buildCampaignSeed(AT)[0]).map((m) => m.id);
    const b = allMissions(buildCampaignSeed('2027-01-01T00:00:00.000Z')[0]).map((m) => m.id);
    expect(a).toEqual(b);
    expect(a[0]).toBe('msn_nsop-2026_01');
    expect(a[29]).toBe('msn_nsop-2026_30');
    expect(new Set(a).size).toBe(30);
  });
});

describe('sequential unlocking', () => {
  it('opens the next mission when the current one is completed', () => {
    const state = completeThrough(1);
    expect(missionAt(state, 1).status).toBe('completed');
    expect(missionAt(state, 2).status).toBe('available');
    // And only the next one: nothing further down the path moves.
    expect(missionAt(state, 3).status).toBe('locked');
  });

  it('refuses to start or complete a locked mission', () => {
    const state = slice();
    const locked = missionAt(state, 5).id;

    expect(actions.startMission(state, CAMPAIGN_ID, locked)).toHaveProperty('error');
    expect(actions.completeMission(state, CAMPAIGN_ID, locked)).toHaveProperty('error');
    // Nothing was written to the ledger by a refused transition.
    expect(state.transactions).toHaveLength(0);
  });

  it('carries the chain across a chapter boundary', () => {
    const state = completeThrough(11);
    expect(chapterStatus(only(state).chapters[0])).toBe('completed');
    // Mission 12 is the first mission of Day 2.
    expect(missionAt(state, 12).status).toBe('available');
    expect(currentChapter(only(state))?.title).toContain('Day 2');
  });

  it('lets a mission be started, then completed', () => {
    let state = slice();
    state = apply(state, actions.startMission(state, CAMPAIGN_ID, missionAt(state, 1).id));
    expect(missionAt(state, 1).status).toBe('in-progress');
    expect(missionAt(state, 1).startedAt).not.toBeNull();

    state = apply(state, actions.completeMission(state, CAMPAIGN_ID, missionAt(state, 1).id));
    expect(missionAt(state, 1).status).toBe('completed');
  });
});

describe('XP is paid exactly once', () => {
  const total = (transactions: XpTransaction[]) => transactions.reduce((s, t) => s + t.amount, 0);

  it('writes one immutable transaction per completed mission', () => {
    const state = completeThrough(3);

    expect(state.transactions).toHaveLength(3);
    expect(total(state.transactions)).toBe(5 + 15 + 20);
    for (const tx of state.transactions) {
      expect(tx.sourceType).toBe('campaign-mission');
      // Campaign XP is character XP only; it must not move a skill node.
      expect(tx.skillNodeId).toBeNull();
    }
    expect(state.transactions[0].sourceId).toBe(missionAt(state, 1).id);
  });

  it('refuses a second completion of the same mission', () => {
    const state = completeThrough(1);
    const again = actions.completeMission(state, CAMPAIGN_ID, missionAt(state, 1).id);

    expect(again).toHaveProperty('error');
    expect(state.transactions).toHaveLength(1);
  });

  it('stamps xpAwardedAt so a payment can never be repeated', () => {
    const state = completeThrough(1);
    expect(missionAt(state, 1).xpAwardedAt).not.toBeNull();
    expect(missionAt(state, 2).xpAwardedAt).toBeNull();
    expect(campaignProgress(only(state)).earnedXp).toBe(5);
  });
});

describe('failing and retrying', () => {
  it('costs no XP and writes nothing to the ledger', () => {
    let state = completeThrough(1);
    const before = state.transactions.length;

    state = apply(state, actions.failMission(state, CAMPAIGN_ID, missionAt(state, 2).id));

    expect(missionAt(state, 2).status).toBe('failed');
    expect(missionAt(state, 2).failedAt).not.toBeNull();
    expect(missionAt(state, 2).xpAwardedAt).toBeNull();
    expect(state.transactions).toHaveLength(before);
    expect(campaignProgress(only(state)).earnedXp).toBe(5);
  });

  it('does not advance the path, which is what makes Retry meaningful', () => {
    let state = completeThrough(1);
    state = apply(state, actions.failMission(state, CAMPAIGN_ID, missionAt(state, 2).id));
    expect(missionAt(state, 3).status).toBe('locked');
  });

  it('cannot be completed while failed', () => {
    let state = completeThrough(1);
    state = apply(state, actions.failMission(state, CAMPAIGN_ID, missionAt(state, 2).id));
    expect(actions.completeMission(state, CAMPAIGN_ID, missionAt(state, 2).id)).toHaveProperty(
      'error',
    );
  });

  it('retry puts it back on the board and keeps the notes', () => {
    let state = completeThrough(1);
    const target = missionAt(state, 2).id;

    state = apply(state, actions.setMissionNotes(state, CAMPAIGN_ID, target, 'Overslept.'));
    state = apply(state, actions.failMission(state, CAMPAIGN_ID, target));
    state = apply(state, actions.retryMission(state, CAMPAIGN_ID, target));

    expect(missionAt(state, 2).status).toBe('available');
    expect(missionAt(state, 2).failedAt).toBeNull();
    expect(missionAt(state, 2).notes).toBe('Overslept.');
  });

  it('a retried mission still pays exactly once when finished', () => {
    let state = completeThrough(1);
    const target = missionAt(state, 2).id;

    state = apply(state, actions.failMission(state, CAMPAIGN_ID, target));
    state = apply(state, actions.retryMission(state, CAMPAIGN_ID, target));
    state = apply(state, actions.completeMission(state, CAMPAIGN_ID, target));

    expect(state.transactions.filter((t) => t.sourceId === target)).toHaveLength(1);
    expect(campaignProgress(only(state)).earnedXp).toBe(5 + 15);
  });

  it('a completed mission cannot be marked failed or retried', () => {
    const state = completeThrough(1);
    const done = missionAt(state, 1).id;
    expect(actions.failMission(state, CAMPAIGN_ID, done)).toHaveProperty('error');
    expect(actions.retryMission(state, CAMPAIGN_ID, done)).toHaveProperty('error');
  });
});

describe('notes', () => {
  it('can be written on a locked mission and survive completion', () => {
    let state = slice();
    const target = missionAt(state, 1).id;

    state = apply(state, actions.setMissionNotes(state, CAMPAIGN_ID, target, 'Bring the roster.'));
    state = apply(state, actions.completeMission(state, CAMPAIGN_ID, target));

    expect(missionAt(state, 1).notes).toBe('Bring the roster.');
  });
});

describe('finishing the campaign', () => {
  it('completes at mission 30 with 30/30 and 550/550, and pays nothing extra', () => {
    const state = completeThrough(30);
    const campaign = only(state);
    const progress = campaignProgress(campaign);

    expect(campaign.status).toBe('completed');
    expect(campaign.completedAt).not.toBeNull();
    expect(progress.completed).toBe(30);
    expect(progress.total).toBe(30);
    expect(progress.earnedXp).toBe(550);
    expect(progress.totalXp).toBe(550);
    expect(nextMission(campaign)).toBeNull();

    // Exactly one transaction per mission: the campaign itself awards nothing.
    expect(state.transactions).toHaveLength(30);
    expect(state.transactions.reduce((s, t) => s + t.amount, 0)).toBe(550);
  });

  it('stays active until the last mission is done', () => {
    const state = completeThrough(29);
    expect(only(state).status).toBe('active');
    expect(campaignProgress(only(state)).earnedXp).toBe(530);
  });
});

describe('seeding into an existing save', () => {
  it('adds the campaign when a save predates it', () => {
    expect(ensureCampaigns([], AT)).toHaveLength(1);
    expect(ensureCampaigns(undefined, AT)[0].id).toBe(CAMPAIGN_ID);
  });

  it('never adds a second copy, and never rewinds progress', () => {
    const progressed = only(completeThrough(4));
    const result = ensureCampaigns([progressed], AT);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(progressed);
    expect(campaignProgress(result[0]).completed).toBe(4);
  });

  it('migrates a v2 save additively, leaving the ledger untouched', () => {
    const v2 = {
      initialized: true,
      quests: [{ id: 'qst_a', title: 'Old quest' }],
      transactions: [{ id: 'xtx_a', amount: 500 }],
    };
    const migrated = runMigrations(v2, 2) as Record<string, unknown>;

    expect(migrated.campaigns).toEqual([]);
    expect(migrated.quests).toHaveLength(1);
    expect(migrated.transactions).toEqual(v2.transactions);
  });
});

describe('presentation helpers', () => {
  it('previews a long description on a word boundary', () => {
    const long = allMissions(seed())[2].description;
    const preview = shortDescription(long);
    expect(preview.length).toBeLessThanOrEqual(long.length);
    expect(preview.endsWith('…')).toBe(true);
    expect(preview).not.toMatch(/\s…$/);
  });

  it('leaves a short description alone', () => {
    expect(shortDescription('Arrive on time.')).toBe('Arrive on time.');
  });

  it('marks the action verbs and loses none of the text', () => {
    const text = 'Welcome incoming students and guide them to the next session.';
    const parts = highlightActionVerbs(text);

    expect(parts.map((p) => p.text).join('')).toBe(text);
    expect(parts.filter((p) => p.verb).map((p) => p.text)).toEqual(['Welcome', 'guide']);
  });

  it('does not highlight a verb buried inside another word', () => {
    const parts = highlightActionVerbs('Helpful guidance for welcoming rooms.');
    expect(parts.filter((p) => p.verb).map((p) => p.text)).toEqual(['welcoming']);
  });
});

/* ------------------------------------------------------------------ */
/* Through the real store                                              */
/* ------------------------------------------------------------------ */

describe('the store', () => {
  beforeEach(() => {
    useAppStore.getState().startWithSampleData();
  });

  const campaign = () => useAppStore.getState().campaigns[0];
  const lifetime = () => lifetimeXpFromLedger(useAppStore.getState().transactions);

  it('seeds exactly one campaign, ready at mission 1', () => {
    expect(useAppStore.getState().campaigns).toHaveLength(1);
    expect(campaign().id).toBe(CAMPAIGN_ID);
    expect(allMissions(campaign())[0].status).toBe('available');
  });

  it('moves lifetime XP by the mission amount, once', () => {
    const first = allMissions(campaign())[0];
    const before = lifetime();

    expect(useAppStore.getState().completeMission(CAMPAIGN_ID, first.id)).toEqual({ ok: true });
    expect(lifetime() - before).toBe(first.xp);

    const again = useAppStore.getState().completeMission(CAMPAIGN_ID, first.id);
    expect(again).toEqual({ ok: false, error: expect.any(String) });
    expect(lifetime() - before).toBe(first.xp);
  });

  it('reports why a locked mission cannot be started', () => {
    const locked = allMissions(campaign())[4];
    expect(useAppStore.getState().startMission(CAMPAIGN_ID, locked.id)).toEqual({
      ok: false,
      error: expect.stringContaining('before this one'),
    });
  });

  it('keeps the campaign in the export payload', () => {
    const exported = JSON.parse(useAppStore.getState().exportData()) as {
      data: { campaigns: Campaign[] };
    };
    expect(exported.data.campaigns).toHaveLength(1);
    expect(allMissions(exported.data.campaigns[0])).toHaveLength(30);
  });

  it('round-trips mission progress through export and import', () => {
    const first = allMissions(campaign())[0];
    useAppStore.getState().completeMission(CAMPAIGN_ID, first.id);
    useAppStore.getState().setMissionNotes(CAMPAIGN_ID, first.id, 'Ate with the OL team.');

    const exported = useAppStore.getState().exportData();
    useAppStore.getState().startEmpty();
    expect(campaignProgress(campaign()).completed).toBe(0);

    expect(useAppStore.getState().importData(exported)).toEqual({ ok: true });
    expect(campaignProgress(campaign()).completed).toBe(1);
    expect(allMissions(campaign())[0].notes).toBe('Ate with the OL team.');
  });

  it('does not touch skill, node or quest progression', () => {
    const before = useAppStore.getState();
    const nodesBefore = JSON.stringify(before.nodes);
    const questsBefore = JSON.stringify(before.quests);

    const first = allMissions(campaign())[0];
    useAppStore.getState().completeMission(CAMPAIGN_ID, first.id);

    expect(JSON.stringify(useAppStore.getState().nodes)).toBe(nodesBefore);
    expect(JSON.stringify(useAppStore.getState().quests)).toBe(questsBefore);
  });
});
