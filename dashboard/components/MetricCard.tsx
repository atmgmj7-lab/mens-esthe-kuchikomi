type Props = {
  label: string;
  value?: string | number;
  suffix?: string;
  hint?: string;
  loading?: boolean;
  error?: string;
};

export default function MetricCard({
  label,
  value,
  suffix,
  hint,
  loading,
  error,
}: Props) {
  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5 flex flex-col gap-2">
      <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
        {label}
      </p>

      {loading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-8 w-2/3 rounded bg-zinc-700" />
          <div className="h-3 w-1/2 rounded bg-zinc-800" />
        </div>
      ) : error ? (
        <div>
          <p className="text-2xl font-bold text-zinc-600">—</p>
          <p className="text-xs text-red-400 mt-1">{error}</p>
        </div>
      ) : (
        <div>
          <p className="text-3xl font-bold text-white">
            {value ?? "—"}
            {suffix && (
              <span className="text-lg font-normal text-zinc-400 ml-1">
                {suffix}
              </span>
            )}
          </p>
          {hint && <p className="text-xs text-zinc-500 mt-1">{hint}</p>}
        </div>
      )}
    </div>
  );
}
