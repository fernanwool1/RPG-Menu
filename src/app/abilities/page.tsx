'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Circle } from 'lucide-react';

import { EvidenceDialog } from '@/components/abilities/EvidenceDialog';
import { ResponsiveStage } from '@/components/layout/ResponsiveStage';
import { DetailActions, SectionLabel } from '@/components/ui/DetailPanel';
import { EmptyState } from '@/components/ui/EmptyState';
import { GameIcon } from '@/components/ui/GameIcon';
import { GameButton } from '@/components/ui/GameButton';
import { GamePanel } from '@/components/ui/GamePanel';
import { ConfirmDialog } from '@/components/ui/Modal';
import { NavList, NavListItem } from '@/components/ui/NavList';
import { StatusBadge, abilityTone } from '@/components/ui/StatusBadge';
import { Tabs } from '@/components/ui/Tabs';
import { ABILITY_STATUS_LABEL } from '@/domain/abilities';
import type { AbilityStatus, Id } from '@/domain/types';
import { useAbilityEvaluations } from '@/store/selectors';
import { useAppStore } from '@/store/useAppStore';
import { abilityIcon, abilityIconColor, domainIcon } from '@/lib/gameIcons';
import { useIsMobile } from '@/lib/useBreakpoint';
import { cn } from '@/lib/cn';

type Filter = 'all' | 'eligible' | 'unlocked' | 'locked';

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'eligible', label: 'Eligible' },
  { value: 'unlocked', label: 'Unlocked' },
  { value: 'locked', label: 'Locked' },
];

