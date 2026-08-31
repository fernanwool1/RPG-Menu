'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { NODE_STATUS_LABEL } from '@/domain/progression';
import { useIsMobile } from '@/lib/useBreakpoint';
import type { Id, NodeProgress, SkillNode } from '@/domain/types';
import { iconFor } from '@/lib/icons';
import { cn } from '@/lib/cn';

/**
 * The connected skill tree.
 *
 * Rows come from graph depth - a node sits one row below its deepest parent -
 * so the shape follows the data rather than a hand-authored layout, and a
 * user-added node lands in the right place without any extra work.
 *
 * Connectors are measured from the DOM after layout rather than computed from
 * assumed sizes, which keeps the lines correct at any panel width, font size
 * or zoom level.
 */

interface Point {
  x: number;
  top: number;
  bottom: number;
}

export interface SkillTreeProps {
  nodes: SkillNode[];
  progress: Record<Id, NodeProgress>;
  selectedId: Id | null;
  onSelect: (id: Id) => void;
}

/** Longest-path depth, so a node always renders below every one of its parents. */
function computeDepths(nodes: SkillNode[]): Map<Id, number> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const depths = new Map<Id, number>();

  const resolve = (id: Id, seen: Set<Id>): number => {
    const cached = depths.get(id);
    if (cached !== undefined) return cached;
    // A cycle would otherwise recurse forever; treat the repeat as a root.
    if (seen.has(id)) return 0;

    const node = byId.get(id);
    if (!node) return 0;

    const parents = node.parentIds.filter((p) => byId.has(p));
    const depth =
      parents.length === 0
        ? 0
        : Math.max(...parents.map((p) => resolve(p, new Set([...seen, id])))) + 1;

    depths.set(id, depth);
    return depth;
  };

  for (const node of nodes) resolve(node.id, new Set());
  return depths;
}

