'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { ResponsiveStage } from '@/components/layout/ResponsiveStage';
import { ActivityRulesDialog } from '@/components/skills/ActivityRulesDialog';
import { HierarchyEditor, type HierarchyTarget } from '@/components/skills/HierarchyEditor';
import { LogActivityDialog } from '@/components/skills/LogActivityDialog';
import { SkillTree } from '@/components/skills/SkillTree';
import { DetailActions, SectionLabel, StatList, StatRow } from '@/components/ui/DetailPanel';
import { EmptyState } from '@/components/ui/EmptyState';
import { GameButton, IconButton } from '@/components/ui/GameButton';
import { GamePanel } from '@/components/ui/GamePanel';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { ColumnChevron, NavList, NavListItem } from '@/components/ui/NavList';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { StatusBadge, nodeTone } from '@/components/ui/StatusBadge';
import { formatRelativeDay } from '@/domain/ids';
import { NODE_LEVEL_MEANING, NODE_STATUS_LABEL } from '@/domain/progression';
import type { Id } from '@/domain/types';
import {
  useBranchesForDomain,
  useDerivedLevels,
  useNodeProgressMap,
  useNodesForBranch,
  useActiveDomains,
} from '@/store/selectors';
import { useAppStore } from '@/store/useAppStore';
import { useIsMobile } from '@/lib/useBreakpoint';
import { domainIcon } from '@/lib/gameIcons';
import { iconFor } from '@/lib/icons';