export default function AbilitiesPage() {
  const router = useRouter();
  const paths = useAppStore((s) => s.paths);
  const abilities = useAppStore((s) => s.abilities);
  const quests = useAppStore((s) => s.quests);
  const startProofQuest = useAppStore((s) => s.startProofQuest);
  const removeEvidence = useAppStore((s) => s.removeEvidence);
  const setPromotion = useAppStore((s) => s.setAbilityPromotion);

  const evaluations = useAbilityEvaluations();

  const sortedPaths = useMemo(() => [...paths].sort((a, b) => a.order - b.order), [paths]);

  const [pathId, setPathId] = useState<Id>('pth_computer-science');
  const [abilityId, setAbilityId] = useState<Id>('abl_full-stack-builder');
  const [filter, setFilter] = useState<Filter>('all');
  const [paneIndex, setPaneIndex] = useState(1);
  const isMobile = useIsMobile();
  // A drill-down starts at its first level on a phone, never mid-stack.
  useEffect(() => {
    if (isMobile) setPaneIndex(0);
  }, [isMobile]);

  const [showEvidence, setShowEvidence] = useState(false);
  const [confirmProof, setConfirmProof] = useState(false);

  const activePath = sortedPaths.find((p) => p.id === pathId) ?? sortedPaths[0];

  const abilitiesInPath = useMemo(
    () =>
      abilities
        .filter((a) => !a.archived && a.pathId === activePath?.id)
        .sort((a, b) => a.order - b.order),
    [abilities, activePath?.id],
  );

  const matchesFilter = (status: AbilityStatus): boolean => {
    if (filter === 'all') return true;
    if (filter === 'eligible') return status === 'eligible';
    if (filter === 'unlocked')
      return status === 'unlocked' || status === 'advanced' || status === 'mastered';
    return status === 'locked' || status === 'developing';
  };

  const visibleAbilities = abilitiesInPath.filter((a) =>
    matchesFilter(evaluations[a.id]?.status ?? 'locked'),
  );

  const selected = abilities.find((a) => a.id === abilityId) ?? visibleAbilities[0] ?? null;
  const evaluation = selected ? evaluations[selected.id] : null;

  /** Path tally counts only genuinely unlocked abilities, per the rules. */
  const tallyFor = (id: Id) => {
    const inPath = abilities.filter((a) => !a.archived && a.pathId === id);
    const unlocked = inPath.filter((a) => evaluations[a.id]?.countsAsUnlocked).length;
    return `${unlocked}/${inPath.length}`;
  };

  const proofQuest = selected?.proofQuestId
    ? quests.find((q) => q.id === selected.proofQuestId)
    : undefined;

  /* ---------------- panels ---------------- */

  const pathsPanel = (
    <GamePanel title="Ability Paths" className="h-full" bodyClassName="flex min-h-0 flex-1 flex-col p-3">
      <NavList label="Ability paths">
        {sortedPaths.map((path) => (
          <NavListItem
            key={path.id}
            emblem={domainIcon(path.id)}
            label={path.name}
            meta={tallyFor(path.id)}
            selected={path.id === activePath?.id}
            onSelect={() => {
              setPathId(path.id);
              setPaneIndex(1);
            }}
          />
        ))}
      </NavList>

      <div className="mt-auto pt-3">
        <Tabs items={FILTERS} value={filter} onChange={setFilter} label="Filter abilities" size="sm" />
      </div>
    </GamePanel>
  );

  const catalogPanel = (
    <GamePanel
      title={activePath?.name ?? 'Abilities'}
      className="h-full"
      bodyClassName="flex min-h-0 flex-1 flex-col p-3"
    >
      {visibleAbilities.length === 0 ? (
        <EmptyState
          icon="search"
          title="Nothing matches that filter"
          body="No ability in this path is in that state right now."
          action={
            <GameButton variant="secondary" onClick={() => setFilter('all')}>
              Show all
            </GameButton>
          }
        />
      ) : (
        <ul className="grid min-h-0 flex-1 auto-rows-min grid-cols-1 gap-2 overflow-y-auto scroll-thin min-[380px]:grid-cols-2">
          {visibleAbilities.map((ability) => {
            const status = evaluations[ability.id]?.status ?? 'locked';
            const isSelected = ability.id === selected?.id;
            const locked = status === 'locked';

            return (
              <li key={ability.id}>
                <button
                  type="button"
                  onClick={() => {
                    setAbilityId(ability.id);
                    setPaneIndex(2);
                  }}
                  aria-current={isSelected ? 'true' : undefined}
                  className={cn(
                    'flex h-full w-full flex-col items-center justify-center gap-2 rounded-[2px] border px-3 py-4',
                    'transition-[border-color,background-color,box-shadow] duration-200',
                    isSelected
                      ? 'border-teal/70 bg-teal/[0.07] shadow-glow'
                      : 'border-gold/25 hover:border-gold/60 hover:bg-gold/[0.04]',
                  )}
                >
                  {/*
                   * The emblem sits directly above the name. No decorative
                   * ring: the artwork is already ornamented, and the previous
                   * 44px circle would have cropped this level of detail.
                   *
                   * A locked ability stays visible in muted grey at half
                   * opacity - you should be able to see what you are working
                   * toward - and selection is expressed by the card border,
                   * never by tinting a locked icon as though it were open.
                   */}
                  <GameIcon
                    src={abilityIcon(ability.id)}
                    size={48}
                    color={abilityIconColor[status] ?? abilityIconColor.locked}
                    opacity={locked ? 0.5 : 1}
                  />
                  <span className="text-center text-base leading-tight text-ivory">
                    {ability.name}
                  </span>
                  <StatusBadge bare tone={abilityTone(status)}>
                    {ABILITY_STATUS_LABEL[status]}
                  </StatusBadge>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-2.5 shrink-0 border-t border-gold/20 pt-2.5 text-center text-xs text-ivory-faint">
        Abilities have no XP and no level. They open on skill requirements plus proof.
      </p>
    </GamePanel>
  );

  const detailPanel = (
    <GamePanel className="h-full" bodyClassName="flex min-h-0 flex-1 flex-col p-3.5">
      {!selected || !evaluation ? (
        <EmptyState icon="puzzle" title="No ability selected" body="Pick one from the catalogue." />
      ) : (
        <>
          <div className="flex justify-center">
            <GameIcon
              src={abilityIcon(selected.id)}
              size={72}
              color={abilityIconColor[evaluation.status] ?? abilityIconColor.locked}
              opacity={evaluation.status === 'locked' ? 0.5 : 1}
            />
          </div>
          <h2 className="mt-2 text-center font-display text-lg uppercase tracking-wider3 text-gold-bright">
            {selected.name}
          </h2>
          <div className="mt-1 text-center">
            {/* State is always written out, never left to colour alone. */}
            <StatusBadge bare tone={abilityTone(evaluation.status)}>
              {ABILITY_STATUS_LABEL[evaluation.status]}
            </StatusBadge>
          </div>

          <p className="mt-2 text-center text-base leading-relaxed text-ivory">
            {selected.description}
          </p>

          <div className="divider-diamond my-3" />

          <SectionLabel className="mb-2">Requirements</SectionLabel>
          <ul className="space-y-1.5">
            {evaluation.requirements.map(({ requirement, currentLevel, met }) => (
              <li key={requirement.id} className="flex items-center gap-2.5">
                <span
                  className={cn(
                    'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                    met ? 'border-teal text-teal' : 'border-ivory-faint/40 text-ivory-faint',
                  )}
                >
                  {met ? (
                    <Check aria-hidden className="h-3 w-3" strokeWidth={2.2} />
                  ) : (
                    <Circle aria-hidden className="h-2 w-2" strokeWidth={2} />
                  )}
                </span>
                <span className="min-w-0 flex-1 text-base text-ivory">
                  {requirement.label} — Level {requirement.minLevel}
                </span>
                <span
                  className={cn(
                    'shrink-0 text-xs tabular-nums',
                    met ? 'text-teal' : 'text-ivory-faint',
                  )}
                  title={`Currently level ${currentLevel}`}
                >
                  {currentLevel}
                </span>
              </li>
            ))}
          </ul>

          <div className="divider-diamond my-3" />

          <SectionLabel className="mb-2">Proof quest</SectionLabel>
          <div className="flex items-start gap-2.5">
            <span
              className={cn(
                'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                evaluation.proofSatisfied
                  ? 'border-teal text-teal'
                  : 'border-ivory-faint/40 text-ivory-faint',
              )}
            >
              {evaluation.proofSatisfied && (
                <Check aria-hidden className="h-3 w-3" strokeWidth={2.2} />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base text-ivory">{selected.proofDescription}</p>
              {proofQuest && (
                <button
                  type="button"
                  onClick={() => router.push('/quests')}
                  className="mt-0.5 text-xs text-teal underline decoration-teal/40 underline-offset-2 hover:text-teal-bright"
                >
                  Open the linked quest ({proofQuest.status})
                </button>
              )}
            </div>
          </div>

          {selected.evidence.length > 0 && (
            <>
              <SectionLabel className="mb-2 mt-3">Evidence</SectionLabel>
              <ul className="space-y-1">
                {selected.evidence.map((evidence) => (
                  <li
                    key={evidence.id}
                    className="flex items-start gap-2 border-b border-gold/10 py-1.5 last:border-0"
                  >
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-gold" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm leading-tight text-ivory">
                        {evidence.label}
                      </span>
                      <span className="block text-xs uppercase tracking-wider2 text-ivory-faint">
                        {evidence.kind.replace('-', ' ')}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeEvidence(selected.id, evidence.id)}
                      aria-label={`Remove evidence: ${evidence.label}`}
                      title="Remove"
                      className="shrink-0 text-xs uppercase tracking-wider2 text-ivory-faint transition-colors duration-200 hover:text-danger"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {!evaluation.proofSatisfied && selected.evidence.length === 0 && (
            <p className="mt-2 text-center text-xs text-ivory-faint">
              Evidence can be attached from Inventory, quests, links, files or notes.
            </p>
          )}

          <DetailActions>
            <GameButton
              variant="primary"
              block
              disabled={Boolean(proofQuest && proofQuest.status !== 'archived')}
              onClick={() => setConfirmProof(true)}
            >
              {proofQuest && proofQuest.status !== 'archived'
                ? 'Proof quest already running'
                : 'Start proof quest'}
            </GameButton>
            <GameButton variant="secondary" block onClick={() => setShowEvidence(true)}>
              Attach existing evidence
            </GameButton>

            {evaluation.countsAsUnlocked && (
              <div className="flex gap-2">
                <GameButton
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                  onClick={() =>
                    setPromotion(
                      selected.id,
                      selected.manualPromotion === 'advanced' ? null : 'advanced',
                    )
                  }
                >
                  {selected.manualPromotion === 'advanced' ? 'Undo advanced' : 'Promote to advanced'}
                </GameButton>
                <GameButton
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                  onClick={() =>
                    setPromotion(
                      selected.id,
                      selected.manualPromotion === 'mastered' ? null : 'mastered',
                    )
                  }
                >
                  {selected.manualPromotion === 'mastered' ? 'Undo mastered' : 'Promote to mastered'}
                </GameButton>
              </div>
            )}
          </DetailActions>
        </>
      )}
    </GamePanel>
  );

  return (
    <>
      <ResponsiveStage
        activeIndex={paneIndex}
        onActiveIndexChange={setPaneIndex}
        panes={[
          { id: 'paths', label: 'Paths', node: pathsPanel, className: 'w-[25rem] shrink-0' },
          { id: 'catalog', label: 'Catalogue', node: catalogPanel, className: 'flex-1' },
          {
            id: 'detail',
            label: selected?.name ?? 'Detail',
            node: detailPanel,
            className: 'w-[25rem] shrink-0',
          },
        ]}
      />

      <EvidenceDialog
        open={showEvidence}
        abilityId={selected?.id ?? null}
        onClose={() => setShowEvidence(false)}
      />

      <ConfirmDialog
        open={confirmProof}
        title="Start the proof quest?"
        body={
          <>
            A new active quest will be created and linked to{' '}
            <strong className="text-ivory">{selected?.name}</strong>. Completing it satisfies the
            proof requirement and unlocks the ability.
          </>
        }
        confirmLabel="Create quest"
        onConfirm={() => {
          if (selected) {
            startProofQuest(selected.id);
            setConfirmProof(false);
            router.push('/quests');
          }
        }}
        onCancel={() => setConfirmProof(false)}
      />
    </>
  );
}
