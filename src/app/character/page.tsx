'use client';

import { useEffect, useMemo, useState } from 'react';

import { AttributeRadar } from '@/components/character/AttributeRadar';
import { DataManagement } from '@/components/character/DataManagement';
import { ResponsiveStage } from '@/components/layout/ResponsiveStage';
import { DetailActions, SectionLabel, StatList, StatRow } from '@/components/ui/DetailPanel';
import { GameButton } from '@/components/ui/GameButton';
import { GamePanel } from '@/components/ui/GamePanel';
import { Modal } from '@/components/ui/Modal';
import { NavList, NavListItem } from '@/components/ui/NavList';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { COMPONENT_WEIGHTS } from '@/domain/attributes';
import { GameIcon } from '@/components/ui/GameIcon';
import { domainIcon } from '@/lib/gameIcons';
import { iconFor } from '@/lib/icons';
import {
  useActiveDomains,
  useAttributeScores,
  useCharacterProgress,
  useDerivedLevels,
} from '@/store/selectors';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/cn';
import { useIsMobile } from '@/lib/useBreakpoint';

const ATTRIBUTE_ICON: Record<string, string> = {
  knowledge: 'book',
  creativity: 'palette',
  discipline: 'pillar',
  endurance: 'shield',
  communication: 'message',
  adaptability: 'sparkles',
};

