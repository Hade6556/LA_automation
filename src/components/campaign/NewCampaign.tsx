"use client";

import { useState, useTransition } from "react";
import { createCampaignAction, suggestFiltersAction } from "@/app/campaigns/actions";
import FilterEditor from "@/components/campaign/FilterEditor";
import type { SearchFilters } from "@/lib/types";

// The first screen: type what you're looking for → AI suggests filters →
// confirm/tweak → start. createCampaignAction redirects to the campaign page,
// which opens in its scanning state.

export default function NewCampaign() {
  const [phase, setPhase] = useState<"input" | "review">("input");
  const [needText, setNeedText] = useState("");
  const [filters, setFilters] = useState<SearchFilters | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const suggest = () => {
    setError(null);
    startTransition(async () => {
      const res = await suggestFiltersAction(needText);
      if (res.ok) {
        setFilters(res.filters);
        setPhase("review");
      } else {
        setError(res.error);
      }
    });
  };

  const start = () => {
    if (!filters) return;
    setError(null);
    startTransition(async () => {
      // Redirects to /campaigns/[id] on success; only returns on validation error.
      const res = await createCampaignAction(needText, filters);
      if (res && !res.ok) setError(res.error);
    });
  };

  if (phase === "review" && filters) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">
              Here&apos;s how I&apos;d search for that
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              “{needText.trim()}” — tweak the filters, then start the campaign.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPhase("input")}
            className="shrink-0 text-xs font-medium text-zinc-400 hover:text-zinc-600"
          >
            ← Back
          </button>
        </div>

        <FilterEditor value={filters} onChange={setFilters} />

        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

        <button
          type="button"
          onClick={start}
          disabled={pending}
          className="mt-5 w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "Starting…" : "Start campaign"}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <label htmlFor="need-text" className="mb-2 block text-sm font-semibold text-zinc-900">
        Who are you looking for?
      </label>
      <textarea
        id="need-text"
        value={needText}
        onChange={(e) => setNeedText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (!pending && needText.trim()) suggest();
          }
        }}
        rows={3}
        autoFocus
        placeholder="e.g. CTO of a fintech in London who has built a product from zero…"
        className="w-full resize-none rounded-md border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-zinc-300 focus:border-zinc-400"
      />
      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-zinc-400">AI turns this into LinkedIn search filters.</p>
        <button
          type="button"
          onClick={suggest}
          disabled={pending || !needText.trim()}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "Thinking…" : "Suggest filters"}
        </button>
      </div>
    </div>
  );
}
