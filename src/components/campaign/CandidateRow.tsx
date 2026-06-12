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
  "bg-emerald-400": "text-emerald-300",
  "bg-amber-400": "text-amber-300",
  "bg-rose-400": "text-rose-300",
  "bg-border": "text-faint",
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
      className={`card flex items-center gap-3 p-3.5 transition-colors hover:bg-surface-2/40 sm:gap-4 ${
        topThree ? "ring-1 ring-cyan-500/30" : ""
      }`}
    >
      <div
        className={`w-5 shrink-0 text-center font-mono text-sm font-bold tabular-nums sm:w-9 sm:text-lg ${
          rank == null ? "text-border" : topThree ? "text-gradient" : "text-faint"
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
            className="h-9 w-9 rounded-full bg-surface-2 object-cover ring-1 ring-border-soft transition hover:ring-2 hover:ring-cyan-500/50 sm:h-11 sm:w-11"
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-sm font-medium text-muted ring-1 ring-border-soft transition hover:ring-2 hover:ring-cyan-500/50 sm:h-11 sm:w-11">
            {initials(c.full_name)}
          </div>
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Link
            href={`/candidates/${c.id}`}
            className="truncate text-sm font-medium text-ink hover:text-white hover:underline"
          >
            {c.full_name ?? "—"}
          </Link>
          <a
            href={c.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            title="Open LinkedIn profile"
            className="shrink-0 rounded border border-border-soft px-1.5 py-0.5 text-[10px] font-semibold text-faint hover:border-border hover:text-ink"
          >
            in
          </a>
        </div>
        <p className="truncate text-xs text-muted" title={c.headline ?? undefined}>
          {c.headline ?? `${c.current_title ?? ""}${c.current_company ? ` · ${c.current_company}` : ""}`}
        </p>
        <div className="mt-1">
          {c.researching ? (
            <span className="chip bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/25">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-current" />
              researching…
            </span>
          ) : researched ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="truncate text-xs text-muted" title={c.dossier?.one_liner ?? c.dossier?.bottom_line ?? undefined}>
                <span
                  title="Deep-researched"
                  className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 align-middle"
                />
                {c.dossier?.one_liner ?? c.dossier?.bottom_line ?? ""}
              </p>
              {highlights.map((h, i) => (
                <span
                  key={i}
                  title={h.evidence}
                  className="rounded-full bg-cyan-500/15 px-1.5 py-px text-[10px] font-medium text-cyan-200 ring-1 ring-cyan-500/25"
                >
                  {h.tier === 1 ? "★ " : ""}
                  {h.label}
                </span>
              ))}
            </div>
          ) : c.rank_reason ? (
            <p className="line-clamp-1 text-xs text-faint" title={c.rank_reason}>
              {c.rank_reason}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex w-16 shrink-0 flex-col items-end gap-1.5 sm:w-28">
        {c.rank_score != null ? (
          <div className="w-full text-right">
            <div className="flex items-baseline justify-end gap-1.5">
              {/* Verdict text only from sm up — on phones the score + bar say it. */}
              <span className={`chip hidden sm:inline-flex ${verdict.chip}`}>{verdict.label}</span>
              <span className={`text-xl font-bold tabular-nums leading-none sm:text-2xl ${SCORE_TEXT[verdict.bar] ?? "text-ink"}`}>
                {c.rank_score}
              </span>
            </div>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className={`h-full rounded-full ${verdict.bar}`}
                style={{ width: `${Math.min(Math.max(Number(c.rank_score), 2), 100)}%` }}
              />
            </div>
          </div>
        ) : pipelineActive ? (
          <div className="flex animate-pulse flex-col items-end gap-1">
            <div className="h-6 w-9 rounded bg-surface-2" />
            <div className="font-mono text-[10px] text-faint">scoring…</div>
          </div>
        ) : (
          <span className="font-mono text-[10px] text-faint">unscored</span>
        )}

        {!c.researching ? (
          <form action={researchCandidateAction}>
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="need_id" value={c.need_id ?? ""} />
            <button
              type="submit"
              className="whitespace-nowrap rounded-md border border-border-soft px-2 py-1 text-xs font-medium text-muted transition-colors hover:border-border hover:text-ink sm:px-2.5"
            >
              {researched ? "Re-research" : "Research"}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
