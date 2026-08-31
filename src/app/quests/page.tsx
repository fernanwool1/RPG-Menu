'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Search } from 'lucide-react';

import { DailyProgressSummary } from '@/components/daily/DailyProgressSummary';
import { DailyQuestGroup } from '@/components/daily/DailyQuestGroup';
import { ResponsiveStage } from '@/components/layout/ResponsiveStage';
import { CampaignPanel } from '@/components/quests/CampaignPanel';
import { MainCampaignGroup } from '@/components/quests/MainCampaignGroup';
import { QuestEditor } from '@/components/quests/QuestEditor';
import {
  ActiveFilterChips,
  MobileFab,
  MobileTodayStrip,
  QuestFiltersSheet,
} from '@/components/quests/MobileQuestExtras';
import { DetailActions, SectionLabel, StatList, StatRow } from '@/components/ui/DetailPanel';
import { EmptyState } from '@/components/ui/EmptyState';
import { GameButton } from '@/components/ui/GameButton';
import { GamePanel } from '@/components/ui/GamePanel';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { StatusBadge, questTone } from '@/components/ui/StatusBadge';
import { Tabs } from '@/components/ui/Tabs';
import { formatRelativeDay } from '@/domain/ids';
import {
  QUEST_DIFFICULTY_LABEL,
  QUEST_PRIORITY_LABEL,
  QUEST_STATUS_LABEL,
  QUEST_TYPE_LABEL,
  allObjectivesDone,
  compareQuests,
  deadlineState,
  formatDeadline,
  questProgress,
  splitQuestXp,
} from '@/domain/quests';
import type { Id, Quest, QuestStatus, QuestType } from '@/domain/types';
import { useDailyClock } from '@/store/dailySelectors';
import { useNodeName } from '@/store/selectors';
import { useAppStore } from '@/store/useAppStore';
import { useIsMobile } from '@/lib/useBreakpoint';
import { cn } from '@/lib/cn';

type StatusFilter = 'open' | 'completed' | 'failed' | 'archived' | 'all';

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'open', label: 'Open' },
  { value: 'completed', label: 'Done' },
  { value: 'failed', label: 'Failed' },
  { value: 'archived', label: 'Archived' },
  { value: 'all', label: 'All' },
];

