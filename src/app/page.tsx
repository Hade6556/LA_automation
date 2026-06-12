import Link from "next/link";
import AutoRefresh from "@/components/AutoRefresh";
import NewCampaign from "@/components/campaign/NewCampaign";
import { getNeeds, needIsStale } from "@/lib/needs";
import { NEED_STATUS_META } from "@/lib/pipeline/labels";
import { ACTIVE_NEED_STATUSES } from "@/lib/types";
import { deleteCampaignAction } from "./campaigns/actions";
import { logout } from "./login/actions";

function when(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

// The campaign list is live DB state — never prerender it at build time.
export const dynamic = "force-dynamic";

// Home: type what you're looking for, and re-enter past campaigns.
export default async function Home() {
  const needs = await getNeeds();
  const anyActive = needs.some((n) => ACTIVE_NEED_STATUSES.includes(n.status));

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      {anyActive ? <AutoRefresh /> : null}
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-base font-semibold">Lost Astronaut</h1>
            <p className="text-xs text-zinc-500">Find · scan · rank · research</p>
          </div>
          <div className="flex items-center gap-2">
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

      <main className="mx-auto max-w-3xl px-6 py-8">
        <NewCampaign />

        {needs.length > 0 ? (
          <section className="mt-8">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
              Campaigns
            </h2>
            <ul className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
              {needs.map((n) => {
                const meta = NEED_STATUS_META[n.status];
                const stale = needIsStale(n);
                return (
                  <li
                    key={n.id}
                    className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3 last:border-0 hover:bg-zinc-50"
                  >
                    <Link href={`/campaigns/${n.id}`} className="group min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-zinc-900 group-hover:underline">
                        {n.need_text}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500">
                        <span className="truncate">{n.label}</span>
                        <span className="text-zinc-300">·</span>
                        <span className="whitespace-nowrap">
                          {n.counts.found} found
                          {n.counts.ranked ? ` · ${n.counts.ranked} ranked` : ""}
                          {n.counts.researched ? ` · ${n.counts.researched} researched` : ""}
                        </span>
                        <span className="text-zinc-300">·</span>
                        <span className="whitespace-nowrap">{when(n.created_at)}</span>
                      </div>
                    </Link>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        stale ? "bg-rose-100 text-rose-700" : meta.chip
                      }`}
                    >
                      {meta.live && !stale ? (
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                      ) : null}
                      {stale ? "Stalled" : meta.label}
                    </span>
                    <form action={deleteCampaignAction}>
                      <input type="hidden" name="id" value={n.id} />
                      <button
                        type="submit"
                        title="Delete campaign (its people stay in All candidates)"
                        className="rounded px-1.5 py-0.5 text-zinc-300 hover:bg-zinc-100 hover:text-zinc-600"
                      >
                        ×
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </main>
    </div>
  );
}
