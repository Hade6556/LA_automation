import { retryCampaignAction } from "@/app/campaigns/actions";
import { needIsStale, type CampaignCounts } from "@/lib/needs";
import { ACTIVE_NEED_STATUSES, type Need, type NeedStatus } from "@/lib/types";

// Stage indicator for the campaign pipeline: Scan → Rank → Research → Done,
// with live counts, plus error / stalled states with a Retry escape hatch.

const STAGES: { key: string; title: string; reached: NeedStatus[] }[] = [
  { key: "scan", title: "Scanning LinkedIn", reached: ["scanning", "ranking", "researching", "done"] },
  { key: "rank", title: "Quick ranking", reached: ["ranking", "researching", "done"] },
  { key: "research", title: "Deep research", reached: ["researching", "done"] },
  { key: "done", title: "Done", reached: ["done"] },
];

function RetryForm({ needId, label }: { needId: string; label: string }) {
  return (
    <form action={retryCampaignAction}>
      <input type="hidden" name="id" value={needId} />
      <button type="submit" className="btn btn-primary shrink-0 px-3 py-1.5 text-xs font-semibold">
        {label}
      </button>
    </form>
  );
}

export default function PipelineBanner({
  need,
}: {
  need: Need & { counts: CampaignCounts };
}) {
  const { counts } = need;
  const stale = needIsStale(need);

  if (need.status === "error") {
    return (
      <div className="flex items-center justify-between gap-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-rose-200">Pipeline failed</p>
          <p className="mt-0.5 truncate text-xs text-rose-300/80" title={need.error ?? undefined}>
            {need.error ?? "Unknown error"}
          </p>
        </div>
        <RetryForm needId={need.id} label="Retry" />
      </div>
    );
  }

  if (stale) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-amber-200">Pipeline appears stalled</p>
          <p className="mt-0.5 text-xs text-amber-300/80">
            No heartbeat for 2+ minutes — check{" "}
            <code className="rounded bg-amber-500/15 px-1 font-mono">logs/pipeline-{need.id}.log</code>,
            then retry. Already-found people are kept.
          </p>
        </div>
        <RetryForm needId={need.id} label="Retry" />
      </div>
    );
  }

  const live = ACTIVE_NEED_STATUSES.includes(need.status);
  const progress = [
    `${counts.found} found`,
    counts.found ? `${counts.ranked}/${counts.found} ranked` : null,
    counts.researched || counts.researching
      ? `${counts.researched} researched${counts.researching ? ` (+${counts.researching} in flight)` : ""}`
      : null,
  ].filter(Boolean);

  return (
    <div className="card px-4 py-3">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {STAGES.map((stage, i) => {
          const reached = stage.reached.includes(need.status);
          const isCurrent =
            (need.status === "scanning" && stage.key === "scan") ||
            (need.status === "ranking" && stage.key === "rank") ||
            (need.status === "researching" && stage.key === "research") ||
            (need.status === "done" && stage.key === "done");
          return (
            <li key={stage.key} className="flex items-center gap-2">
              {i > 0 ? <span className="text-border">→</span> : null}
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                  isCurrent
                    ? need.status === "done"
                      ? "text-emerald-300"
                      : "text-ink"
                    : reached
                      ? "text-emerald-400/90"
                      : "text-faint"
                }`}
              >
                {isCurrent && live ? (
                  <span className="live-dot h-1.5 w-1.5 rounded-full bg-amber-400" />
                ) : reached ? (
                  <span className="text-emerald-400">✓</span>
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-border" />
                )}
                {stage.title}
              </span>
            </li>
          );
        })}
        {need.status === "queued" ? (
          <li className="font-mono text-xs text-amber-300">starting…</li>
        ) : null}
      </ol>
      {progress.length ? (
        <p className="mt-1.5 font-mono text-xs tabular-nums text-muted">{progress.join(" · ")}</p>
      ) : null}
    </div>
  );
}