export default function QuestsPage() {
  const quests = useAppStore((s) => s.quests);
  const campaigns = useAppStore((s) => s.campaigns);
  const toggleObjective = useAppStore((s) => s.toggleObjective);
  const moveObjective = useAppStore((s) => s.moveObjective);
  const completeQuest = useAppStore((s) => s.completeQuest);
  const failQuest = useAppStore((s) => s.failQuest);
  const reopenQuest = useAppStore((s) => s.reopenQuest);
  const archiveQuest = useAppStore((s) => s.archiveQuest);
  const duplicateQuest = useAppStore((s) => s.duplicateQuest);
  const deleteQuest = useAppStore((s) => s.deleteQuest);
  const nodeName = useNodeName();

  // Drives the reset countdown and rolls the day over at 11:59 PM local,
  // even if the tab is left open across the boundary.
  const { today: todayKey, countdown } = useDailyClock();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const [typeFilter, setTypeFilter] = useState<QuestType | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<Id | null>(null);
  /* A campaign is not a quest, so it gets its own selection. Choosing either
     one clears the other; the detail pane shows whichever is current. */
  const [selectedCampaignId, setSelectedCampaignId] = useState<Id | null>(null);
  const [paneIndex, setPaneIndex] = useState(1);

  const [editing, setEditing] = useState<{ open: boolean; questId: Id | null }>({
    open: false,
    questId: null,
  });
  const isMobile = useIsMobile();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [confirmFail, setConfirmFail] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Mobile is a drill-down, so it starts at the list rather than mid-stack.
  useEffect(() => {
    if (isMobile) setPaneIndex(0);
  }, [isMobile]);

  const categories = useMemo(
    () => [...new Set(quests.map((q) => q.category))].sort(),
    [quests],
  );

  const matchesStatus = (status: QuestStatus): boolean => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'open') return status === 'planned' || status === 'active';
    return status === statusFilter;
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return quests
      .filter((q) => matchesStatus(q.status))
      .filter((q) => typeFilter === 'all' || q.type === typeFilter)
      .filter((q) => categoryFilter === 'all' || q.category === categoryFilter)
      .filter(
        (q) =>
          term === '' ||
          q.title.toLowerCase().includes(term) ||
          q.description.toLowerCase().includes(term) ||
          q.category.toLowerCase().includes(term),
      )
      .sort(compareQuests);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quests, statusFilter, typeFilter, categoryFilter, search]);

  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId) ?? null;
  const selected = quests.find((q) => q.id === selectedId) ?? filtered[0] ?? null;
  const progress = selected ? questProgress(selected) : null;

  const selectQuest = (id: Id) => {
    setSelectedCampaignId(null);
    setSelectedId(id);
    setPaneIndex(1);
  };

  /* ---------------- right-hand summary data ---------------- */

  const today = useMemo(() => {
    const open = quests.filter((q) => q.status === 'planned' || q.status === 'active');
    const dueToday = open.filter((q) => deadlineState(q) === 'today');
    const overdue = open.filter((q) => deadlineState(q) === 'overdue');
    const soon = open.filter((q) => deadlineState(q) === 'soon');
    const completedToday = quests.filter(
      (q) => q.completedAt && new Date(q.completedAt).toDateString() === new Date().toDateString(),
    );
    const xpToday = completedToday.reduce((sum, q) => sum + q.characterXp, 0);
    return { open, dueToday, overdue, soon, completedToday, xpToday };
  }, [quests]);

  const upcoming = useMemo(
    () =>
      quests
        .filter((q) => (q.status === 'planned' || q.status === 'active') && q.deadline)
        .sort(
          (a, b) => new Date(a.deadline as string).getTime() - new Date(b.deadline as string).getTime(),
        )
        .slice(0, 6),
    [quests],
  );

  /* ---------------- panels ---------------- */

  const listPanel = (
    <GamePanel title="Quest Log" className="h-full" bodyClassName="flex min-h-0 flex-1 flex-col p-3">
      {isMobile && (
        <>
          <MobileTodayStrip
            open={today.open.length}
            dueToday={today.dueToday.length}
            overdue={today.overdue.length}
            xpToday={today.xpToday}
            onOpenToday={() => setPaneIndex(2)}
          />
          <div className="divider-diamond my-3 shrink-0" />
        </>
      )}

      {/*
       * The two standing groups share one capped scroll region.
       *
       * Either one, expanded, is taller than the panel on a laptop; without
       * the cap they push the search, the filters and the quest board out of
       * the bottom of the panel entirely. The cap applies only from tablet up,
       * because the mobile shell scrolls the document and must not grow a
       * second scroller inside it.
       *
       * The quest list below carries a matching `md:min-h` floor, so expanding
       * a group squeezes this region rather than collapsing the board to
       * nothing.
       */}
      <div className="scroll-thin min-h-0 space-y-2.5 max-md:shrink-0 md:max-h-[min(44rem,62vh)] md:overflow-y-auto md:pr-1">
        <DailyQuestGroup today={todayKey} countdown={countdown} />

        <MainCampaignGroup
          selectedId={selectedCampaignId}
          onSelect={(id) => {
            setSelectedCampaignId(id);
            setPaneIndex(1);
          }}
        />
      </div>

      <div className="divider-diamond my-3 shrink-0" />

      <div className="shrink-0 space-y-2">
        <label className="relative block">
          <span className="sr-only">Search quests</span>
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-[1.15rem] w-[1.15rem] -translate-y-1/2 text-gold/60"
          />
          <input
            className="field !pl-11"
            type="search"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        <Tabs
          items={STATUS_FILTERS}
          value={statusFilter}
          onChange={setStatusFilter}
          label="Filter by status"
          size="sm"
        />

        {isMobile ? (
          <ActiveFilterChips
            filters={{ type: typeFilter, category: categoryFilter }}
            resultCount={filtered.length}
            onClearType={() => setTypeFilter('all')}
            onClearCategory={() => setCategoryFilter('all')}
            onOpenFilters={() => setFiltersOpen(true)}
          />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className="sr-only">Filter by type</span>
              <select
                className="field py-1 text-xs"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as QuestType | 'all')}
              >
                <option value="all">All types</option>
                {(Object.keys(QUEST_TYPE_LABEL) as QuestType[]).map((t) => (
                  <option key={t} value={t}>
                    {QUEST_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="sr-only">Filter by category</span>
              <select
                className="field py-1 text-xs"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>

      <div className="divider-diamond my-2.5 shrink-0" />

      {filtered.length === 0 ? (
        <EmptyState
          icon="map"
          title={quests.length === 0 ? 'No quests yet' : 'Nothing matches'}
          body={
            quests.length === 0
              ? 'Start with a quest. Objectives track its progress, and finishing it moves your character.'
              : 'No quest matches these filters. Try widening them.'
          }
          action={
            quests.length === 0 ? (
              <GameButton
                variant="primary"
                onClick={() => setEditing({ open: true, questId: null })}
              >
                + New quest
              </GameButton>
            ) : (
              <GameButton
                variant="secondary"
                onClick={() => {
                  setStatusFilter('all');
                  setTypeFilter('all');
                  setCategoryFilter('all');
                  setSearch('');
                }}
              >
                Clear filters
              </GameButton>
            )
          }
        />
      ) : (
        <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto scroll-thin pr-0.5 md:min-h-[7rem]">
          {filtered.map((quest) => {
            const isSelected = selectedCampaign === null && quest.id === selected?.id;
            const p = questProgress(quest);
            const due = deadlineState(quest);

            return (
              <li key={quest.id}>
                <button
                  type="button"
                  onClick={() => selectQuest(quest.id)}
                  aria-current={isSelected ? 'true' : undefined}
                  className={cn(
                    'relative w-full rounded-[2px] border px-2.5 py-2 text-left transition-colors duration-200',
                    isSelected
                      ? 'border-teal/55 bg-teal/[0.07]'
                      : 'border-gold/25 hover:border-gold/50 hover:bg-gold/[0.04]',
                  )}
                >
                  {isSelected && (
                    <span aria-hidden className="absolute inset-y-1 left-0 w-[2px] bg-teal shadow-glow" />
                  )}

                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0 flex-1 text-base leading-tight text-ivory">
                      {quest.title}
                    </span>
                    <StatusBadge bare tone={questTone(quest.status)} className="shrink-0">
                      {QUEST_TYPE_LABEL[quest.type]}
                    </StatusBadge>
                  </span>

                  {/* Wraps rather than truncating: at 360px a long category
                      like "Languages & Communication" would otherwise clip. */}
                  <span className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-xs">
                    <span className="min-w-0 text-ivory-faint">{quest.category}</span>
                    <span
                      className={cn(
                        'shrink-0',
                        due === 'overdue'
                          ? 'text-danger'
                          : due === 'today'
                            ? 'text-teal'
                            : 'text-ivory-faint',
                      )}
                    >
                      {due === 'overdue'
                        ? 'Overdue'
                        : due === 'today'
                          ? 'Due today'
                          : quest.deadline
                            ? formatRelativeDay(quest.deadline)
                            : '—'}
                    </span>
                  </span>

                  {p.total > 0 && (
                    <ProgressBar
                      className="mt-1.5"
                      size="sm"
                      value={p.fraction}
                      valueText={`${p.done} of ${p.total} objectives`}
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </GamePanel>
  );

  const detailPanel = (
    <GamePanel className="h-full" bodyClassName="flex min-h-0 flex-1 flex-col p-4">
      {selectedCampaign ? (
        <div className="min-h-0 flex-1 overflow-y-auto scroll-thin pr-1">
          <CampaignPanel campaign={selectedCampaign} />
        </div>
      ) : !selected || !progress ? (
        <EmptyState
          icon="map"
          title="No quest selected"
          body="Choose a quest from the list, or start a new one."
          action={
            <GameButton variant="primary" onClick={() => setEditing({ open: true, questId: null })}>
              + New quest
            </GameButton>
          }
        />
      ) : (
        <>
          <div className="shrink-0">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-xl uppercase tracking-wider2 text-gold-bright">
                {selected.title}
              </h2>
              <StatusBadge tone={questTone(selected.status)} className="mt-1 shrink-0">
                {QUEST_STATUS_LABEL[selected.status]}
              </StatusBadge>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ivory-faint">
              <span>{QUEST_TYPE_LABEL[selected.type]}</span>
              <span aria-hidden>·</span>
              <span>{selected.category}</span>
              <span aria-hidden>·</span>
              <span>{QUEST_DIFFICULTY_LABEL[selected.difficulty]}</span>
              <span aria-hidden>·</span>
              <span>{QUEST_PRIORITY_LABEL[selected.priority]} priority</span>
              {selected.recurrence !== 'none' && (
                <>
                  <span aria-hidden>·</span>
                  <span>Repeats {selected.recurrence}</span>
                </>
              )}
            </div>

            <div className="divider-diamond my-3" />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto scroll-thin pr-1">
            {selected.description && (
              <p className="text-base leading-relaxed text-ivory">{selected.description}</p>
            )}

            <SectionLabel className="mb-2 mt-4">Objectives</SectionLabel>
            {selected.objectives.length === 0 ? (
              <p className="text-center text-sm text-ivory-faint">
                This quest has no objectives. It completes in one step.
              </p>
            ) : (
              <>
                <ul className="space-y-1">
                  {[...selected.objectives]
                    .sort((a, b) => a.order - b.order)
                    .map((objective, index, all) => (
                      <li key={objective.id} className="flex items-center gap-2">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={objective.done}
                          onClick={() => toggleObjective(selected.id, objective.id)}
                          disabled={selected.status === 'archived'}
                          className={cn(
                            'flex min-w-0 flex-1 items-center gap-2.5 rounded-[2px] border px-2.5 py-1.5 text-left',
                            'transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50',
                            objective.done
                              ? 'border-teal/40 bg-teal/[0.06]'
                              : 'border-gold/20 hover:border-gold/50 hover:bg-gold/[0.04]',
                          )}
                        >
                          <span
                            className={cn(
                              'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[2px] border',
                              objective.done
                                ? 'border-teal bg-teal/20 text-teal'
                                : 'border-ivory-faint/50',
                            )}
                          >
                            {objective.done && (
                              <Check aria-hidden className="h-3 w-3" strokeWidth={2.5} />
                            )}
                          </span>
                          <span
                            className={cn(
                              'min-w-0 flex-1 text-base',
                              objective.done ? 'text-ivory-dim line-through' : 'text-ivory',
                            )}
                          >
                            {objective.label}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => moveObjective(selected.id, objective.id, -1)}
                          disabled={index === 0}
                          aria-label={`Move "${objective.label}" up`}
                          title="Move up"
                          className="shrink-0 text-ivory-faint transition-colors duration-200 hover:text-ivory disabled:opacity-25"
                        >
                          <ChevronUp aria-hidden className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveObjective(selected.id, objective.id, 1)}
                          disabled={index === all.length - 1}
                          aria-label={`Move "${objective.label}" down`}
                          title="Move down"
                          className="shrink-0 text-ivory-faint transition-colors duration-200 hover:text-ivory disabled:opacity-25"
                        >
                          <ChevronDown aria-hidden className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                </ul>

                <ProgressBar
                  className="mt-3"
                  value={progress.fraction}
                  label="Progress"
                  valueText={`${progress.done} of ${progress.total} objectives`}
                />
              </>
            )}

            <SectionLabel className="mb-2 mt-4">Reward</SectionLabel>
            <StatList>
              <StatRow
                label="Character XP"
                value={<span className="text-teal">{selected.characterXp} XP</span>}
              />
              {splitQuestXp(selected).allocations.map((allocation) => (
                <StatRow
                  key={allocation.skillNodeId}
                  label={nodeName(allocation.skillNodeId)}
                  value={`${allocation.xp} XP`}
                />
              ))}
              {splitQuestXp(selected).unallocated > 0 &&
                selected.skillAllocations.length > 0 && (
                  <StatRow
                    label="Unallocated"
                    value={`${splitQuestXp(selected).unallocated} XP`}
                  />
                )}
              <StatRow label="Deadline" value={formatDeadline(selected.deadline)} />
              {selected.xpAwardedAt && (
                <StatRow
                  label="XP awarded"
                  value={
                    <span className="text-teal">{formatRelativeDay(selected.xpAwardedAt)}</span>
                  }
                />
              )}
            </StatList>
            <p className="mt-1.5 text-xs leading-relaxed text-ivory-faint">
              Skill XP is carved out of the {selected.characterXp} XP above, not added to it.
            </p>

            {selected.rewards.length > 0 && (
              <>
                <SectionLabel className="mb-2 mt-4">Object rewards</SectionLabel>
                <ul className="space-y-1">
                  {selected.rewards.map((reward) => (
                    <li key={reward.id} className="flex items-center gap-2 text-base">
                      <span aria-hidden className="h-1 w-1 shrink-0 rounded-full bg-gold" />
                      <span className="min-w-0 flex-1 text-ivory">{reward.label}</span>
                      <span className="shrink-0 text-xs uppercase tracking-wider2 text-ivory-faint">
                        {reward.kind.replace('-', ' ')}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {selected.attachments.length > 0 && (
              <>
                <SectionLabel className="mb-2 mt-4">Attachments</SectionLabel>
                <ul className="space-y-1">
                  {selected.attachments.map((attachment) => (
                    <li key={attachment.id}>
                      <a
                        href={attachment.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-base text-teal underline decoration-teal/40 underline-offset-2 transition-colors duration-200 hover:text-teal-bright"
                      >
                        {attachment.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {selected.notes && (
              <>
                <SectionLabel className="mb-2 mt-4">Notes</SectionLabel>
                <p className="text-base leading-relaxed text-ivory-dim">{selected.notes}</p>
              </>
            )}

            {selected.status === 'failed' && (
              <p className="mt-4 rounded-[2px] border border-danger-dim bg-danger/[0.06] p-2.5 text-sm leading-relaxed text-ivory-dim">
                This quest was failed. Everything it earned along the way stays earned — failing
                never removes XP or reduces your level.
              </p>
            )}
          </div>

          <DetailActions
            className={cn(
              'shrink-0',
              isMobile &&
                'sticky bottom-0 -mx-4 -mb-4 border-t border-gold/25 bg-[var(--panel-fill-solid)] px-4 pb-4',
            )}
          >
            {selected.status !== 'completed' && selected.status !== 'archived' && (
              <GameButton
                variant="primary"
                block
                onClick={() => setConfirmComplete(true)}
                disabled={selected.status === 'failed'}
              >
                {allObjectivesDone(selected) ? 'Complete quest' : 'Complete quest early'}
              </GameButton>
            )}

            {(selected.status === 'completed' || selected.status === 'failed') && (
              <GameButton variant="secondary" block onClick={() => reopenQuest(selected.id)}>
                Reopen quest
              </GameButton>
            )}

            {/* On a phone the secondary actions move into an overflow sheet,
                leaving one unmistakable primary action under the thumb. */}
            {isMobile ? (
              <GameButton variant="ghost" block onClick={() => setActionsOpen(true)}>
                More actions
              </GameButton>
            ) : (
            <div className="flex flex-wrap gap-1.5">
              <GameButton
                variant="ghost"
                size="sm"
                className="flex-1"
                onClick={() => setEditing({ open: true, questId: selected.id })}
              >
                Edit
              </GameButton>
              <GameButton
                variant="ghost"
                size="sm"
                className="flex-1"
                onClick={() => {
                  const id = duplicateQuest(selected.id);
                  if (id) setSelectedId(id);
                }}
              >
                Duplicate
              </GameButton>
              {selected.status !== 'failed' && selected.status !== 'completed' && (
                <GameButton
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                  onClick={() => setConfirmFail(true)}
                >
                  Mark failed
                </GameButton>
              )}
              {selected.status !== 'archived' && (
                <GameButton
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                  onClick={() => archiveQuest(selected.id)}
                >
                  Archive
                </GameButton>
              )}
              <GameButton
                variant="danger"
                size="sm"
                className="flex-1"
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </GameButton>
            </div>
            )}
          </DetailActions>
        </>
      )}
    </GamePanel>
  );

  const summaryPanel = (
    <GamePanel
      title="Today"
      className="h-full"
      bodyClassName="flex min-h-0 flex-1 flex-col p-3.5"
    >
      {/*
       * One scroll region, one pinned footer. Everything above the button
       * scrolls together; nothing is allowed to shrink below its content and
       * spill over the action underneath it.
       */}
      <div className="min-h-0 flex-1 overflow-y-auto scroll-thin pr-1">
      <div className="grid grid-cols-3 gap-2">
        <Tally label="Open" value={today.open.length} />
        <Tally label="Due today" value={today.dueToday.length} tone={today.dueToday.length > 0 ? 'teal' : undefined} />
        <Tally
          label="Overdue"
          value={today.overdue.length}
          tone={today.overdue.length > 0 ? 'danger' : undefined}
        />
      </div>

      <div className="mt-2 rounded-[2px] border border-gold/25 bg-ink-950/40 px-3 py-2 text-center">
        <div className="label-caps text-gold">Earned today</div>
        <div className="mt-0.5 font-display text-xl text-teal">+{today.xpToday} XP</div>
        <div className="text-xs text-ivory-faint">
          {today.completedToday.length} quest{today.completedToday.length === 1 ? '' : 's'} completed
        </div>
      </div>

      <div className="divider-diamond my-3" />

      <DailyProgressSummary today={todayKey} countdown={countdown} />

      <div className="divider-diamond my-3" />

      <SectionLabel className="mb-2">Deadlines</SectionLabel>
      <div>
        {upcoming.length === 0 ? (
          <EmptyState
            compact
            icon="pillar"
            title="Nothing scheduled"
            body="No open quest has a deadline."
          />
        ) : (
          <ul className="space-y-1">
            {upcoming.map((quest) => {
              const due = deadlineState(quest);
              return (
                <li key={quest.id}>
                  <button
                    type="button"
                    onClick={() => selectQuest(quest.id)}
                    className="w-full rounded-[2px] border border-gold/20 px-2.5 py-1.5 text-left transition-colors duration-200 hover:border-gold/50 hover:bg-gold/[0.04]"
                  >
                    <span className="block truncate text-sm text-ivory">{quest.title}</span>
                    <span
                      className={cn(
                        'block text-xs',
                        due === 'overdue'
                          ? 'text-danger'
                          : due === 'today'
                            ? 'text-teal'
                            : 'text-ivory-faint',
                      )}
                    >
                      {formatDeadline(quest.deadline)}
                      {due === 'overdue' && ' · overdue'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      </div>

      {/* Permanent action: stays put however long the lists above get. */}
      <DetailActions className="shrink-0 border-t border-gold/20">
        <GameButton
          variant="primary"
          block
          size="lg"
          onClick={() => setEditing({ open: true, questId: null })}
        >
          + New quest
        </GameButton>
      </DetailActions>
    </GamePanel>
  );

  return (
    <>
      <ResponsiveStage
        activeIndex={paneIndex}
        onActiveIndexChange={setPaneIndex}
        panes={[
          { id: 'list', label: 'Quest Log', node: listPanel, className: 'w-[29rem] shrink-0' },
          {
            id: 'detail',
            label: selectedCampaign?.title ?? selected?.title ?? 'Detail',
            node: detailPanel,
            className: 'flex-1',
          },
          { id: 'today', label: 'Today', node: summaryPanel, className: 'w-[22rem] shrink-0' },
        ]}
      />

      {/* A permanent New Quest affordance that clears the tab bar. */}
      {isMobile && paneIndex === 0 && (
        <MobileFab label="+ New Quest" onClick={() => setEditing({ open: true, questId: null })} />
      )}

      <QuestFiltersSheet
        open={filtersOpen}
        filters={{ type: typeFilter, category: categoryFilter }}
        categories={categories}
        resultCount={filtered.length}
        onChange={(next) => {
          if (next.type !== undefined) setTypeFilter(next.type);
          if (next.category !== undefined) setCategoryFilter(next.category);
        }}
        onReset={() => {
          setTypeFilter('all');
          setCategoryFilter('all');
        }}
        onClose={() => setFiltersOpen(false)}
      />

      {/* The quest's secondary actions, as a sheet on mobile. */}
      <Modal
        open={actionsOpen && selected !== null}
        onClose={() => setActionsOpen(false)}
        title={selected?.title ?? 'Quest actions'}
        size="sm"
        footer={
          <GameButton variant="ghost" onClick={() => setActionsOpen(false)}>
            Cancel
          </GameButton>
        }
      >
        <div className="flex flex-col gap-2">
          <GameButton
            variant="secondary"
            block
            onClick={() => {
              setActionsOpen(false);
              if (selected) setEditing({ open: true, questId: selected.id });
            }}
          >
            Edit
          </GameButton>
          <GameButton
            variant="secondary"
            block
            onClick={() => {
              setActionsOpen(false);
              if (selected) {
                const id = duplicateQuest(selected.id);
                if (id) setSelectedId(id);
              }
            }}
          >
            Duplicate
          </GameButton>
          {selected && selected.status !== 'failed' && selected.status !== 'completed' && (
            <GameButton
              variant="secondary"
              block
              onClick={() => {
                setActionsOpen(false);
                setConfirmFail(true);
              }}
            >
              Mark failed
            </GameButton>
          )}
          {selected && selected.status !== 'archived' && (
            <GameButton
              variant="secondary"
              block
              onClick={() => {
                setActionsOpen(false);
                archiveQuest(selected.id);
              }}
            >
              Archive
            </GameButton>
          )}
          <GameButton
            variant="danger"
            block
            onClick={() => {
              setActionsOpen(false);
              setConfirmDelete(true);
            }}
          >
            Delete
          </GameButton>
        </div>
      </Modal>

      <QuestEditor
        open={editing.open}
        quest={quests.find((q) => q.id === editing.questId) ?? null}
        onClose={() => setEditing({ open: false, questId: null })}
      />

      <ConfirmDialog
        open={confirmComplete}
        title="Complete this quest?"
        body={
          selected ? (
            <>
              <strong className="text-ivory">{selected.title}</strong> will be marked complete
              {!allObjectivesDone(selected) && ', and every remaining objective ticked'}.
              {selected.xpAwardedAt ? (
                <> Its XP was already paid out, so nothing further will be awarded.</>
              ) : (
                <>
                  {' '}
                  It awards <span className="text-teal">{selected.characterXp} XP</span>, once.
                  {selected.rewards.some((r) => r.kind === 'inventory-item') &&
                    ' Reward items will be added to your inventory.'}
                </>
              )}
            </>
          ) : null
        }
        confirmLabel="Complete"
        onConfirm={() => {
          if (selected) completeQuest(selected.id);
          setConfirmComplete(false);
        }}
        onCancel={() => setConfirmComplete(false)}
      />

      <ConfirmDialog
        open={confirmFail}
        title="Mark this quest failed?"
        body="It moves to Failed and can end a streak. No XP is removed, your lifetime total does not change, and your level cannot go down. You can reopen it later."
        confirmLabel="Mark failed"
        onConfirm={() => {
          if (selected) failQuest(selected.id);
          setConfirmFail(false);
        }}
        onCancel={() => setConfirmFail(false)}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this quest?"
        body={
          <>
            Deleting removes the quest permanently. Any XP it already paid stays in the ledger,
            because the ledger is append-only. Archiving keeps the record and is usually what you
            want.
          </>
        }
        confirmLabel="Delete permanently"
        destructive
        alternative={
          selected
            ? {
                label: 'Archive instead',
                onSelect: () => {
                  archiveQuest(selected.id);
                  setConfirmDelete(false);
                },
              }
            : undefined
        }
        onConfirm={() => {
          if (selected) {
            deleteQuest(selected.id);
            setSelectedId(null);
          }
          setConfirmDelete(false);
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

function Tally({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'teal' | 'danger';
}) {
  return (
    <div className="rounded-[2px] border border-gold/25 bg-ink-950/40 px-2 py-2 text-center">
      <div
        className={cn(
          'font-display text-xl',
          tone === 'danger' ? 'text-danger' : tone === 'teal' ? 'text-teal' : 'text-ivory',
        )}
      >
        {value}
      </div>
      <div className="text-2xs uppercase tracking-wider2 text-ivory-faint">{label}</div>
    </div>
  );
}
