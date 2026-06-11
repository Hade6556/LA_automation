import Link from "next/link";
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
import { logout } from "../login/actions";

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
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <AutoRefresh />
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-base font-semibold">All candidates</h1>
            <p className="text-xs text-zinc-500">
              Everyone ever scraped · {total} candidates
              {researchingCount > 0 ? (
                <span className="ml-2 inline-flex items-center gap-1 font-medium text-amber-600">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                  researching {researchingCount}…
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
            >
              Campaigns
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

      <main className="mx-auto max-w-7xl px-6 py-6">
        {/* Status filter chips */}
        <div className="mb-5 flex flex-wrap gap-2">
          {chips.map((c) => {
            const isActive = c.key === active;
            const href = c.key === "all" ? "/candidates" : `/candidates?status=${c.key}`;
            return (
              <Link
                key={c.key}
                href={href}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                }`}
              >
                {c.label}
                <span
                  className={`ml-1.5 ${isActive ? "text-zinc-300" : "text-zinc-400"}`}
                >
                  {c.count}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-3 font-medium">Candidate</th>
                <th className="px-4 py-3 font-medium">Now</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Rank</th>
                <th className="px-4 py-3 font-medium">Label</th>
                <th className="px-4 py-3 font-medium">Track</th>
                <th className="px-4 py-3 font-medium">Reach</th>
                <th className="px-4 py-3 font-medium">Availability</th>
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
                    className={`border-b border-zinc-100 last:border-0 hover:bg-zinc-50 ${
                      c.researching ? "bg-amber-50" : ""
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
                              className="h-9 w-9 shrink-0 rounded-full bg-zinc-100 object-cover transition group-hover:ring-2 group-hover:ring-zinc-300"
                            />
                          ) : (
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-medium text-zinc-500 transition group-hover:ring-2 group-hover:ring-zinc-300">
                              {init}
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-zinc-900 group-hover:underline">
                              {c.full_name ?? "—"}
                            </div>
                            <div className="text-xs text-zinc-500">{c.headline}</div>
                            {highlights.length ? (
                              <div className="mt-0.5 flex flex-wrap gap-1">
                                {highlights.map((h, i) => (
                                  <span
                                    key={i}
                                    className="rounded-full bg-violet-50 px-1.5 py-px text-[10px] font-medium text-violet-700 ring-1 ring-violet-200"
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
                          className="shrink-0 rounded border border-zinc-200 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600"
                        >
                          in
                        </a>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      <div>{c.current_company ?? "—"}</div>
                      <div className="text-xs text-zinc-400">
                        {c.current_title}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${statusClasses(c.status)}`}
                      >
                        {STATUS_META[c.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="tabular-nums text-zinc-700">
                          {c.rank_score ?? "—"}
                        </span>
                        {c.researching ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                            researching…
                          </span>
                        ) : c.researched_at ? (
                          <span
                            title="Deep-researched"
                            className="h-1.5 w-1.5 rounded-full bg-emerald-500"
                          />
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {label ? (
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${labelClasses(label)}`}
                        >
                          {label}
                        </span>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {c.fit_track && c.fit_track !== "none" ? (
                        c.fit_track.replace("_", "-")
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-zinc-600">
                      {reach ? fmt(reach) : <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {avail ?? "—"}
                    </td>
                  </tr>
                );
              })}
              {candidates.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-zinc-400">
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
