import Link from "next/link";
import { researchCandidateAction } from "@/app/campaigns/actions";
import { selectHighlights } from "@/lib/highlights";
import { initials, photoUrl } from "@/lib/people";
import { verdictFor } from "@/lib/pipeline/labels";
import type { Candidate } from "@/lib/types";

// One person in the campaign leaderboard. Fills in live as the pipeline works:
// scraped (identity only) → scored (rank + verdict + reason) → researched
// (one-liner + highlight chips). Server component — the Research button is a
// plain form action.

const SCORE_TEXT: Record<string, string> = {
  "bg-emerald-500": "text-emerald-600",
  "bg-amber-500": "text-amber-600",
  "bg-rose-400": "text-rose-500",
  "bg-zinc-300": "text-zinc-400",
};

export default function CandidateRow({
  candidate: c,
  pipelineActive,
  rank,
}: {
  candidate: Candidate;
  pipelineActive: boolean;
  rank: number | null;
}) {
  const photo = photoUrl(c.social);
  const verdict = verdictFor(c.rank_score);
  const researched = c.researched_at != null;
  const topThree = rank != null && rank <= 3;
  const highlights = researched
    ? selectHighlights(c, c.dossier?.top_strengths ?? [], { max: 3 })
    : [];

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border bg-white p-3.5 sm:gap-4 ${
        topThree ? "border-zinc-300 shadow-sm" : "border-zinc-200"
      }`}
    >
      <div
        className={`w-9 shrink-0 text-center text-lg font-bold tabular-nums ${
          rank == null ? "text-zinc-200" : topThree ? "text-zinc-900" : "text-zinc-400"
        }`}
        title={rank != null ? `Ranked #${rank} in this campaign` : "Not scored yet"}
      >
        {rank != null ? `#${rank}` : "—"}
      </div>

      <Link href={`/candidates/${c.id}`} title="Open dossier" className="shrink-0">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt=""
            referrerPolicy="no-referrer"
            className="h-11 w-11 rounded-full bg-zinc-100 object-cover transition hover:ring-2 hover:ring-zinc-300"
          />
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-200 text-sm font-medium text-zinc-500 transition hover:ring-2 hover:ring-zinc-300">
            {initials(c.full_name)}
          </div>
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Link
            href={`/candidates/${c.id}`}
            className="truncate text-sm font-medium text-zinc-900 hover:underline"
          >
            {c.full_name ?? "—"}
          </Link>
          <a
            href={c.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            title="Open LinkedIn profile"
            className="shrink-0 rounded border border-zinc-200 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600"
          >
            in
          </a>
        </div>
        <p className="truncate text-xs text-zinc-500" title={c.headline ?? undefined}>
          {c.headline ?? `${c.current_title ?? ""}${c.current_company ? ` · ${c.current_company}` : ""}`}
        </p>
        <div className="mt-1">
          {c.researching ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
              researching…
            </span>
          ) : researched ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="truncate text-xs text-zinc-600" title={c.dossier?.one_liner ?? c.dossier?.bottom_line ?? undefined}>
                <span
                  title="Deep-researched"
                  className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 align-middle"
                />
                {c.dossier?.one_liner ?? c.dossier?.bottom_line ?? ""}
              </p>
              {highlights.map((h, i) => (
                <span
                  key={i}
                  title={h.evidence}
                  className="rounded-full bg-violet-50 px-1.5 py-px text-[10px] font-medium text-violet-700 ring-1 ring-violet-200"
                >
                  {h.tier === 1 ? "★ " : ""}
                  {h.label}
                </span>
              ))}
            </div>
          ) : c.rank_reason ? (
            <p className="line-clamp-1 text-xs text-zinc-500" title={c.rank_reason}>
              {c.rank_reason}
            </p>
          ) : null}
        </div>
      </div>

      <div className="w-24 shrink-0 text-right sm:w-28">
        {c.rank_score != null ? (
          <>
            <div className="flex items-baseline justify-end gap-1.5">
              <span
                className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${verdict.chip}`}
              >
                {verdict.label}
              </span>
              <span className={`text-2xl font-bold tabular-nums leading-none ${SCORE_TEXT[verdict.bar] ?? "text-zinc-900"}`}>
                {c.rank_score}
              </span>
            </div>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-zinc-100">
              <div
                className={`h-full rounded-full ${verdict.bar}`}
                style={{ width: `${Math.min(Math.max(Number(c.rank_score), 2), 100)}%` }}
              />
            </div>
          </>
        ) : pipelineActive ? (
          <div className="flex animate-pulse flex-col items-end gap-1">
            <div className="h-6 w-9 rounded bg-zinc-100" />
            <div className="text-[10px] font-medium text-zinc-400">scoring…</div>
          </div>
        ) : (
          <span className="text-[10px] font-medium text-zinc-300">unscored</span>
        )}
      </div>

      {!c.researching ? (
        <form action={researchCandidateAction} className="shrink-0">
          <input type="hidden" name="id" value={c.id} />
          <input type="hidden" name="need_id" value={c.need_id ?? ""} />
          <button
            type="submit"
            className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
          >
            {researched ? "Re-research" : "Research"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
