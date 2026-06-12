import { notFound } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import AutoRefresh from "@/components/AutoRefresh";
import { getCandidate, getResearchedCohort } from "@/lib/candidates";
import { computeStanding, standoutsAndLags } from "@/lib/relative";
import { selectHighlights } from "@/lib/highlights";
import { RANK_SIGNALS, type Candidate } from "@/lib/types";
import { STATUS_META, effectiveLabel, labelClasses, relColor, verdictFor } from "@/lib/pipeline/labels";

function photoUrl(social: Record<string, unknown>): string | null {
  const u = (social as { photo_url?: unknown })?.photo_url;
  return typeof u === "string" ? u : null;
}
function initials(name: string | null): string {
  if (!name) return "?";
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}
const signalLabel = (key: string) => RANK_SIGNALS.find(([k]) => k === key)?.[1] ?? key;

// Fallbacks when the (deeper) research fields aren't present on a row yet.
function deriveStrengths(c: Candidate): string[] {
  const b = c.rank_breakdown;
  if (!b) return [];
  return Object.entries(b)
    .filter(([, v]) => v && typeof v.score === "number")
    .sort((a, z) => (z[1]!.score ?? 0) - (a[1]!.score ?? 0))
    .slice(0, 2)
    .map(([k, v]) => `${signalLabel(k)} (${v!.score})`);
}
function deriveWatchOuts(c: Candidate): string[] {
  const b = c.rank_breakdown;
  if (!b) return [];
  return Object.entries(b)
    .filter(([, v]) => v && typeof v.score === "number")
    .sort((a, z) => (a[1]!.score ?? 0) - (z[1]!.score ?? 0))
    .slice(0, 1)
    .map(([k, v]) => `${signalLabel(k)} (${v!.score})`);
}

