'use client';

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts';

import type { AttributeScore } from '@/domain/types';
import { useIsMobile } from '@/lib/useBreakpoint';

/**
 * The character core.
 *
 * Recharts draws the polygon; the axis labels are rendered by hand so each
 * one can carry its icon and its number in the reference's stacked layout.
 */
export function AttributeRadar({
  scores,
  selectedKey,
  onSelect,
}: {
  scores: AttributeScore[];
  selectedKey: string;
  onSelect: (key: string) => void;
}) {
  const isMobile = useIsMobile();
  const data = scores.map((s) => ({
    key: s.key,
    label: s.label,
    value: s.value,
  }));

  return (
    <div
      className={
        // Square on a phone so the polygon and its labels always fit the
        // screen width; fills its panel on desktop.
        isMobile ? 'relative aspect-square w-full' : 'relative h-full min-h-[260px] w-full'
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart
          data={data}
          outerRadius={isMobile ? '64%' : '72%'}
          margin={
            isMobile
              ? { top: 30, right: 52, bottom: 30, left: 52 }
              : { top: 36, right: 62, bottom: 36, left: 62 }
          }
        >
          <PolarGrid stroke="rgba(200,164,92,0.22)" radialLines gridType="polygon" />
          <PolarAngleAxis
            dataKey="label"
            tick={(props) => <AxisTick {...props} scores={scores} onSelect={onSelect} selectedKey={selectedKey} />}
          />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            dataKey="value"
            stroke="var(--teal)"
            strokeWidth={1.6}
            fill="var(--teal)"
            fillOpacity={0.22}
            dot={{ r: 3, fill: 'var(--teal-bright)', stroke: 'none' }}
            isAnimationActive={false}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface TickProps {
  x?: number;
  y?: number;
  textAnchor?: string;
  payload?: { value?: string };
  scores: AttributeScore[];
  selectedKey: string;
  onSelect: (key: string) => void;
}

/**
 * Axis labels are real buttons: clicking a point on the chart selects that
 * attribute, which is the only way the chart is interactive.
 */
function AxisTick({ x = 0, y = 0, textAnchor, payload, scores, selectedKey, onSelect }: TickProps) {
  const score = scores.find((s) => s.label === payload?.value);
  if (!score) return null;

  const selected = score.key === selectedKey;
  const anchor = (textAnchor as 'start' | 'middle' | 'end') ?? 'middle';

  return (
    <g
      transform={`translate(${x},${y})`}
      role="button"
      tabIndex={0}
      aria-label={`${score.label}, ${score.value} of 100`}
      className="cursor-pointer"
      onClick={() => onSelect(score.key)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(score.key);
        }
      }}
    >
      <text
        x={0}
        y={-4}
        textAnchor={anchor}
        fill={selected ? 'var(--teal-bright)' : 'var(--ivory)'}
        fontSize={16}
        letterSpacing="0.06em"
      >
        {score.label}
      </text>
      <text
        x={0}
        y={17}
        textAnchor={anchor}
        fill={selected ? 'var(--teal)' : 'var(--ivory-dim)'}
        fontSize={16}
      >
        {score.value}
      </text>
    </g>
  );
}
