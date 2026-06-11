import Link from "next/link";
import AutoRefresh from "@/components/AutoRefresh";
import { getNeeds } from "@/lib/needs";
import type { NeedStatus } from "@/lib/types";
import {
  clearNeedAction,
  createNeedAction,
  deleteNeedAction,
  scanNeedAction,
} from "./actions";

const STATUS_STYLE: Record<NeedStatus, string> = {
  new: "border-zinc-200 bg-white text-zinc-600",
  queued: "border-amber-200 bg-amber-50 text-amber-700",
  scanning: "border-amber-300 bg-amber-100 text-amber-800",
  done: "border-emerald-200 bg-emerald-50 text-emerald-700",
  error: "border-red-200 bg-red-50 text-red-700",
};

const STATUS_TEXT: Record<NeedStatus, string> = {
  new: "not scanned",
  queued: "queued",
  scanning: "scanning…",
  done: "scanned",
  error: "error",
};

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function NeedsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ error }, needs] = await Promise.all([searchParams, getNeeds()]);
  const activeScans = needs.filter((n) => n.status === "queued" || n.status === "scanning").length;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <AutoRefresh />
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-base font-semibold">Needs</h1>
            <p className="text-xs text-zinc-500">
              What you&apos;re hunting for · {needs.length} need{needs.length === 1 ? "" : "s"}
              {activeScans > 0 ? (
                <span className="ml-2 inline-flex items-center gap-1 font-medium text-amber-600">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                  {activeScans} scan{activeScans === 1 ? "" : "s"} in flight
                </span>
              ) : null}
            </p>
          </div>
          <Link
            href="/"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
          >
            ← Candidates
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-6">
        {/* New need */}
        <form
          action={createNeedAction}
          className="mb-6 flex gap-2 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
        >
          <input
            type="text"
            name="need_text"
            maxLength={500}
            placeholder="What do you want? e.g. CTO of petcare worldwide"
            className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
          />
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Add need
          </button>
        </form>

        {error === "empty" ? (
          <p className="mb-4 text-sm text-red-600">Type what you want to find first.</p>
        ) : null}
        {error === "ai" ? (
          <p className="mb-4 text-sm text-red-600">
            Could not convert the need into filters — check ANTHROPIC_API_KEY.
          </p>
        ) : null}

        {/* Needs list */}
        {needs.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No needs yet. Describe who you&apos;re looking for above — AI turns it into precise
            LinkedIn filters, then Scan finds the people.
          </p>
        ) : (
          <ul className="space-y-3">
            {needs.map((need) => (
              <li
                key={need.id}
                className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{need.label}</p>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">
                      “{need.need_text}”
                      {need.filters.locations.length === 0 ? " · worldwide" : null}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`rounded-full border px-2 py-0.5 font-medium ${STATUS_STYLE[need.status]}`}
                      >
                        {STATUS_TEXT[need.status]}
                        {need.status === "done" && need.scanned_at
                          ? ` ${fmtDate(need.scanned_at)}`
                          : null}
                      </span>
                      <span className="text-zinc-500">
                        {need.live_found} candidate{need.live_found === 1 ? "" : "s"} found
                      </span>
                      {need.status === "error" && need.error ? (
                        <span className="truncate text-red-600" title={need.error}>
                          {need.error}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <form action={scanNeedAction}>
                      <input type="hidden" name="id" value={need.id} />
                      <button
                        type="submit"
                        disabled={need.status === "queued" || need.status === "scanning"}
                        className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
                      >
                        {need.status === "done" || need.status === "error" ? "Re-scan" : "Scan"}
                      </button>
                    </form>
                    <form action={clearNeedAction}>
                      <input type="hidden" name="id" value={need.id} />
                      <button
                        type="submit"
                        className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50"
                      >
                        Clear
                      </button>
                    </form>
                    <form action={deleteNeedAction}>
                      <input type="hidden" name="id" value={need.id} />
                      <button
                        type="submit"
                        className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-6 text-xs text-zinc-400">
          Scans run on your Mac: keep a linkedin-cli session open and{" "}
          <code className="rounded bg-zinc-100 px-1">node --env-file=.env.local scripts/needs-worker.mjs</code>{" "}
          running. Queued needs start within ~10s.
        </p>
      </main>
    </div>
  );
}
