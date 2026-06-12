import Link from "next/link";
import { notFound } from "next/navigation";
import AutoRefresh from "@/components/AutoRefresh";
import CandidateRow from "@/components/campaign/CandidateRow";
import PipelineBanner from "@/components/campaign/PipelineBanner";
import { getCandidatesByNeed } from "@/lib/candidates";
import { getNeed } from "@/lib/needs";
import { ACTIVE_NEED_STATUSES, type SearchFilters } from "@/lib/types";
import { logout } from "../../login/actions";

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

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <AutoRefresh intervalMs={live ? 3000 : 15000} />
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="min-w-0">
            <Link href="/" className="text-xs font-medium text-zinc-400 hover:text-zinc-600">
              ← Campaigns
            </Link>
            <h1 className="mt-0.5 truncate text-base font-semibold" title={need.need_text}>
              {need.need_text}
            </h1>
            <div className="mt-1 flex flex-wrap gap-1">
              {filterChips(need.filters).map((chip, i) => (
                <span
                  key={i}
                  className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/candidates"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
            >
              All candidates
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-6">
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
                className="flex animate-pulse items-center gap-4 rounded-xl border border-zinc-200 bg-white p-3.5"
                style={{ animationDelay: `${i * 150}ms` }}
              >
                <div className="h-5 w-9 rounded bg-zinc-100" />
                <div className="h-11 w-11 rounded-full bg-zinc-100" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3 w-1/3 rounded bg-zinc-100" />
                  <div className="h-2.5 w-2/3 rounded bg-zinc-100" />
                </div>
                <div className="h-6 w-16 rounded bg-zinc-100" />
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-10 text-center text-sm text-zinc-400">
            No candidates found for this campaign.
          </p>
        )}
      </main>
    </div>
  );
}
