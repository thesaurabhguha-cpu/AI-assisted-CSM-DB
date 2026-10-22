import type { ChurnResult, HealthResult } from "@/lib/types";

export function ScoreBreakdown({ health }: { health: HealthResult }) {
  return (
    <ul className="space-y-3.5">
      {health.components.map((c) => (
        <li key={c.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-ink">{c.label}</span>
            <span className="num text-ink-2">
              {c.score === null ? "no data" : <>{Math.round(c.score)}<span className="text-ink-3"> × {Math.round(c.weight * 100)}% = </span>{c.contribution.toFixed(1)}</>}
            </span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-line-soft overflow-hidden" aria-hidden="true">
            {c.score !== null && (
              <div
                className="h-full rounded-full"
                style={{ width: `${c.score}%`, background: c.score >= 70 ? "var(--moss)" : c.score >= 50 ? "var(--ochre)" : "var(--brick)" }}
              />
            )}
          </div>
          <p className="text-xs text-ink-3 mt-1">{c.note}</p>
        </li>
      ))}
    </ul>
  );
}

export function DriverChart({ churn, limit = 7 }: { churn: ChurnResult; limit?: number }) {
  const ds = churn.drivers.slice(0, limit);
  const max = Math.max(...ds.map((d) => Math.abs(d.logitContribution)), 0.01);
  return (
    <div>
      <div className="flex justify-between text-xs text-ink-3 mb-2">
        <span>Lowers risk</span>
        <span>Raises risk</span>
      </div>
      <ul className="space-y-2.5">
        {ds.map((d) => {
          const w = (Math.abs(d.logitContribution) / max) * 50;
          const up = d.logitContribution > 0;
          return (
            <li key={d.feature} className="text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-ink">{d.label}</span>
                <span className="num text-ink-2">{d.value}</span>
              </div>
              <div className="relative mt-1 h-2" aria-label={`${up ? "raises" : "lowers"} risk by ${Math.abs(d.logitContribution).toFixed(2)} log-odds`}>
                <div className="absolute inset-y-0 left-1/2 w-px bg-line" />
                <div
                  className="absolute inset-y-0 rounded-full"
                  style={{
                    left: up ? "50%" : `${50 - w}%`,
                    width: `${Math.max(w, 0.8)}%`,
                    background: up ? "var(--brick)" : "var(--moss)",
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-ink-3 mt-3">Bar length is the feature’s contribution to the model’s log-odds for this account.</p>
    </div>
  );
}
