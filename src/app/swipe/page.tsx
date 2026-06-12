import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import { getSwipeCountsByNeed } from "@/lib/candidates";
import { getNeeds } from "@/lib/needs";

// Phone entry point for screening: pick a campaign, swipe its ranked
// candidates. Shows per-campaign progress (left to swipe / YES / NO).

export default async function SwipePickerPage() {
  const [needs, counts] = await Promise.all([getNeeds(), getSwipeCountsByNeed()]);
  const campaigns = needs.filter((n) => (n.counts?.ranked ?? 0) > 0);

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader active="swipe" />

      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6 sm:px-6">
        <h1 className="font-display text-2xl text-ink">Swipe candidates</h1>
        <p className="mt-1 text-sm text-muted">
          Pick a campaign — swipe right to approve, left to skip.
        </p>

        <div className="mt-5 space-y-2">
          {campaigns.length ? (
            campaigns.map((n) => {
              const c = counts[n.id] ?? { pending: 0, yes: 0, no: 0 };
              return (
                <Link
                  key={n.id}
                  href={
                    c.pending > 0 ? `/campaigns/${n.id}/swipe` : `/campaigns/${n.id}/review`
                  }
                  className="card flex items-center gap-3 p-4 transition-colors hover:bg-surface-2/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{n.need_text}</p>
                    <p className="mt-1 flex flex-wrap gap-x-3 font-mono text-[11px] text-faint">
                      <span className="text-emerald-300">✓ {c.yes}</span>
                      <span className="text-rose-300">✕ {c.no}</span>
                      <span>{c.pending} to swipe</span>
                    </p>
                  </div>
                  {c.pending > 0 ? (
                    <span className="btn btn-primary pointer-events-none shrink-0 text-xs">
                      Swipe {c.pending}
                    </span>
                  ) : (
                    <span className="btn btn-ghost pointer-events-none shrink-0 text-xs">
                      Results
                    </span>
                  )}
                </Link>
              );
            })
          ) : (
            <p className="card p-8 text-center text-sm text-faint">
              No campaigns with ranked candidates yet.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
