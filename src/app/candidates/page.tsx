import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import AutoRefresh from "@/components/AutoRefresh";
import { getCandidates, getStatusCounts } from "@/lib/candidates";
import { selectHighlights } from "@/lib/highlights";
import { availability, fmt, followerTotal, initials, photoUrl } from "@/lib/people";
import { CANDIDATE_STATUSES, type Candidate } from "@/lib/types";
import {
  STATUS_META,
  effectiveLabel,
  labelClasses,
  statusClasses,
} from "@/lib/pipeline/labels";

// The archive: every candidate ever scraped, across all campaigns.
export default async function AllCandidates({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const active = status ?? "all";
  const [candidates, counts] = await Promise.all([
    getCandidates(active),
    getStatusCounts(),
  ]);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const researchingCount = candidates.filter((c) => c.researching).length;

  const chips: { key: string; label: string; count: number }[] = [
    { key: "all", label: "All", count: total },
    ...CANDIDATE_STATUSES.map((s) => ({
      key: s,
      label: STATUS_META[s],
      count: counts[s] ?? 0,
    })),
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <AutoRefresh />
      <AppHeader active="candidates" />

      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
        <div className="animate-fade-up mb-6">
          <h1 className="font-display text-3xl text-ink">All candidates</h1>
          <p className="mt-1 font-mono text-xs text-faint">
            Everyone ever scraped · {total} candidates
            {researchingCount > 0 ? (
              <span className="ml-2 inline-flex items-center gap-1 text-amber-300">
                <span className="live-dot h-1.5 w-1.5 rounded-full bg-amber-400" />
                researching {researchingCount}…
              </span>
            ) : null}
          </p>
        </div>

        {/* Status filter chips */}
        <div className="animate-fade-up mb-5 flex flex-wrap gap-2" style={{ animationDelay: "80ms" }}>
          {chips.map((c) => {
            const isActive = c.key === active;
            const href = c.key === "all" ? "/candidates" : `/candidates?status=${c.key}`;
            return (
              <Link
                key={c.key}
                href={href}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-gradient-to-r from-glow to-blue text-[#001417]"
                    : "border border-border-soft bg-surface-2/50 text-muted hover:text-ink"
                }`}
              >
                {c.label}
                <span className={`ml-1.5 font-mono ${isActive ? "text-[#001417]/60" : "text-faint"}`}>
                  {c.count}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="card animate-fade-up overflow-hidden p-0" style={{ animationDelay: "140ms" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-soft text-left">
                {["Candidate", "Now", "Status", "Rank", "Label", "Track", "Reach", "Availability"].map((h) => (
                  <th key={h} className="px-4 py-3 font-mono text-[11px] font-medium uppercase tracking-wider text-faint">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {candidates.map((c: Candidate) => {
                const label = effectiveLabel(c);
                const reach = followerTotal(c.social);
                const avail = availability(c.signals);
                const photo = photoUrl(c.social);
                const init = initials(c.full_name);
                const highlights = selectHighlights(c, [], { max: 2, tier1Only: true });
                return (
                  <tr
                    key={c.id}
                    className={`border-b border-border-soft/60 last:border-0 transition-colors hover:bg-surface-2/40 ${
                      c.researching ? "bg-amber-500/5" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/candidates/${c.id}`}
                          title="Open dossier"
                          className="group flex items-center gap-3"
                        >
                          {photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={photo}
                              alt=""
                              referrerPolicy="no-referrer"
                              className="h-9 w-9 shrink-0 rounded-full bg-surface-2 object-cover ring-1 ring-border-soft transition group-hover:ring-2 group-hover:ring-cyan-500/50"
                            />
                          ) : (
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-medium text-muted ring-1 ring-border-soft transition group-hover:ring-2 group-hover:ring-cyan-500/50">
                              {init}
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-ink group-hover:text-white">
                              {c.full_name ?? "—"}
                            </div>
                            <div className="text-xs text-muted">{c.headline}</div>
                            {highlights.length ? (
                              <div className="mt-0.5 flex flex-wrap gap-1">
                                {highlights.map((h, i) => (
                                  <span
                                    key={i}
                                    className="rounded-full bg-cyan-500/15 px-1.5 py-px text-[10px] font-medium text-cyan-200 ring-1 ring-cyan-500/25"
                                  >
                                    {h.label}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
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
                    </td>
                    <td className="px-4 py-3 text-muted">
                      <div>{c.current_company ?? "—"}</div>
                      <div className="text-xs text-faint">{c.current_title}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`chip ${statusClasses(c.status)}`}>
                        {STATUS_META[c.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono tabular-nums text-ink">
                          {c.rank_score ?? "—"}
                        </span>
                        {c.researching ? (
                          <span className="chip bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/25">
                            <span className="live-dot h-1.5 w-1.5 rounded-full bg-current" />
                            researching…
                          </span>
                        ) : c.researched_at ? (
                          <span title="Deep-researched" className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {label ? (
                        <span className={`chip ${labelClasses(label)}`}>{label}</span>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {c.fit_track && c.fit_track !== "none" ? (
                        c.fit_track.replace("_", "-")
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-muted">
                      {reach ? fmt(reach) : <span className="text-faint">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{avail ?? "—"}</td>
                  </tr>
                );
              })}
              {candidates.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center font-mono text-xs text-faint">
                    No candidates in this status.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
