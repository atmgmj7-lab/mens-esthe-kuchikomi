"use client";

import type { DailyMetric } from "@/lib/ga";

type Props = {
  data: DailyMetric[];
  loading?: boolean;
  error?: string;
  periodLabel?: string;
};

const W = 800;
const H = 260;
const PAD = { top: 20, right: 20, bottom: 40, left: 52 };
const CHART_W = W - PAD.left - PAD.right;
const CHART_H = H - PAD.top - PAD.bottom;

function polyline(values: number[], maxVal: number): string {
  if (values.length === 0) return "";
  return values
    .map((v, i) => {
      const x = PAD.left + (i / (values.length - 1)) * CHART_W;
      const y = PAD.top + CHART_H - (v / maxVal) * CHART_H;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function fmtDate(yyyymmdd: string): string {
  const m = yyyymmdd.slice(4, 6);
  const d = yyyymmdd.slice(6, 8);
  return `${parseInt(m)}/${parseInt(d)}`;
}

export default function LineChart({
  data,
  loading,
  error,
  periodLabel = "30日",
}: Props) {
  if (loading) {
    return (
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-32 rounded bg-zinc-700" />
          <div className="h-40 rounded bg-zinc-800" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5 flex items-center justify-center h-40">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5 flex items-center justify-center h-40">
        <p className="text-sm text-zinc-500">データがありません</p>
      </div>
    );
  }

  const pvValues = data.map((d) => d.pageviews);
  const sesValues = data.map((d) => d.sessions);
  const maxVal = Math.max(...pvValues, ...sesValues) * 1.15;

  const gridLines = Array.from({ length: 5 }, (_, i) => i / 4);

  const labelCount = 6;
  const labelIndices = Array.from({ length: labelCount }, (_, i) =>
    Math.round((i / (labelCount - 1)) * (data.length - 1))
  );

  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5">
      <div className="flex items-center gap-4 mb-3">
        <p className="text-sm font-medium text-zinc-300">
          PV / セッション推移（{periodLabel}）
        </p>
        <span className="flex items-center gap-1 text-xs text-indigo-400">
          <span className="inline-block w-3 h-0.5 bg-indigo-400 rounded" /> PV
        </span>
        <span className="flex items-center gap-1 text-xs text-emerald-400">
          <span className="inline-block w-3 h-0.5 bg-emerald-400 rounded" />{" "}
          セッション
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        aria-label="PV/セッション推移グラフ"
      >
        {gridLines.map((ratio, i) => {
          const y = PAD.top + CHART_H - ratio * CHART_H;
          const label = Math.round((ratio * maxVal) / 10) * 10;
          return (
            <g key={i}>
              <line
                x1={PAD.left}
                y1={y}
                x2={W - PAD.right}
                y2={y}
                stroke="#3f3f46"
                strokeWidth="1"
              />
              <text
                x={PAD.left - 6}
                y={y + 4}
                textAnchor="end"
                fill="#71717a"
                fontSize="11"
              >
                {label.toLocaleString()}
              </text>
            </g>
          );
        })}

        {labelIndices.map((idx) => {
          const x = PAD.left + (idx / (data.length - 1)) * CHART_W;
          return (
            <text
              key={idx}
              x={x}
              y={H - 8}
              textAnchor="middle"
              fill="#71717a"
              fontSize="11"
            >
              {fmtDate(data[idx].date)}
            </text>
          );
        })}

        <polyline
          points={polyline(sesValues, maxVal)}
          fill="none"
          stroke="#34d399"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        <polyline
          points={polyline(pvValues, maxVal)}
          fill="none"
          stroke="#818cf8"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
