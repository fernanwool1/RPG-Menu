'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Lock,
  MapPin,
  Play,
  RotateCcw,
  Trophy,
  X,
} from 'lucide-react';

import { SectionLabel, StatList, StatRow } from '@/components/ui/DetailPanel';
import { GameButton } from '@/components/ui/GameButton';
import { ConfirmDialog } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  MISSION_STATUS_LABEL,
  allMissions,
  campaignProgress,
  canComplete,
  canFail,
  canRetry,
  canStart,
  chapterProgress,
  chapterStatus,
  currentChapter,
  currentMission,
  formatCampaignDates,
  formatMissionDate,
  highlightActionVerbs,
  missionTimeRange,
  nextMission,
  shortDescription,
} from '@/domain/campaigns';
import { QUEST_TYPE_LABEL } from '@/domain/quests';
import type { Campaign, CampaignChapter, CampaignMission, Id, MissionStatus } from '@/domain/types';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/cn';

/**
 * The Main Quest campaign, drawn as a vertical mission path.
 *
 * Everything here reads state and calls the store's mission actions; the
 * sequencing, XP and one-time-payment rules all live in
 * `store/campaignActions.ts`. This file decides only how a status looks.
 */

/* ------------------------------------------------------------------ */
/* Status vocabulary                                                   */
/*                                                                     */
/* Status is carried by wording as well as colour, exactly as elsewhere */
/* in the app: the badge always spells the state out.                   */
/* ------------------------------------------------------------------ */

const NODE_RING: Record<MissionStatus, string> = {
  locked: 'border-ivory-faint/25 bg-ink-950 text-ivory-faint/60',
  available: 'border-teal bg-ink-950 text-teal shadow-glow',
  'in-progress': 'border-teal-bright bg-teal/25 text-teal-bright shadow-glow',
  completed: 'border-gold bg-gold/20 text-gold-bright',
  failed: 'border-danger-dim bg-danger/10 text-danger',
};

const CARD_SKIN: Record<MissionStatus, string> = {
  // Dark and desaturated, and explicitly not interactive-looking.
  locked: 'border-ivory-faint/15 bg-ink-950/50 opacity-70',
  available: 'border-teal/55 bg-teal/[0.05]',
  'in-progress': 'border-teal-bright/70 bg-teal/[0.10]',
  completed: 'border-gold/45 bg-gold/[0.05]',
  failed: 'border-danger-dim bg-danger/[0.05]',
};

const TITLE_TONE: Record<MissionStatus, string> = {
  locked: 'text-ivory-faint',
  available: 'text-ivory',
  'in-progress': 'text-ivory',
  completed: 'text-gold-bright',
  failed: 'text-danger',
};

const BADGE_TONE = {
  locked: 'locked',
  available: 'ready',
  'in-progress': 'ready',
  completed: 'peak',
  failed: 'failed',
} as const;

function MissionGlyph({ status }: { status: MissionStatus }) {
  const className = 'h-3.5 w-3.5';
  if (status === 'completed') return <Check aria-hidden className={className} strokeWidth={2.5} />;
  if (status === 'failed') return <X aria-hidden className={className} strokeWidth={2.5} />;
  if (status === 'locked') return <Lock aria-hidden className={className} strokeWidth={2} />;
  if (status === 'in-progress') return <Play aria-hidden className={className} strokeWidth={2.5} />;
  return <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />;
}

