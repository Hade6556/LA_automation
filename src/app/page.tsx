import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import AutoRefresh from "@/components/AutoRefresh";
import NewCampaign from "@/components/campaign/NewCampaign";
import RotatingRole from "@/components/RotatingRole";
import { getNeeds, needIsStale } from "@/lib/needs";
import { NEED_STATUS_META } from "@/lib/pipeline/labels";
import { ACTIVE_NEED_STATUSES } from "@/lib/types";
import { deleteCampaignAction } from "./campaigns/actions";

function when(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// The campaign list is live DB state — never prerender it at build time.
export const dynamic = "force-dynamic";

export default async function Home() {
  const needs = await getNeeds();
  const anyActive = needs.some((n) => ACTIVE_NEED_STATUSES.includes(n.status));

  return (
    <div className="flex min-h-screen flex-col">
      {anyActive ? <AutoRefresh /> : null}
      <AppHeader active="campaigns" />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6">
        {/* ── Hero ───────────────────────────────────────────── */}
        <section className="pt-20 pb-12 text-center sm:pt-28">
          <p className="eyebrow animate-fade-up" style={{ animationDelay: "40ms" }}>
            Lost Astronaut · talent radar
          </p>
          <h1
            className="animate-fade-up mt-5 font-display text-5xl leading-[1.04] tracking-tight text-ink sm:text-6xl"
            style={{ animationDelay: "120ms" }}
          >
            Vibe code your <span className="text-gradient italic">need</span>
          </h1>
          {/* min-h reserves two lines on phones — cycling roles of different
              lengths must never shift the input below. */}
          <p
            className="animate-fade-up mt-5 min-h-12 font-mono text-base text-balance text-muted sm:min-h-7 sm:text-lg"
            style={{ animationDelay: "200ms" }}
          >
            I want to find <RotatingRole />
          </p>

          <div
            className="animate-fade-up mt-9 text-left"
            style={{ animationDelay: "300ms" }}
          >
            <NewCampaign />
          </div>
        </section>

        {/* ── Past campaigns ─────────────────────────────────── */}
        {needs.length > 0 ? (
          <section className="animate-fade-up pb-20" style={{ animationDelay: "380ms" }}>
            <h2 className="eyebrow mb-3">Your campaigns</h2>
            <ul className="card divide-y divide-border-soft overflow-hidden p-0">
              {needs.map((n) => {
                const meta = NEED_STATUS_META[n.status];
                const stale = needIsStale(n);
                return (
                  <li
                    key={n.id}
                    className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/50"
                  >
                    <Link href={`/campaigns/${n.id}`} className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-ink group-hover:text-white">
                        {n.need_text}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-faint">
                        <span className="truncate text-muted">{n.label}</span>
                        <span>·</span>
                        <span className="whitespace-nowrap">
                          {n.counts.found} found
                          {n.counts.ranked ? ` · ${n.counts.ranked} ranked` : ""}
                          {n.counts.researched ? ` · ${n.counts.researched} researched` : ""}
                        </span>
                        <span>·</span>
                        <span className="whitespace-nowrap">{when(n.created_at)}</span>
                      </div>
                    </Link>
                    <span className={`chip ${stale ? "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/25" : meta.chip}`}>
                      {meta.live && !stale ? (
                        <span className="live-dot h-1.5 w-1.5 rounded-full bg-current" />
                      ) : null}
                      {stale ? "Stalled" : meta.label}
                    </span>
                    <form action={deleteCampaignAction}>
                      <input type="hidden" name="id" value={n.id} />
                      <button
                        type="submit"
                        title="Delete campaign (its people stay in Candidates)"
                        className="rounded-md px-1.5 py-0.5 text-lg leading-none text-faint transition-colors hover:bg-surface-2 hover:text-rose-300"
                      >
                        ×
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : (
          <p className="animate-fade-up pb-20 text-center font-mono text-xs text-faint" style={{ animationDelay: "380ms" }}>
            No campaigns yet — describe who you need above to launch your first scan.
          </p>
        )}
      </main>
    </div>
  );
}
