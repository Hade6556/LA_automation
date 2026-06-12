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
      <div className="card p-5 sm:p-6">
        <div className="mb-5 flex items-baseline justify-between gap-3">
          <div>
            <h2 className="font-display text-xl text-ink">Here&apos;s how I&apos;d search</h2>
            <p className="mt-0.5 text-xs text-muted">
              “{needText.trim()}” — tweak the filters, then launch.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPhase("input")}
            className="shrink-0 font-mono text-xs text-faint transition-colors hover:text-ink"
          >
            ← Back
          </button>
        </div>

        <FilterEditor value={filters} onChange={setFilters} />

        {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}

        <button
          type="button"
          onClick={start}
          disabled={pending}
          className="btn btn-primary mt-6 w-full py-2.5 text-[0.95rem] font-semibold"
        >
          {pending ? "Launching…" : "Launch campaign →"}
        </button>
      </div>
    );
  }

  return (
    <div className="card group p-2.5 transition-shadow focus-within:shadow-[0_0_60px_-20px_var(--color-cyan)]">
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
        placeholder="e.g. CTO of a fintech in Singapore who built a product from zero…"
        className="w-full resize-none bg-transparent px-3.5 pt-3 pb-2 text-[0.95rem] text-ink outline-none placeholder:text-faint"
      />
      {error ? <p className="px-3.5 pb-1 text-sm text-rose-300">{error}</p> : null}
      <div className="flex items-center justify-between gap-3 px-3.5 pb-1 pt-1">
        <p className="font-mono text-[11px] text-faint">
          ⏎ AI turns this into precise LinkedIn filters
        </p>
        <button
          type="button"
          onClick={suggest}
          disabled={pending || !needText.trim()}
          className="btn btn-primary"
        >
          {pending ? "Thinking…" : "Suggest filters"}
        </button>
      </div>
    </div>
  );
}
