import Link from "next/link";
import { notFound } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import AutoRefresh from "@/components/AutoRefresh";
import CandidateRow from "@/components/campaign/CandidateRow";
import PipelineBanner from "@/components/campaign/PipelineBanner";
import { getCandidatesByNeed } from "@/lib/candidates";
import { getNeed } from "@/lib/needs";
import { ACTIVE_NEED_STATUSES, type SearchFilters } from "@/lib/types";

// One campaign: its filters, pipeline progress, and everyone it found —
// cards appear as people are scraped and fill in as they're scored.

function filterChips(f: SearchFilters): string[] {
  return [
    ...(f.title?.trim() ? [f.title.trim()] : []),
    ...(f.industries ?? []),
    ...(f.locations ?? []),
    ...(f.current_companies ?? []).map((c) => `at ${c}`),
    ...(f.keywords?.trim() ? [`“${f.keywords.trim()}”`] : []),
  ];
}

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const need = await getNeed(id);
  if (!need) notFound();

  const candidates = await getCandidatesByNeed(id);
  const live =
    ACTIVE_NEED_STATUSES.includes(need.status) || need.counts.researching > 0;
  const pendingSwipes = candidates.filter(
    (c) => c.rank_score != null && (c.swipe_decision ?? "pending") === "pending",
  ).length;

  return (
    <div className="flex min-h-screen flex-col">
      <AutoRefresh intervalMs={live ? 3000 : 15000} />
      <AppHeader active="campaigns" back={{ href: "/", label: "Campaigns" }} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <div className="animate-fade-up mb-6 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-3xl text-ink" title={need.need_text}>
              {need.need_text}
            </h1>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {filterChips(need.filters).map((chip, i) => (
                <span
                  key={i}
                  className="chip bg-surface-2/60 text-muted ring-1 ring-border-soft"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            {pendingSwipes > 0 ? (
              <Link href={`/campaigns/${id}/swipe`} className="btn btn-primary text-xs">
                Swipe {pendingSwipes}
              </Link>
            ) : null}
            <Link href={`/campaigns/${id}/review`} className="btn btn-ghost text-xs">
              Review board
            </Link>
          </div>
        </div>

        <PipelineBanner need={need} />

        {candidates.length > 0 ? (
          <div className="mt-5 space-y-2">
            {candidates.map((c, i) => (
              <CandidateRow
                key={c.id}
                candidate={c}
                pipelineActive={live}
                // Candidates arrive sorted by rank_score DESC with unscored last,
                // so the index over scored rows is the leaderboard position.
                rank={c.rank_score != null ? i + 1 : null}
              />
            ))}
          </div>
        ) : need.status === "queued" || need.status === "scanning" ? (
          <div className="mt-5 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="card flex animate-pulse items-center gap-4 p-3.5"
                style={{ animationDelay: `${i * 150}ms` }}
              >
                <div className="h-5 w-9 rounded bg-surface-2" />
                <div className="h-11 w-11 rounded-full bg-surface-2" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3 w-1/3 rounded bg-surface-2" />
                  <div className="h-2.5 w-2/3 rounded bg-surface-2" />
                </div>
                <div className="h-6 w-16 rounded bg-surface-2" />
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-12 text-center font-mono text-xs text-faint">
            No candidates found for this campaign.
          </p>
        )}
      </main>
    </div>
  );
}