export function SkillTree({ nodes, progress, selectedId, onSelect }: SkillTreeProps) {
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<Id, HTMLElement>());
  const [points, setPoints] = useState<Map<Id, Point>>(new Map());
  const [size, setSize] = useState({ width: 0, height: 0 });

  const rows = useMemo(() => {
    const depths = computeDepths(nodes);
    const grouped = new Map<number, SkillNode[]>();
    for (const node of nodes) {
      const depth = depths.get(node.id) ?? 0;
      const row = grouped.get(depth) ?? [];
      row.push(node);
      grouped.set(depth, row);
    }
    return [...grouped.entries()]
      .sort(([a], [b]) => a - b)
      .map(([depth, group]) => ({ depth, nodes: [...group].sort((a, b) => a.order - b.order) }));
  }, [nodes]);

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const box = container.getBoundingClientRect();
    const next = new Map<Id, Point>();

    for (const [id, element] of nodeRefs.current) {
      if (!element.isConnected) continue;
      const rect = element.getBoundingClientRect();
      next.set(id, {
        x: rect.left - box.left + rect.width / 2,
        top: rect.top - box.top,
        bottom: rect.top - box.top + rect.height,
      });
    }

    setPoints(next);
    setSize({ width: box.width, height: box.height });
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure, rows]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => measure());
    observer.observe(container);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  /** Orthogonal parent -> child connectors, matching the reference's shape. */
  const edges = useMemo(() => {
    const present = new Set(nodes.map((n) => n.id));
    const paths: Array<{ key: string; d: string; junction: { x: number; y: number } }> = [];

    for (const node of nodes) {
      const child = points.get(node.id);
      if (!child) continue;

      for (const parentId of node.parentIds) {
        if (!present.has(parentId)) continue;
        const parent = points.get(parentId);
        if (!parent) continue;

        const midY = parent.bottom + (child.top - parent.bottom) / 2;
        const d =
          Math.abs(parent.x - child.x) < 1
            ? `M ${parent.x} ${parent.bottom} L ${child.x} ${child.top}`
            : `M ${parent.x} ${parent.bottom} L ${parent.x} ${midY} L ${child.x} ${midY} L ${child.x} ${child.top}`;

        paths.push({ key: `${parentId}->${node.id}`, d, junction: { x: child.x, y: midY } });
      }
    }

    return paths;
  }, [nodes, points]);

  const registerNode = (id: Id) => (element: HTMLElement | null) => {
    if (element) nodeRefs.current.set(id, element);
    else nodeRefs.current.delete(id);
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full py-2',
        // Vertical on a phone: rows become a single left-aligned column, so
        // a node's name and status label always have the full width and can
        // never overlap a sibling.
        isMobile ? 'max-w-none' : 'mx-auto max-w-lg',
      )}
    >
      {/* Connectors sit behind the medallions and are purely decorative: the
          relationship is also stated in each node's accessible description. */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0"
        width={size.width}
        height={size.height}
      >
        {edges.map((edge) => (
          <g key={edge.key}>
            <path
              d={edge.d}
              fill="none"
              stroke="var(--gold)"
              strokeWidth="1"
              opacity="0.45"
              strokeLinejoin="round"
            />
            <circle cx={edge.junction.x} cy={edge.junction.y} r="2" fill="var(--gold)" opacity="0.6" />
          </g>
        ))}
      </svg>

      <div className="relative flex flex-col items-center gap-6">
        {rows.map((row) => (
          <div
            key={row.depth}
            className={cn(
              'flex w-full items-start',
              isMobile
                ? 'flex-col gap-3 pl-1'
                : 'flex-wrap justify-center gap-x-8 gap-y-5',
            )}
          >
            {row.nodes.map((node) => {
              const nodeProgress = progress[node.id];
              const level = nodeProgress?.level ?? 0;
              const status = nodeProgress?.status ?? 'undiscovered';
              const selected = node.id === selectedId;
              const Icon = iconFor(node.icon);

              const parentNames = node.parentIds
                .map((p) => nodes.find((n) => n.id === p)?.name)
                .filter(Boolean);

              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => onSelect(node.id)}
                  aria-current={selected ? 'true' : undefined}
                  aria-label={`${node.name}, level ${level}, ${NODE_STATUS_LABEL[status]}${
                    parentNames.length > 0 ? `, follows ${parentNames.join(' and ')}` : ''
                  }`}
                  className={cn(
                    'rounded-[3px] transition-colors duration-200 hover:bg-gold/5',
                    isMobile
                      ? 'tap-target flex w-full items-center gap-3 border border-gold/20 p-2 text-left'
                      : 'flex w-24 flex-col items-center gap-1.5 p-1',
                  )}
                >
                  <span
                    ref={registerNode(node.id)}
                    className={cn(
                      'inline-flex h-12 w-12 items-center justify-center rounded-full border-2 bg-ink-950 transition-all duration-200',
                      selected
                        ? 'border-gold-bright text-gold-bright shadow-glow-gold'
                        : node.focus
                          ? 'border-teal text-teal-bright shadow-glow'
                          : status === 'undiscovered'
                            ? 'border-ivory-faint/30 text-ivory-faint'
                            : 'border-gold/50 text-gold',
                    )}
                  >
                    <Icon aria-hidden className="h-5 w-5" strokeWidth={1.4} />
                  </span>

                  <span className={cn('min-w-0', isMobile && 'flex-1')}>
                  <span className={cn('block text-base leading-tight text-ivory', !isMobile && 'text-center text-xs')}>
                    {node.name}
                  </span>
                  <span
                    className={cn(
                      'block text-2xs uppercase tracking-wider2',
                      isMobile ? 'mt-0.5' : 'text-center',
                      status === 'mastered'
                        ? 'text-gold-bright'
                        : status === 'advanced' || status === 'proficient'
                          ? 'text-teal'
                          : status === 'undiscovered'
                            ? 'text-ivory-faint'
                            : 'text-gold',
                    )}
                  >
                    {NODE_STATUS_LABEL[status]}
                  </span>
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
