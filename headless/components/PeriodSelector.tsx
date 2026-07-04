"use client";

import type { PeriodDays } from "@/lib/period";
import { PERIOD_OPTIONS } from "@/lib/period";

type Props = {
  value: PeriodDays;
  onChange: (days: PeriodDays) => void;
};

export default function PeriodSelector({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PERIOD_OPTIONS.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
            value === opt.value
              ? "bg-indigo-600 border-indigo-500 text-white font-semibold"
              : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
