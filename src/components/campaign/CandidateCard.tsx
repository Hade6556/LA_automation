import Link from "next/link";
import { researchCandidateAction } from "@/app/campaigns/actions";
import { selectHighlights } from "@/lib/highlights";
import { initials, photoUrl } from "@/lib/people";
import { verdictFor } from "@/lib/pipeline/labels";
import type { Candidate } from "@/lib/types";

// One person in the campaign grid. Fills in live as the pipeline works:
// scraped (identity only) → scored (rank + verdict + reason) → researched
// (one-liner + highlight chips). Server component — the Research button is a
// plain form action.

export default function CandidateCard({
  candidate: c,
  pipelineActive,
}: {
  candidate: Candidate;
  pipelineActive: boolean;
}) {
  const photo = photoUrl(c.social);
  const verdict = verdictFor(c.rank_score);
  const researched = c.researched_at != null;
  const highlights = researched
    ? selectHighlights(c, c.dossier?.top_strengths ?? [], { max: 3 })
    : [];

  return (
    <div className="flex flex-col rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-start gap-3">
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
        </div>
        <div className="shrink-0 text-right">
          {c.rank_score != null ? (
            <>
              <div className="text-xl font-semibold tabular-nums text-zinc-900">
                {c.rank_score}
              </div>
              <span
                className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${verdict.chip}`}
              >
                {verdict.label}
              </span>
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
      </div>

      <div className="mt-3 flex-1">
        {c.researching ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
            researching…
          </span>
        ) : researched ? (
          <>
            <p className="text-xs text-zinc-600">
              <span
                title="Deep-researched"
                className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 align-middle"
              />
              {c.dossier?.one_liner ?? c.dossier?.bottom_line ?? ""}
            </p>
            {highlights.length ? (
              <div className="mt-1.5 flex flex-wrap gap-1">
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
            ) : null}
          </>
        ) : c.rank_reason ? (
          <p className="line-clamp-2 text-xs text-zinc-500" title={c.rank_reason}>
            {c.rank_reason}
          </p>
        ) : null}
      </div>

      {!c.researching ? (
        <form action={researchCandidateAction} className="mt-3">
          <input type="hidden" name="id" value={c.id} />
          <input type="hidden" name="need_id" value={c.need_id ?? ""} />
          <button
            type="submit"
            className="w-full rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
          >
            {researched ? "Re-research" : "Research"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