export default function CharacterPage() {
  const { scores, overall } = useAttributeScores();
  const progress = useCharacterProgress();
  const domains = useActiveDomains();
  const { byDomain } = useDerivedLevels();
  const quests = useAppStore((s) => s.quests);
  const activityLogs = useAppStore((s) => s.activityLogs);
  const profile = useAppStore((s) => s.profile);

  const [selectedKey, setSelectedKey] = useState('knowledge');
  const [paneIndex, setPaneIndex] = useState(1);
  const isMobile = useIsMobile();
  // A drill-down starts at its first level on a phone, never mid-stack.
  useEffect(() => {
    if (isMobile) setPaneIndex(0);
  }, [isMobile]);

  const [showData, setShowData] = useState(false);
  const [showFormula, setShowFormula] = useState(false);
  const [showSources, setShowSources] = useState(false);

  const selected = scores.find((s) => s.key === selectedKey) ?? scores[0];

  /** Domains that feed the selected attribute, strongest first. */
  const strongestSources = useMemo(() => {
    return domains
      .filter((d) => (d.attributeWeights[selected.key] ?? 0) > 0)
      .map((d) => ({ domain: d, level: byDomain[d.id] ?? 0 }))
      .sort((a, b) => b.level - a.level)
      .slice(0, 4);
  }, [domains, byDomain, selected.key]);

  /** Everything that moved this month, used for the "recent change" block. */
  const recent = useMemo(() => {
    const cutoff = Date.now() - 30 * 86_400_000;
    const recentQuests = quests.filter(
      (q) => q.completedAt && new Date(q.completedAt).getTime() >= cutoff,
    );
    const recentLogs = activityLogs.filter(
      (l) => !l.reversedAt && new Date(l.occurredAt).getTime() >= cutoff,
    );
    const xp =
      recentQuests.reduce((sum, q) => sum + q.characterXp, 0) +
      recentLogs.reduce((sum, l) => sum + l.xpAwarded, 0);
    return { quests: recentQuests, logs: recentLogs, xp };
  }, [quests, activityLogs]);

  /* ---------------- panels ---------------- */

  const attributesPanel = (
    <GamePanel title="Attributes" className="h-full">
      <NavList label="Character attributes">
        {scores.map((score) => (
          <NavListItem
            key={score.key}
            icon={ATTRIBUTE_ICON[score.key]}
            label={score.label}
            meta={score.value}
            selected={score.key === selectedKey}
            onSelect={() => {
              setSelectedKey(score.key);
              setPaneIndex(2);
            }}
            className="flex-wrap"
          />
        ))}
      </NavList>

      <div className="mt-2 space-y-2">
        {scores.map((score) => (
          <ProgressBar
            key={score.key}
            value={score.value / 100}
            size="sm"
            label={score.label}
            valueText={`${score.value} / 100`}
          />
        ))}
      </div>

      <div className="divider-diamond my-4" />

      <div className="flex items-baseline justify-between px-1">
        <span className="font-display text-base uppercase tracking-wider3 text-gold">
          Overall rating
        </span>
        <span className="font-display text-3xl text-ivory">{overall}</span>
      </div>
      <p className="mt-1 px-1 text-xs leading-relaxed text-ivory-faint">
        The plain mean of the six attributes above.
      </p>
    </GamePanel>
  );

  const corePanel = (
    <GamePanel title="Character Core" className="h-full" bodyClassName="flex min-h-0 flex-1 flex-col p-3">
      {/* Level, rank and the run to the next level. */}
      <div className="shrink-0 rounded-[2px] border border-gold/25 bg-ink-950/40 p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <div className="font-display text-lg uppercase tracking-wider2 text-gold-bright">
              Level {progress.level}
            </div>
            <div className="text-xs uppercase tracking-wider2 text-teal">{progress.rank}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-ivory-dim">
              {progress.lifetimeXp.toLocaleString()} lifetime XP
            </div>
            <div className="text-xs text-ivory-faint">
              {progress.atCap
                ? 'Maximum level reached'
                : `${progress.xpIntoLevel.toLocaleString()} / ${progress.xpForNextLevel.toLocaleString()} to level ${progress.level + 1}`}
            </div>
          </div>
        </div>
        <ProgressBar
          className="mt-2"
          value={progress.fraction}
          valueText={
            progress.atCap
              ? 'Level 100'
              : `${progress.xpIntoLevel} of ${progress.xpForNextLevel} XP`
          }
        />
      </div>

      <div className="min-h-0 flex-1">
        <AttributeRadar scores={scores} selectedKey={selectedKey} onSelect={setSelectedKey} />
      </div>

      <div className="shrink-0">
        <SectionLabel className="mb-2">Derived from your progress</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          <WeightCard icon="code" label="Skills" pct={COMPONENT_WEIGHTS.skills} />
          <WeightCard icon="quote" label="Quest history" pct={COMPONENT_WEIGHTS.quests} />
          <WeightCard icon="activity" label="Consistency" pct={COMPONENT_WEIGHTS.consistency} />
        </div>
        <button
          type="button"
          onClick={() => setShowFormula(true)}
          className="mt-2 w-full text-center text-xs text-ivory-faint underline decoration-gold/40 underline-offset-2 transition-colors duration-200 hover:text-ivory-dim"
        >
          These formulas are provisional. See how each score is built.
        </button>
      </div>
    </GamePanel>
  );

  /* Shared by the desktop inspector and the mobile stack. */
  const detailBody = (
    <>
      <div className="text-center">
        <h2 className="font-display text-xl uppercase tracking-wider3 text-gold-bright">
          {selected.label}
        </h2>
        <div className="mt-1 flex items-baseline justify-center gap-1.5">
          <span className="font-display text-4xl text-teal">{selected.value}</span>
          <span className="text-base text-ivory-dim">/ 100</span>
        </div>
        <div className="text-base text-ivory-dim">{selected.tier}</div>
      </div>

      <div className="divider-diamond my-3" />

      <p className="text-center text-base leading-relaxed text-ivory">{selected.description}</p>

      <div className="mt-4">
        <SectionLabel className="mb-2">Strongest sources</SectionLabel>
        {strongestSources.length === 0 ? (
          <p className="text-center text-sm text-ivory-faint">
            No domain feeds this attribute yet.
          </p>
        ) : (
          <ul className="space-y-1">
            {strongestSources.map(({ domain, level }) => {
              return (
                <li
                  key={domain.id}
                  className="flex items-center gap-2 border-b border-gold/10 py-1.5 last:border-0"
                >
                  {/* The same emblem this domain shows on Skills and
                      Abilities - one domain, one symbol, everywhere. */}
                  <GameIcon src={domainIcon(domain.id)} size={22} />
                  <span className="min-w-0 flex-1 truncate text-base text-ivory">
                    {domain.name}
                  </span>
                  <span className="shrink-0 text-sm text-gold">Level {level}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-4">
        <SectionLabel className="mb-2">Recent change</SectionLabel>
        <div className="text-center text-lg text-teal">
          +{recent.xp.toLocaleString()} XP in the last 30 days
        </div>
        <ul className="mt-1.5 space-y-1">
          {recent.quests.slice(0, 3).map((quest) => (
            <li key={quest.id} className="flex items-center gap-2 text-sm text-ivory-dim">
              <span aria-hidden className="h-1 w-1 shrink-0 rounded-full bg-teal" />
              <span className="truncate">{quest.title}</span>
            </li>
          ))}
          {recent.quests.length === 0 && (
            <li className="text-center text-xs text-ivory-faint">
              No quests completed in the last 30 days.
            </li>
          )}
        </ul>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <GameButton variant="secondary" block onClick={() => setShowSources(true)}>
          View contributing skills
        </GameButton>
        <GameButton variant="ghost" block onClick={() => setShowData(true)}>
          Export, import or reset
        </GameButton>
      </div>
    </>
  );

  const detailPanel = (
    <GamePanel className="h-full" bodyClassName="flex min-h-0 flex-1 flex-col p-3.5">
      <div className="min-h-0 flex-1 overflow-y-auto scroll-thin pr-1">{detailBody}</div>
    </GamePanel>
  );

  /*
   * Character is the one page that is not a drill-down: on a phone it reads as
   * a single scrolling profile in the order the eye wants it - who you are,
   * your attributes, the shape of them, then the detail of the one you tapped.
   */
  const mobileLayout = (
    <div className="flex flex-col gap-3">
      <GamePanel title="Character" bodyClassName="p-3.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <div className="font-display text-2xl uppercase tracking-wider2 text-gold-bright">
              Level {progress.level}
            </div>
            <div className="text-base uppercase tracking-wider2 text-teal">{progress.rank}</div>
          </div>
          <div className="text-right">
            <div className="text-base text-ivory-dim">
              {progress.lifetimeXp.toLocaleString()} lifetime XP
            </div>
            <div className="text-sm text-ivory-faint">
              {progress.atCap
                ? 'Maximum level reached'
                : `${progress.xpIntoLevel.toLocaleString()} / ${progress.xpForNextLevel.toLocaleString()} to level ${progress.level + 1}`}
            </div>
          </div>
        </div>
        <ProgressBar
          className="mt-2.5"
          value={progress.fraction}
          valueText={
            progress.atCap
              ? 'Level 100'
              : `${progress.xpIntoLevel} of ${progress.xpForNextLevel} XP`
          }
        />
      </GamePanel>

      <GamePanel title="Attributes" bodyClassName="p-3.5">
        <div className="grid grid-cols-2 gap-2">
          {scores.map((score) => {
            const Icon = iconFor(ATTRIBUTE_ICON[score.key]);
            const active = score.key === selectedKey;
            return (
              <button
                key={score.key}
                type="button"
                aria-pressed={active}
                onClick={() => setSelectedKey(score.key)}
                className={cn(
                  'tap-target rounded-[2px] border p-2.5 text-left transition-colors duration-200',
                  active ? 'border-teal/60 bg-teal/[0.07]' : 'border-gold/25',
                )}
              >
                {/* Icon and score share the top row so the name below gets
                    the full cell width - "Communication" must not truncate. */}
                <span className="flex items-center justify-between gap-2">
                  <Icon
                    aria-hidden
                    className={cn('h-[1.15rem] w-[1.15rem] shrink-0', active ? 'text-teal' : 'text-gold')}
                    strokeWidth={1.4}
                  />
                  <span
                    className={cn(
                      'text-2xl font-semibold leading-none tabular-nums',
                      active ? 'text-teal' : 'text-ivory-dim',
                    )}
                  >
                    {score.value}
                  </span>
                </span>
                {/* 17px keeps the longest label, "Communication" (133px at
                    18px), on one line inside a 125px half-width cell at
                    360px; it steps back up on wider phones. */}
                <span className="mt-1 block whitespace-nowrap text-xs leading-tight text-ivory min-[380px]:text-sm">
                  {score.label}
                </span>
                <ProgressBar className="mt-1.5" size="sm" value={score.value / 100} />
              </button>
            );
          })}
        </div>

        <div className="divider-diamond my-3" />

        <div className="flex items-baseline justify-between px-1">
          <span className="font-display text-base uppercase tracking-wider3 text-gold">
            Overall rating
          </span>
          <span className="font-display text-3xl text-ivory">{overall}</span>
        </div>
      </GamePanel>

      <GamePanel title="Character Core" bodyClassName="p-3">
        <AttributeRadar scores={scores} selectedKey={selectedKey} onSelect={setSelectedKey} />
      </GamePanel>

      <GamePanel bodyClassName="p-3.5">{detailBody}</GamePanel>

      <GamePanel title="Derived From Your Progress" bodyClassName="p-3.5">
        <div className="grid grid-cols-3 gap-2">
          <WeightCard icon="code" label="Skills" pct={COMPONENT_WEIGHTS.skills} />
          <WeightCard icon="quote" label="Quest history" pct={COMPONENT_WEIGHTS.quests} />
          <WeightCard icon="activity" label="Consistency" pct={COMPONENT_WEIGHTS.consistency} />
        </div>
        <button
          type="button"
          onClick={() => setShowFormula(true)}
          className="tap-target mt-2.5 w-full text-center text-sm text-ivory-faint underline decoration-gold/40 underline-offset-2"
        >
          These formulas are provisional. See how each score is built.
        </button>
      </GamePanel>
    </div>
  );

  return (
    <>
      {isMobile ? (
        mobileLayout
      ) : (
        <ResponsiveStage
          activeIndex={paneIndex}
          onActiveIndexChange={setPaneIndex}
          panes={[
            { id: 'attributes', label: 'Attributes', node: attributesPanel, className: 'w-[23rem] shrink-0' },
            { id: 'core', label: 'Core', node: corePanel, className: 'flex-1' },
            { id: 'detail', label: selected.label, node: detailPanel, className: 'w-[25rem] shrink-0' },
          ]}
        />
      )}

      {/* How the selected score is actually built. */}
      <Modal
        open={showFormula}
        onClose={() => setShowFormula(false)}
        title={`How ${selected.label} is calculated`}
        description="Attributes hold no XP of their own and cannot be levelled by hand. Every one is derived from the data on the other pages."
        size="sm"
        footer={
          <GameButton variant="ghost" onClick={() => setShowFormula(false)}>
            Close
          </GameButton>
        }
      >
        <StatList>
          {selected.inputs.map((input) => (
            <StatRow
              key={input.label}
              label={input.label}
              value={
                <span>
                  <span className="text-ivory-faint">{input.detail}</span>
                  {input.contribution > 0 && (
                    <span className="ml-2 text-teal">+{input.contribution}</span>
                  )}
                </span>
              }
            />
          ))}
          <StatRow label="Total" value={<span className="text-teal">{selected.value} / 100</span>} />
        </StatList>
        <p className="mt-3 rounded-[2px] border border-gold/25 bg-gold/[0.05] p-2.5 text-sm leading-relaxed text-ivory-dim">
          These weightings are a first pass and are expected to change. They live in one file,
          <code className="mx-1 text-gold">src/domain/attributes.ts</code>, and every readout on this
          page follows whatever that file says.
        </p>
      </Modal>

      {/* Full domain contribution table for the selected attribute. */}
      <Modal
        open={showSources}
        onClose={() => setShowSources(false)}
        title={`Skills contributing to ${selected.label}`}
        size="sm"
        footer={
          <GameButton variant="ghost" onClick={() => setShowSources(false)}>
            Close
          </GameButton>
        }
      >
        <StatList>
          {domains.map((domain) => {
            const weight = domain.attributeWeights[selected.key] ?? 0;
            return (
              <StatRow
                key={domain.id}
                label={domain.name}
                value={
                  weight === 0 ? (
                    <span className="text-ivory-faint">Does not contribute</span>
                  ) : (
                    <span>
                      Level {byDomain[domain.id] ?? 0}
                      <span className="ml-2 text-gold">weight {weight}</span>
                    </span>
                  )
                }
              />
            );
          })}
        </StatList>
      </Modal>

      <DataManagement open={showData} onClose={() => setShowData(false)} />

      {/* Streak line, kept out of the panels so it never fights the layout. */}
      <p className="sr-only">
        {profile.displayName}, level {progress.level}, {progress.rank}. Current streak{' '}
        {profile.currentStreak} days.
      </p>
    </>
  );
}

function WeightCard({ icon, label, pct }: { icon: string; label: string; pct: number }) {
  const Icon = iconFor(icon);
  return (
    <div className="flex flex-col items-center gap-1 rounded-[2px] border border-gold/25 bg-ink-950/40 px-2 py-2.5">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gold/35 text-gold">
        <Icon aria-hidden className="h-4 w-4" strokeWidth={1.3} />
      </span>
      <span className="text-center text-xs leading-tight text-ivory-dim">{label}</span>
      <span className="text-base text-teal">{Math.round(pct * 100)}%</span>
    </div>
  );
}