export default function SkillsPage() {
  const router = useRouter();

  const domains = useActiveDomains();
  const quests = useAppStore((s) => s.quests);
  const templates = useAppStore((s) => s.templates);
  const activityLogs = useAppStore((s) => s.activityLogs);
  const toggleNodeFocus = useAppStore((s) => s.toggleNodeFocus);
  const archiveDomain = useAppStore((s) => s.archiveDomain);
  const archiveBranch = useAppStore((s) => s.archiveBranch);
  const archiveNode = useAppStore((s) => s.archiveNode);
  const moveDomain = useAppStore((s) => s.moveDomain);
  const moveBranch = useAppStore((s) => s.moveBranch);
  const moveNode = useAppStore((s) => s.moveNode);
  const reverseActivityLog = useAppStore((s) => s.reverseActivityLog);

  const nodeProgress = useNodeProgressMap();
  const { byBranch, byDomain } = useDerivedLevels();

  const [domainId, setDomainId] = useState<Id>('dom_computer-science');
  const [branchId, setBranchId] = useState<Id>('brn_programming');
  const [nodeId, setNodeId] = useState<Id>('nod_python');
  const [paneIndex, setPaneIndex] = useState(2);
  const isMobile = useIsMobile();
  // A drill-down starts at its first level on a phone, never mid-stack.
  useEffect(() => {
    if (isMobile) setPaneIndex(0);
  }, [isMobile]);


  const [editorTarget, setEditorTarget] = useState<HierarchyTarget | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [showQuests, setShowQuests] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState<HierarchyTarget | null>(null);

  const branches = useBranchesForDomain(domainId);
  const nodes = useNodesForBranch(branchId);

  // Keep the selection valid as the user moves up the hierarchy or archives
  // whatever was selected.
  useEffect(() => {
    if (branches.length > 0 && !branches.some((b) => b.id === branchId)) {
      setBranchId(branches[0].id);
    }
  }, [branches, branchId]);

  useEffect(() => {
    if (nodes.length > 0 && !nodes.some((n) => n.id === nodeId)) {
      setNodeId(nodes[0].id);
    }
  }, [nodes, nodeId]);

  const selectedNode = nodes.find((n) => n.id === nodeId) ?? null;
  const selectedBranch = branches.find((b) => b.id === branchId) ?? null;
  const progress = selectedNode ? nodeProgress[selectedNode.id] : null;

  const relatedQuests = useMemo(
    () =>
      selectedNode
        ? quests.filter((q) => q.skillAllocations.some((a) => a.skillNodeId === selectedNode.id))
        : [],
    [quests, selectedNode],
  );

  const nodeHistory = useMemo(
    () =>
      selectedNode
        ? activityLogs
            .filter((l) => l.skillNodeId === selectedNode.id)
            .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
        : [],
    [activityLogs, selectedNode],
  );

  /* ---------------- panels ---------------- */

  const domainsPanel = (
    <GamePanel title="Domains" className="h-full" bodyClassName="flex min-h-0 flex-1 flex-col p-3">
      <NavList label="Skill domains">
        {domains.map((domain) => (
          <NavListItem
            key={domain.id}
            emblem={domainIcon(domain.id)}
            label={domain.name}
            meta={byDomain[domain.id] ?? 0}
            selected={domain.id === domainId}
            onSelect={() => {
              setDomainId(domain.id);
              setPaneIndex(1);
            }}
          />
        ))}
      </NavList>

      <DetailActions>
        <div className="flex gap-1.5">
          <IconButton
            icon="chart"
            label="Move selected domain up"
            size="sm"
            onClick={() => moveDomain(domainId, -1)}
            className="rotate-180"
          />
          <IconButton
            icon="chart"
            label="Move selected domain down"
            size="sm"
            onClick={() => moveDomain(domainId, 1)}
          />
          <IconButton
            icon="pen"
            label="Edit selected domain"
            size="sm"
            onClick={() => setEditorTarget({ kind: 'domain', id: domainId })}
          />
          <IconButton
            icon="box"
            label="Archive selected domain"
            size="sm"
            onClick={() => setConfirmArchive({ kind: 'domain', id: domainId })}
          />
        </div>
        <GameButton
          variant="secondary"
          block
          size="sm"
          onClick={() => setEditorTarget({ kind: 'domain' })}
        >
          + Add domain
        </GameButton>
      </DetailActions>
    </GamePanel>
  );

  const branchesPanel = (
    <GamePanel title="Branches" className="h-full" bodyClassName="flex min-h-0 flex-1 flex-col p-3">
      {branches.length === 0 ? (
        <EmptyState
          icon="layers"
          compact
          title="No branches"
          body="Add a branch to start building this domain out."
        />
      ) : (
        <NavList label="Branches in this domain">
          {branches.map((branch) => (
            <NavListItem
              key={branch.id}
              icon={branch.icon}
              label={branch.name}
              meta={byBranch[branch.id] ?? 0}
              selected={branch.id === branchId}
              onSelect={() => {
                setBranchId(branch.id);
                setPaneIndex(2);
              }}
            />
          ))}
        </NavList>
      )}

      <DetailActions>
        <div className="flex gap-1.5">
          <IconButton
            icon="chart"
            label="Move selected branch up"
            size="sm"
            onClick={() => moveBranch(branchId, -1)}
            className="rotate-180"
          />
          <IconButton
            icon="chart"
            label="Move selected branch down"
            size="sm"
            onClick={() => moveBranch(branchId, 1)}
          />
          <IconButton
            icon="pen"
            label="Edit selected branch"
            size="sm"
            onClick={() => setEditorTarget({ kind: 'branch', id: branchId, domainId })}
          />
          <IconButton
            icon="box"
            label="Archive selected branch"
            size="sm"
            onClick={() => setConfirmArchive({ kind: 'branch', id: branchId, domainId })}
          />
        </div>
        <GameButton
          variant="secondary"
          block
          size="sm"
          onClick={() => setEditorTarget({ kind: 'branch', domainId })}
        >
          + Add branch
        </GameButton>
      </DetailActions>
    </GamePanel>
  );

  const treePanel = (
    <GamePanel
      title={selectedBranch?.name ?? 'Branch'}
      subtitle={selectedBranch ? `Branch Level ${byBranch[selectedBranch.id] ?? 0}` : undefined}
      className="h-full"
      bodyClassName="flex min-h-0 flex-1 flex-col p-3"
    >
      <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
      {nodes.length === 0 ? (
        <EmptyState
          icon="sparkles"
          title="Nothing in this branch yet"
          body="Add the first skill node and the tree will draw itself from there."
          action={
            <GameButton
              variant="primary"
              onClick={() => setEditorTarget({ kind: 'node', branchId })}
            >
              Add node
            </GameButton>
          }
        />
      ) : (
        <SkillTree
          nodes={nodes}
          progress={nodeProgress}
          selectedId={nodeId}
          onSelect={(id) => {
            setNodeId(id);
            setPaneIndex(3);
          }}
        />
      )}
      </div>

      <div className="mt-3 flex shrink-0 gap-2">
        <GameButton
          variant="secondary"
          className="flex-1"
          onClick={() => setEditorTarget({ kind: 'node', branchId })}
        >
          + Add node
        </GameButton>
        <GameButton variant="ghost" className="shrink-0" onClick={() => setShowRules(true)}>
          Activity rules
        </GameButton>
      </div>
    </GamePanel>
  );

  const detailPanel = (
    <GamePanel className="h-full" bodyClassName="flex min-h-0 flex-1 flex-col p-3.5">
      {!selectedNode || !progress ? (
        <EmptyState icon="search" title="No node selected" body="Pick a node from the tree." />
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto scroll-thin pr-1">
          <h2 className="text-center font-display text-xl uppercase tracking-wider3 text-gold-bright">
            {selectedNode.name}
          </h2>
          <div className="mt-1 text-center text-base text-teal">
            Level {progress.level} — {NODE_STATUS_LABEL[progress.status]}
          </div>
          <p className="mt-0.5 text-center text-xs text-ivory-faint">
            {NODE_LEVEL_MEANING[progress.level]}
          </p>

          <div className="divider-diamond my-3" />

          <div className="text-center text-lg text-ivory">
            {progress.atCap
              ? `${progress.totalXp.toLocaleString()} XP — maximum level`
              : `${progress.xpIntoLevel.toLocaleString()} / ${progress.xpForNextLevel.toLocaleString()} XP`}
          </div>
          <ProgressBar
            className="mt-2"
            value={progress.fraction}
            valueText={
              progress.atCap
                ? 'Level 10 reached'
                : `${progress.xpIntoLevel} of ${progress.xpForNextLevel} XP toward level ${progress.level + 1}`
            }
          />

          <StatList className="mt-3">
            <StatRow
              label="Status"
              value={
                <StatusBadge bare tone={nodeTone(progress.status)}>
                  {selectedNode.focus ? 'Focus' : NODE_STATUS_LABEL[progress.status]}
                </StatusBadge>
              }
            />
            <StatRow label="Total XP" value={progress.totalXp.toLocaleString()} />
            <StatRow label="Logged sessions" value={nodeHistory.length} />
            <StatRow
              label="Last activity"
              value={formatRelativeDay(nodeHistory[0]?.occurredAt ?? null)}
            />
          </StatList>

          {selectedNode.evidence.length > 0 && (
            <>
              <SectionLabel className="mb-2 mt-3">Evidence</SectionLabel>
              <ul className="space-y-1">
                {selectedNode.evidence.map((evidence) => {
                  const Icon = iconFor('graduation');
                  return (
                    <li key={evidence} className="flex items-center gap-2 py-1">
                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gold/35 text-gold">
                        <Icon aria-hidden className="h-3 w-3" strokeWidth={1.4} />
                      </span>
                      <span className="min-w-0 flex-1 text-sm text-ivory">{evidence}</span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {selectedNode.notes && (
            <p className="mt-3 text-sm leading-relaxed text-ivory-dim">{selectedNode.notes}</p>
          )}
          </div>

          <DetailActions className="shrink-0">
            <GameButton variant="primary" block icon="sparkles" onClick={() => setShowLog(true)}>
              + Log activity
            </GameButton>
            <GameButton variant="secondary" block icon="map" onClick={() => setShowQuests(true)}>
              Related quests {relatedQuests.length > 0 && `(${relatedQuests.length})`}
            </GameButton>

            <div className="flex gap-1.5">
              <GameButton
                variant="ghost"
                size="sm"
                className="flex-1"
                onClick={() => toggleNodeFocus(selectedNode.id)}
              >
                {selectedNode.focus ? 'Clear focus' : 'Set focus'}
              </GameButton>
              <GameButton
                variant="ghost"
                size="sm"
                className="flex-1"
                onClick={() => setShowHistory(true)}
              >
                History
              </GameButton>
            </div>

            <div className="flex gap-1.5">
              <IconButton
                icon="chart"
                label="Move node earlier"
                size="sm"
                onClick={() => moveNode(selectedNode.id, -1)}
                className="rotate-180"
              />
              <IconButton
                icon="chart"
                label="Move node later"
                size="sm"
                onClick={() => moveNode(selectedNode.id, 1)}
              />
              <IconButton
                icon="pen"
                label="Edit node"
                size="sm"
                onClick={() => setEditorTarget({ kind: 'node', id: selectedNode.id, branchId })}
              />
              <IconButton
                icon="box"
                label="Archive node"
                size="sm"
                onClick={() => setConfirmArchive({ kind: 'node', id: selectedNode.id, branchId })}
              />
            </div>
          </DetailActions>
        </>
      )}
    </GamePanel>
  );

  return (
    <>
      <div className="flex min-h-0 flex-1">
        <ResponsiveStage
          activeIndex={paneIndex}
          onActiveIndexChange={setPaneIndex}
          panes={[
            { id: 'domains', label: 'Domains', node: domainsPanel, className: 'w-[18rem] shrink-0' },
            { id: 'branches', label: 'Branches', node: branchesPanel, className: 'w-[18rem] shrink-0' },
            { id: 'tree', label: 'Tree', node: treePanel, className: 'flex-1' },
            {
              id: 'detail',
              label: selectedNode?.name ?? 'Detail',
              node: detailPanel,
              className: 'w-[23rem] shrink-0',
            },
          ]}
        />
      </div>

      <HierarchyEditor
        open={editorTarget !== null}
        target={editorTarget}
        onClose={() => setEditorTarget(null)}
      />

      <LogActivityDialog
        open={showLog}
        defaultNodeId={selectedNode?.id ?? null}
        onManageRules={() => {
          setShowLog(false);
          setShowRules(true);
        }}
        onClose={() => setShowLog(false)}
      />

      <ActivityRulesDialog open={showRules} onClose={() => setShowRules(false)} />

      {/* Related quests */}
      <Modal
        open={showQuests}
        onClose={() => setShowQuests(false)}
        title={`Quests feeding ${selectedNode?.name ?? ''}`}
        size="sm"
        footer={
          <GameButton variant="ghost" onClick={() => setShowQuests(false)}>
            Close
          </GameButton>
        }
      >
        {relatedQuests.length === 0 ? (
          <EmptyState
            compact
            icon="map"
            title="No quests point here yet"
            body="Allocate some of a quest's XP to this node and it will show up here."
            action={
              <GameButton variant="primary" size="sm" onClick={() => router.push('/quests')}>
                Go to quests
              </GameButton>
            }
          />
        ) : (
          <ul className="space-y-1.5">
            {relatedQuests.map((quest) => {
              const allocation = quest.skillAllocations.find(
                (a) => a.skillNodeId === selectedNode?.id,
              );
              return (
                <li key={quest.id}>
                  <button
                    type="button"
                    onClick={() => router.push('/quests')}
                    className="w-full rounded-[2px] border border-gold/25 px-3 py-2 text-left transition-colors duration-200 hover:border-gold/60 hover:bg-gold/5"
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-base text-ivory">{quest.title}</span>
                      <span className="shrink-0 text-xs text-teal">
                        {allocation?.xp ?? 0} XP
                      </span>
                    </span>
                    <span className="block text-xs uppercase tracking-wider2 text-ivory-faint">
                      {quest.status}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Modal>

      {/* Activity history for this node, with reversal */}
      <Modal
        open={showHistory}
        onClose={() => setShowHistory(false)}
        title={`${selectedNode?.name ?? ''} history`}
        description="Reversing writes a compensating transaction. The original entry stays in the ledger."
        size="md"
        footer={
          <GameButton variant="ghost" onClick={() => setShowHistory(false)}>
            Close
          </GameButton>
        }
      >
        {nodeHistory.length === 0 ? (
          <EmptyState compact icon="activity" title="Nothing logged yet" />
        ) : (
          <ul className="divide-y divide-gold/10">
            {nodeHistory.map((log) => {
              const template = templates.find((t) => t.id === log.templateId);
              return (
                <li key={log.id} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block text-base text-ivory">
                      {template?.name ?? 'Activity'}
                    </span>
                    <span className="block text-xs text-ivory-faint">
                      {formatRelativeDay(log.occurredAt)} · {log.amount}
                      {log.note ? ` · ${log.note}` : ''}
                    </span>
                  </span>
                  <span
                    className={
                      log.reversedAt
                        ? 'shrink-0 text-sm text-ivory-faint line-through'
                        : 'shrink-0 text-sm text-teal'
                    }
                  >
                    +{log.xpAwarded} XP
                  </span>
                  {!log.reversedAt && (
                    <button
                      type="button"
                      onClick={() => reverseActivityLog(log.id)}
                      className="shrink-0 text-xs uppercase tracking-wider2 text-ivory-faint transition-colors duration-200 hover:text-danger"
                    >
                      Reverse
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmArchive !== null}
        title="Archive this?"
        body="Archiving hides it without touching the XP ledger: everything it earned stays in your lifetime total and your level never moves. Nothing is deleted."
        confirmLabel="Archive"
        onConfirm={() => {
          if (!confirmArchive) return;
          if (confirmArchive.kind === 'domain' && confirmArchive.id) archiveDomain(confirmArchive.id);
          if (confirmArchive.kind === 'branch' && confirmArchive.id) archiveBranch(confirmArchive.id);
          if (confirmArchive.kind === 'node' && confirmArchive.id) archiveNode(confirmArchive.id);
          setConfirmArchive(null);
        }}
        onCancel={() => setConfirmArchive(null)}
      />
    </>
  );
}