export default async function CandidatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = await getCandidate(id);
  if (!c) notFound();

  const cohort = await getResearchedCohort();
  const standing = computeStanding(cohort, c.id);
  const { standouts, lags } = standing
    ? standoutsAndLags(standing)
    : { standouts: [], lags: [] };

  // Overall position among researched candidates, for context next to the score.
  const scoredCohort = cohort
    .filter((x) => x.rank_score != null)
    .sort((a, b) => Number(b.rank_score) - Number(a.rank_score));
  const overallIdx = scoredCohort.findIndex((x) => x.id === c.id);
  const overallRank = overallIdx === -1 ? null : { n: overallIdx + 1, of: scoredCohort.length };

  const photo = photoUrl(c.social);
  const label = effectiveLabel(c);
  const verdict = verdictFor(c.rank_score != null ? Number(c.rank_score) : null);
  const oneLiner =
    c.dossier?.one_liner ??
    [c.current_title, c.current_company].filter(Boolean).join(" @ ") ??
    null;
  const bottomLine =
    c.dossier?.bottom_line ?? (c.rank_reason ? c.rank_reason.split(/(?<=[.!?])\s/)[0] : null);
  const strengths = c.dossier?.top_strengths?.length ? c.dossier.top_strengths : deriveStrengths(c);
  const watchOuts = c.dossier?.watch_outs?.length ? c.dossier.watch_outs : deriveWatchOuts(c);
  const highlights = selectHighlights(c, strengths, { max: 4 });
  const positions =
    (c.background as { positions?: { title?: string; company?: string }[] })?.positions ?? [];
  const eduList = ((c.background as { education?: string[] })?.education) ?? [];

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader active="candidates" back={{ href: "/candidates", label: "Candidates" }} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        {c.researching ? <AutoRefresh intervalMs={3000} /> : null}
        {c.researching ? (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500/100" />
            Researching this person now — the dossier fills in automatically.
          </div>
        ) : !c.researched_at ? (
          <div className="mb-4 rounded-lg border border-border-soft bg-surface px-4 py-2.5 text-sm text-faint">
            Basic LinkedIn data only — deep research hasn’t run for this person yet.
          </div>
        ) : null}
        {/* ===== 60-SECOND SCORECARD ===== */}
        <section className="rounded-2xl border border-border-soft bg-surface p-6 shadow-sm">
          <div className="flex items-start gap-4">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo}
                alt=""
                referrerPolicy="no-referrer"
                className="h-16 w-16 shrink-0 rounded-full bg-surface-2 object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-border text-lg font-medium text-faint">
                {initials(c.full_name)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold">{c.full_name ?? "—"}</h1>
                <a
                  href={c.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded border border-border px-2 py-0.5 text-xs text-muted hover:bg-surface-2/40"
                >
                  LinkedIn ↗
                </a>
              </div>
              {oneLiner ? <p className="mt-0.5 text-sm text-muted">{oneLiner}</p> : null}
            </div>
            <div className="shrink-0 text-right">
              <span className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${verdict.chip}`}>
                {verdict.label}
              </span>
              <div className="mt-1 text-4xl font-bold tabular-nums leading-none">
                {c.rank_score ?? "—"}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-faint">
                fit score
                {overallRank ? (
                  <span className="ml-1 font-semibold normal-case tracking-normal text-faint">
                    · #{overallRank.n} of {overallRank.of}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {bottomLine ? (
            <p className="mt-4 text-[15px] leading-relaxed text-ink">
              <span className="font-semibold">Bottom line:</span> {bottomLine}
            </p>
          ) : null}

          {c.comparison_note ? (
            <p className="mt-2 text-sm leading-relaxed text-muted">
              <span className="font-semibold text-muted">Why ranked here:</span>{" "}
              {c.comparison_note}
            </p>
          ) : null}

          {highlights.length ? (
            <div className="mt-4">
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-cyan-300">
                Highlights
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {highlights.map((h, i) => (
                  <span
                    key={i}
                    title={h.evidence}
                    className={`rounded-full px-2.5 py-1 text-xs ring-1 ${
                      h.tier === 1
                        ? "bg-cyan-500/15 font-medium text-cyan-100 ring-cyan-500/40"
                        : "bg-cyan-500/10 text-cyan-200 ring-cyan-500/25"
                    }`}
                  >
                    {h.tier === 1 ? "★ " : ""}
                    {h.label}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {strengths.length || watchOuts.length ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-300">
                  Strengths
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {strengths.map((s, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300 ring-1 ring-emerald-200"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-amber-300">
                  Watch-outs
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {watchOuts.map((s, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300 ring-1 ring-amber-200"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {/* Per-signal scores, with cohort standing when 2+ are researched */}
          {c.rank_breakdown ? (
            <div className="mt-5 border-t border-border-soft pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">
                Signals
              </h3>
              {standouts.length || lags.length ? (
                <div className="mt-1.5 space-y-1 text-sm">
                  {standouts.length ? (
                    <p className="text-emerald-300">
                      <span className="font-semibold">Strongest in group:</span>{" "}
                      {standouts.map((s) => `${s.label} #${s.rank}`).join(" · ")}
                    </p>
                  ) : null}
                  {lags.length ? (
                    <p className="text-amber-300">
                      <span className="font-semibold">Weakest in group:</span>{" "}
                      {lags.map((s) => `${s.label} #${s.rank}`).join(" · ")}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <div className="mt-3 space-y-3">
                {RANK_SIGNALS.map(([key, lbl]) => {
                  const s = c.rank_breakdown?.[key];
                  if (!s || typeof s.score !== "number") return null;
                  const st = standing?.find((x) => x.key === key);
                  const fill = st ? relColor(st.percentile) : verdictFor(s.score).bar;
                  return (
                    <div key={key}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-medium text-muted">{lbl}</span>
                        <span className="flex shrink-0 items-baseline gap-2">
                          <span className="text-sm font-semibold tabular-nums text-ink">
                            {s.score}
                          </span>
                          {st ? (
                            <span
                              className="rounded bg-surface-2 px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted"
                              title={`Ranked #${st.rank} of the ${st.of} researched candidates on this signal`}
                            >
                              #{st.rank}/{st.of}
                            </span>
                          ) : null}
                        </span>
                      </div>
                      <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
                        <div
                          className={`h-full rounded-full ${fill}`}
                          style={{ width: `${Math.min(Math.max(s.score, 2), 100)}%` }}
                        />
                      </div>
                      {s.note ? (
                        <p className="mt-1 text-xs leading-snug text-faint">{s.note}</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-faint">
                {standing
                  ? `Bar = score (0–100) · colour = standing vs the ${standing[0].of} researched candidates.`
                  : "Bar = score (0–100). Cohort comparison appears once 2+ candidates are researched."}
              </p>
            </div>
          ) : null}

          <div className="mt-4 flex items-center gap-2 text-xs text-faint">
            <span className={`rounded px-2 py-0.5 ${labelClasses(label ?? "green")} ${label ? "" : "hidden"}`}>
              {label}
            </span>
            <span className="rounded bg-surface-2 px-2 py-0.5 text-faint">{STATUS_META[c.status]}</span>
            {c.researched_at ? (
              <span className="text-emerald-300">● researched</span>
            ) : (
              <span className="text-amber-300">not deep-researched yet</span>
            )}
            {c.sources?.length ? <span>· {c.sources.length} sources</span> : null}
          </div>
        </section>

        {/* ===== FULL DOSSIER (collapsed) ===== */}
        <details
          open={!c.researched_at}
          className="group mt-4 rounded-2xl border border-border-soft bg-surface"
        >
          <summary className="cursor-pointer list-none px-6 py-4 text-sm font-medium text-muted hover:text-ink">
            <span className="select-none">▸ Full dossier</span>
            <span className="text-faint group-open:hidden"> — summary, achievements, education, sources</span>
          </summary>
          <div className="space-y-5 border-t border-border-soft px-6 py-5">
            {c.dossier?.summary ? (
              <div>
                <h2 className="mb-1 text-sm font-semibold">Summary</h2>
                <p className="text-sm text-muted">{c.dossier.summary}</p>
                {c.dossier.current_focus ? (
                  <p className="mt-2 text-sm text-faint">
                    <span className="font-medium text-muted">Now:</span> {c.dossier.current_focus}
                  </p>
                ) : null}
              </div>
            ) : null}
            {c.rank_reason ? (
              <div>
                <h2 className="mb-1 text-sm font-semibold">Overall assessment</h2>
                <p className="text-sm text-muted">{c.rank_reason}</p>
              </div>
            ) : null}
            {c.dossier?.key_achievements?.length ? (
              <div>
                <h2 className="mb-2 text-sm font-semibold">Key achievements</h2>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
                  {c.dossier.key_achievements.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div>
              <h2 className="mb-1 text-sm font-semibold">Education</h2>
              {c.dossier?.education_summary ? (
                <p className="text-sm text-muted">{c.dossier.education_summary}</p>
              ) : eduList.length ? (
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
                  {eduList.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-faint">—</p>
              )}
            </div>
            {c.sources?.length ? (
              <div>
                <h2 className="mb-2 text-sm font-semibold">Sources ({c.sources.length})</h2>
                <ul className="space-y-1 text-sm">
                  {c.sources.map((s, i) => (
                    <li key={i}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {s.title || s.url}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {positions.length ? (
              <div>
                <h2 className="mb-2 text-sm font-semibold">Career (LinkedIn)</h2>
                <ul className="space-y-1 text-sm text-muted">
                  {positions.map((p, i) => (
                    <li key={i}>
                      <span className="font-medium">{p.title}</span>
                      {p.company ? <span className="text-faint"> @ {p.company}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </details>
      </main>
    </div>
  );
}