/** Highlights the verbs that say what the mission actually asks of you. */
function Described({ text, dim }: { text: string; dim?: boolean }) {
  return (
    <>
      {highlightActionVerbs(text).map((part, i) =>
        part.verb ? (
          <strong key={i} className="font-semibold text-gold">
            {part.text}
          </strong>
        ) : (
          <span key={i} className={dim ? 'text-ivory-faint' : undefined}>
            {part.text}
          </span>
        ),
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* The compact card shown in the Quest Log list                        */
/* ------------------------------------------------------------------ */

export function CampaignListCard({
  campaign,
  selected,
  onSelect,
}: {
  campaign: Campaign;
  selected: boolean;
  onSelect: () => void;
}) {
  const progress = campaignProgress(campaign);
  const next = nextMission(campaign);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'relative w-full rounded-[2px] border px-2.5 py-2 text-left transition-colors duration-200',
        selected
          ? 'border-teal/55 bg-teal/[0.07]'
          : 'border-gold/35 hover:border-gold/60 hover:bg-gold/[0.04]',
      )}
    >
      {selected && (
        <span aria-hidden className="absolute inset-y-1 left-0 w-[2px] bg-teal shadow-glow" />
      )}

      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0 flex-1 text-base leading-tight text-ivory">{campaign.title}</span>
        <StatusBadge bare tone={campaign.status === 'completed' ? 'peak' : 'ready'} className="shrink-0">
          Campaign
        </StatusBadge>
      </span>

      <span className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-xs">
        <span className="min-w-0 text-ivory-faint">{campaign.category}</span>
        <span className="shrink-0 text-teal">
          {progress.earnedXp} / {progress.totalXp} XP
        </span>
      </span>

      <ProgressBar
        className="mt-1.5"
        size="sm"
        tone={campaign.status === 'completed' ? 'gold' : 'teal'}
        value={progress.fraction}
        valueText={`${progress.completed} of ${progress.total} missions completed`}
      />

      <span className="mt-1 block truncate text-xs text-ivory-faint">
        {next ? `Next: ${next.title}` : 'Every mission completed'}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* The full campaign view                                              */
/* ------------------------------------------------------------------ */

export function CampaignPanel({ campaign }: { campaign: Campaign }) {
  const startMission = useAppStore((s) => s.startMission);
  const completeMission = useAppStore((s) => s.completeMission);
  const failMission = useAppStore((s) => s.failMission);
  const retryMission = useAppStore((s) => s.retryMission);

  const progress = campaignProgress(campaign);
  const missions = useMemo(() => allMissions(campaign), [campaign]);
  const chapters = useMemo(
    () => [...campaign.chapters].sort((a, b) => a.order - b.order),
    [campaign.chapters],
  );
  const chapterNow = currentChapter(campaign);
  const missionNow = currentMission(campaign);
  const next = nextMission(campaign);

  const [expanded, setExpanded] = useState<Id | null>(missionNow?.id ?? null);
  const [openChapters, setOpenChapters] = useState<Set<Id>>(
    () => new Set(chapterNow ? [chapterNow.id] : chapters.slice(0, 1).map((c) => c.id)),
  );
  const [confirmFail, setConfirmFail] = useState<CampaignMission | null>(null);
  const [failure, setFailure] = useState('');

  /**
   * The mission whose outgoing connector should animate. Set on a completion
   * and cleared once the animation has run, so it plays exactly once rather
   * than on every re-render.
   */
  const [justCompleted, setJustCompleted] = useState<number | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const report = (result: { ok: true } | { ok: false; error: string } | null) => {
    setFailure(result && !result.ok ? result.error : '');
    return Boolean(result?.ok);
  };

  const onComplete = (mission: CampaignMission) => {
    if (!report(completeMission(campaign.id, mission.id))) return;
    setJustCompleted(mission.order);
    // Follow the path: the mission that just opened becomes the expanded one.
    const following = missions.find((m) => m.order === mission.order + 1);
    setExpanded(following?.id ?? mission.id);
    if (following) {
      const owner = chapters.find((c) => c.missions.some((m) => m.id === following.id));
      if (owner) setOpenChapters((prev) => new Set(prev).add(owner.id));
    }
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setJustCompleted(null), 1200);
  };

  const toggleChapter = (id: Id) =>
    setOpenChapters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const done = campaign.status === 'completed';

  return (
    <>
      {/* ---------------- the Main Quest card ---------------- */}
      <header
        className={cn(
          'rounded-[2px] border p-3.5',
          done ? 'border-gold/60 bg-gold/[0.06] motion-safe:animate-scale-in' : 'border-gold/35 bg-ink-950/40',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="label-caps text-teal">
              {QUEST_TYPE_LABEL[campaign.type]} Quest · {campaign.category}
            </p>
            {/* The display serif plus wide tracking makes a long word like
                "GENERATION" wider than a 375px line box, and it would break
                mid-word. Both step up once there is room. */}
            <h2 className="mt-1 font-display text-lg uppercase tracking-wider text-gold-bright sm:text-xl sm:tracking-wider2">
              {campaign.title}
            </h2>
            <p className="mt-0.5 text-xs text-ivory-faint">{formatCampaignDates(campaign)}</p>
          </div>
          <StatusBadge tone={done ? 'peak' : 'ready'} className="mt-1 shrink-0">
            {done ? 'Completed' : 'Active'}
          </StatusBadge>
        </div>

        {done && (
          <p className="mt-3 flex items-center gap-2 rounded-[2px] border border-gold/45 bg-gold/[0.07] px-3 py-2 text-base text-gold-bright motion-safe:animate-pulse-soft">
            <Trophy aria-hidden className="h-4 w-4 shrink-0" />
            <span>
              Campaign complete. {progress.completed}/{progress.total} missions,{' '}
              {progress.earnedXp}/{progress.totalXp} XP earned.
            </span>
          </p>
        )}

        <ProgressBar
          className="mt-3"
          tone={done ? 'gold' : 'teal'}
          value={progress.fraction}
          label="Campaign progress"
          valueText={`${progress.completed} / ${progress.total} missions completed`}
        />

        <StatList className="mt-3">
          <StatRow
            label="Missions"
            value={
              <span className={done ? 'text-gold-bright' : undefined}>
                {progress.completed} / {progress.total}
              </span>
            }
          />
          <StatRow
            label="XP earned"
            value={
              <span className="text-teal">
                {progress.earnedXp} / {progress.totalXp} XP
              </span>
            }
          />
          <StatRow label="Current chapter" value={chapterNow?.title ?? '—'} />
          <StatRow label="Current mission" value={missionNow?.title ?? '—'} />
          <StatRow label="Next mission" value={next ? next.title : 'None — all complete'} />
          {next && (
            <StatRow
              label="Next scheduled"
              value={
                <span className="text-ivory-dim">
                  {formatMissionDate(next.date)}, {missionTimeRange(next)}
                  <span className="block text-xs text-ivory-faint">{next.location}</span>
                </span>
              }
            />
          )}
          {progress.failed > 0 && (
            <StatRow
              label="Failed"
              value={<span className="text-danger">{progress.failed} to retry</span>}
            />
          )}
        </StatList>

        <p className="mt-2.5 text-base leading-relaxed text-ivory-dim">
          <Described text={campaign.description} />
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-ivory-faint">
          Each mission pays its own XP once. The campaign itself awards nothing extra.
        </p>
      </header>

      {failure && (
        <p role="alert" className="mt-3 rounded-[2px] border border-danger-dim bg-danger/[0.07] px-3 py-2 text-sm text-danger">
          {failure}
        </p>
      )}

      {/* ---------------- the mission path ---------------- */}
      <SectionLabel className="mb-2 mt-4">Mission path</SectionLabel>

      <div className="space-y-2.5">
        {chapters.map((chapter) => (
          <ChapterBlock
            key={chapter.id}
            chapter={chapter}
            open={openChapters.has(chapter.id)}
            onToggle={() => toggleChapter(chapter.id)}
            expandedMissionId={expanded}
            onExpandMission={(id) => setExpanded((prev) => (prev === id ? null : id))}
            justCompleted={justCompleted}
            campaignId={campaign.id}
            onStart={(mission) => report(startMission(campaign.id, mission.id))}
            onComplete={onComplete}
            onAskFail={setConfirmFail}
            onRetry={(mission) => report(retryMission(campaign.id, mission.id))}
          />
        ))}
      </div>

      <ConfirmDialog
        open={confirmFail !== null}
        title="Mark this mission failed?"
        body={
          confirmFail ? (
            <>
              <strong className="text-ivory">{confirmFail.title}</strong> moves to Failed. No XP is
              removed, your lifetime total does not change, and your level cannot go down — it
              simply never pays its {confirmFail.xp} XP. The path stops here until you retry it, so
              a missed session never has to be recorded as a completion.
            </>
          ) : null
        }
        confirmLabel="Mark failed"
        onConfirm={() => {
          if (confirmFail) report(failMission(campaign.id, confirmFail.id));
          setConfirmFail(null);
        }}
        onCancel={() => setConfirmFail(null)}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* One chapter                                                         */
/* ------------------------------------------------------------------ */

function ChapterBlock({
  chapter,
  open,
  onToggle,
  expandedMissionId,
  onExpandMission,
  justCompleted,
  campaignId,
  onStart,
  onComplete,
  onAskFail,
  onRetry,
}: {
  chapter: CampaignChapter;
  open: boolean;
  onToggle: () => void;
  expandedMissionId: Id | null;
  onExpandMission: (id: Id) => void;
  justCompleted: number | null;
  campaignId: Id;
  onStart: (mission: CampaignMission) => void;
  onComplete: (mission: CampaignMission) => void;
  onAskFail: (mission: CampaignMission) => void;
  onRetry: (mission: CampaignMission) => void;
}) {
  const progress = chapterProgress(chapter);
  const status = chapterStatus(chapter);
  const missions = [...chapter.missions].sort((a, b) => a.order - b.order);
  const panelId = `chapter-${chapter.id}`;

  return (
    <section className={cn('rounded-[2px] border', CARD_SKIN[status])}>
      <h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors duration-200 hover:bg-gold/[0.04]"
        >
          {open ? (
            <ChevronDown aria-hidden className="h-4 w-4 shrink-0 text-gold" />
          ) : (
            <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-gold" />
          )}

          <span className="min-w-0 flex-1">
            <span className={cn('block text-base leading-tight', TITLE_TONE[status])}>
              {chapter.title}
            </span>
            <span className="mt-0.5 block text-xs text-ivory-faint">
              {progress.completed} / {progress.total} missions · {progress.earnedXp} / {progress.xp} XP
            </span>
          </span>

          <StatusBadge bare tone={BADGE_TONE[status]} className="shrink-0">
            {MISSION_STATUS_LABEL[status]}
          </StatusBadge>
        </button>
      </h3>

      {open && (
        <div id={panelId} className="px-3 pb-3">
          <p className="mb-3 text-sm leading-relaxed text-ivory-dim">
            <Described text={chapter.description} />
          </p>

          <ol className="space-y-0">
            {missions.map((mission, index) => (
              <MissionRow
                key={mission.id}
                mission={mission}
                last={index === missions.length - 1}
                nextStatus={missions[index + 1]?.status ?? null}
                expanded={expandedMissionId === mission.id}
                onToggle={() => onExpandMission(mission.id)}
                animateTrail={justCompleted === mission.order}
                campaignId={campaignId}
                onStart={() => onStart(mission)}
                onComplete={() => onComplete(mission)}
                onAskFail={() => onAskFail(mission)}
                onRetry={() => onRetry(mission)}
              />
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* One mission                                                         */
/* ------------------------------------------------------------------ */

function MissionRow({
  mission,
  last,
  nextStatus,
  expanded,
  onToggle,
  animateTrail,
  campaignId,
  onStart,
  onComplete,
  onAskFail,
  onRetry,
}: {
  mission: CampaignMission;
  last: boolean;
  nextStatus: MissionStatus | null;
  expanded: boolean;
  onToggle: () => void;
  animateTrail: boolean;
  campaignId: Id;
  onStart: () => void;
  onComplete: () => void;
  onAskFail: () => void;
  onRetry: () => void;
}) {
  const setMissionNotes = useAppStore((s) => s.setMissionNotes);
  const [draft, setDraft] = useState(mission.notes);
  const panelId = `mission-${mission.id}`;

  // The store is the source of truth; the textarea only holds an unsaved edit.
  useEffect(() => setDraft(mission.notes), [mission.notes]);

  const locked = mission.status === 'locked';

  return (
    <li className="relative flex gap-3">
      {/* Rail: the node, and the trail down to the next mission. */}
      <div className="relative flex w-6 shrink-0 flex-col items-center">
        <span
          className={cn(
            'z-10 mt-2.5 flex h-6 w-6 items-center justify-center rounded-full border',
            NODE_RING[mission.status],
          )}
        >
          <MissionGlyph status={mission.status} />
        </span>

        {!last && (
          <span aria-hidden className="relative w-[2px] flex-1">
            {/* The unfilled trail: gray toward anything not yet completed. */}
            <span
              className={cn(
                'absolute inset-0',
                mission.status === 'completed' ? 'bg-gold/25' : 'bg-ivory-faint/20',
              )}
            />
            {/* The filled trail: gold once this mission is done. */}
            {mission.status === 'completed' && (
              <span
                className={cn(
                  'absolute inset-0 origin-top bg-gold',
                  animateTrail && 'motion-safe:animate-trail-fill',
                )}
              />
            )}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1 pb-2.5">
        <div
          className={cn(
            'rounded-[2px] border transition-colors duration-200',
            CARD_SKIN[mission.status],
            animateTrail && nextStatus === 'available' && 'motion-safe:animate-unlock-glow',
          )}
        >
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={panelId}
            className="w-full px-2.5 py-2 text-left"
          >
            <span className="flex items-start justify-between gap-2">
              <span className={cn('min-w-0 flex-1 text-base leading-tight', TITLE_TONE[mission.status])}>
                <span className="text-ivory-faint">{mission.order}.</span> {mission.title}
              </span>
              <StatusBadge bare tone={BADGE_TONE[mission.status]} className="shrink-0">
                {MISSION_STATUS_LABEL[mission.status]}
              </StatusBadge>
            </span>

            {/* Schedule and reward stay visible while locked. */}
            <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ivory-faint">
              <span className="inline-flex items-center gap-1">
                <Clock aria-hidden className="h-3 w-3" />
                {missionTimeRange(mission)}
              </span>
              <span className="inline-flex min-w-0 items-center gap-1">
                <MapPin aria-hidden className="h-3 w-3 shrink-0" />
                <span className="min-w-0">{mission.location}</span>
              </span>
              <span className={mission.status === 'completed' ? 'text-gold' : 'text-teal'}>
                {mission.xp} XP
              </span>
            </span>

            {!expanded && (
              <span className="mt-1 block text-sm leading-relaxed text-ivory-faint">
                {shortDescription(mission.description)}
              </span>
            )}
          </button>

          {expanded && (
            <div id={panelId} className="border-t border-gold/15 px-2.5 py-2.5">
              <p className="text-base leading-relaxed text-ivory-dim">
                <Described text={mission.description} />
              </p>

              <dl className="mt-2.5 space-y-0.5 text-sm">
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-ivory-faint">Date</dt>
                  <dd className="min-w-0 text-ivory">{formatMissionDate(mission.date)}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-ivory-faint">Time</dt>
                  <dd className="min-w-0 text-ivory">{missionTimeRange(mission)}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-ivory-faint">Location</dt>
                  <dd className="min-w-0 text-ivory">{mission.location}</dd>
                </div>
              </dl>

              {mission.locationUnconfirmed && (
                <p className="mt-2 flex items-start gap-1.5 rounded-[2px] border border-gold/40 bg-gold/[0.07] px-2.5 py-1.5 text-sm leading-relaxed text-gold">
                  <AlertTriangle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    <strong className="font-semibold">Unconfirmed location.</strong> Confirm the
                    room with a Crew Captain before this session.
                  </span>
                </p>
              )}

              {mission.status === 'failed' && (
                <p className="mt-2 rounded-[2px] border border-danger-dim bg-danger/[0.06] px-2.5 py-1.5 text-sm leading-relaxed text-ivory-dim">
                  Marked failed. It paid no XP and removed none. Retry it to put it back on the
                  path and continue the campaign.
                </p>
              )}

              {mission.status === 'completed' && (
                <p className="mt-2 text-sm leading-relaxed text-gold">
                  Completed. Its {mission.xp} XP is already in the ledger and cannot be claimed
                  again.
                </p>
              )}

              {/* Personal notes: separate from the official description, and
                  kept through completion, failure and retry. */}
              <label className="mt-3 block">
                <span className="label-caps text-gold">Your notes</span>
                <textarea
                  className="field mt-1 min-h-[4.5rem] resize-y text-sm"
                  placeholder="Anything you want to remember about this session."
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onBlur={() => {
                    if (draft !== mission.notes) setMissionNotes(campaignId, mission.id, draft);
                  }}
                />
              </label>

              {/* A locked mission shows everything above and no way to act. */}
              {locked ? (
                <p className="mt-3 flex items-center gap-1.5 text-sm text-ivory-faint">
                  <Lock aria-hidden className="h-3.5 w-3.5 shrink-0" />
                  Complete the mission before this one to unlock it.
                </p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {canStart(mission) && (
                    <GameButton variant="secondary" size="sm" className="flex-1" onClick={onStart}>
                      Start mission
                    </GameButton>
                  )}
                  {canComplete(mission) && (
                    <GameButton variant="primary" size="sm" className="flex-1" onClick={onComplete}>
                      Complete mission
                    </GameButton>
                  )}
                  {canFail(mission) && (
                    <GameButton variant="ghost" size="sm" className="flex-1" onClick={onAskFail}>
                      Mark as failed
                    </GameButton>
                  )}
                  {canRetry(mission) && (
                    <GameButton variant="secondary" size="sm" className="flex-1" onClick={onRetry}>
                      <RotateCcw aria-hidden className="h-3.5 w-3.5" />
                      Retry mission
                    </GameButton>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
