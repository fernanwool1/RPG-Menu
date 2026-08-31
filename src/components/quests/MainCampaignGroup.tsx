'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { campaignProgress, formatMissionDate, missionTimeRange, nextMission } from '@/domain/campaigns';
import type { Id } from '@/domain/types';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/cn';

import { CampaignListCard } from './CampaignPanel';

/**
 * The collapsible MAIN CAMPAIGN group inside the Quest Log.
 *
 * Deliberately the same object as DAILY QUESTS directly above it: collapsed it
 * is one row — the name, the mission count, the next thing due and a chevron.
 * Expanded it stacks the campaign cards in a region that scrolls on its own,
 * so a campaign never pushes the quest list off screen.
 *
 * Like Daily Quests, this group sits above the search and filters and is not
 * subject to them: a campaign is a standing commitment, not a board entry that
 * should disappear when you filter by category.
 */
export function MainCampaignGroup({
  selectedId,
  onSelect,
}: {
  selectedId: Id | null;
  onSelect: (id: Id) => void;
}) {
  const campaigns = useAppStore((s) => s.campaigns);

  // Starts collapsed, exactly like Daily Quests.
  const [expanded, setExpanded] = useState(false);

  if (campaigns.length === 0) return null;

  // Totals across every campaign, so the header row reads the same whether
  // there is one campaign or several.
  const totals = campaigns.reduce(
    (sum, campaign) => {
      const progress = campaignProgress(campaign);
      return {
        completed: sum.completed + progress.completed,
        total: sum.total + progress.total,
        earnedXp: sum.earnedXp + progress.earnedXp,
        totalXp: sum.totalXp + progress.totalXp,
      };
    },
    { completed: 0, total: 0, earnedXp: 0, totalXp: 0 },
  );

  const allDone = totals.total > 0 && totals.completed === totals.total;

  // The soonest unfinished mission across the active campaigns.
  const upNext = campaigns
    .filter((campaign) => campaign.status !== 'completed')
    .map((campaign) => nextMission(campaign))
    .filter((mission) => mission !== null)
    .sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order)[0];

  return (
    <section
      className={cn(
        'shrink-0 rounded-[3px] border transition-colors duration-200',
        expanded ? 'border-teal/45 bg-teal/[0.03]' : 'border-gold/30',
      )}
    >
      {/* ---------------- header ---------------- */}
      <h3>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls="main-campaign-panel"
          className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors duration-200 hover:bg-gold/[0.04]"
        >
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="panel-title !text-left">Main Campaign</span>
              <span
                className={cn('text-lg tabular-nums', allDone ? 'text-gold-bright' : 'text-ivory')}
              >
                {totals.completed} / {totals.total}
              </span>
            </span>
            <span className="mt-0.5 block text-xs text-ivory-faint">
              {upNext
                ? `Next: ${upNext.title} · ${formatMissionDate(upNext.date)}`
                : allDone
                  ? 'Every mission completed'
                  : 'No mission scheduled'}
            </span>
          </span>

          <ChevronDown
            aria-hidden
            className={cn(
              'h-5 w-5 shrink-0 text-gold transition-transform duration-200',
              expanded && 'rotate-180',
            )}
          />
        </button>
      </h3>

      {/* ---------------- expanded ---------------- */}
      {expanded && (
        <div id="main-campaign-panel" className="border-t border-gold/20 px-3 pb-3 pt-3">
          <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="text-xs text-ivory-faint">
              One ordered path. Each mission pays its own XP once.
            </p>
            <p className="shrink-0 text-xs tabular-nums text-teal">
              {totals.earnedXp} / {totals.totalXp} XP
            </p>
          </div>

          {upNext && (
            <p className="mb-2.5 rounded-[2px] border border-gold/25 bg-ink-950/40 px-2.5 py-2 text-xs leading-relaxed text-ivory-dim">
              <span className="text-ivory">{upNext.title}</span>
              <span className="mt-0.5 block text-ivory-faint">
                {formatMissionDate(upNext.date)}, {missionTimeRange(upNext)} · {upNext.location}
              </span>
            </p>
          )}

          {/* Scrolls on its own, so a long campaign list never pushes the
              quest board out of reach. */}
          <div className="max-h-[min(40rem,60vh)] space-y-2 overflow-y-auto scroll-thin pr-1">
            {campaigns.map((campaign) => (
              <CampaignListCard
                key={campaign.id}
                campaign={campaign}
                selected={selectedId === campaign.id}
                onSelect={() => onSelect(campaign.id)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
