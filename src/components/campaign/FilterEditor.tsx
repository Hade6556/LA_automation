"use client";

import { useState } from "react";
import type { SearchFilters } from "@/lib/types";

// Controlled editor for the AI-suggested LinkedIn filters: tweak the chips,
// then start the campaign. Each concept stays in its own field — that's what
// makes the faceted search precise.

const NETWORK_LABELS: Record<"F" | "S" | "O", string> = {
  F: "1st",
  S: "2nd",
  O: "3rd+",
};

function ChipList({
  label,
  hint,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  hint?: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (!values.some((x) => x.toLowerCase() === v.toLowerCase())) {
      onChange([...values, v]);
    }
    setDraft("");
  };

  return (
    <div>
      <div className="mb-1 flex items-baseline gap-2">
        <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {label}
        </label>
        {hint ? <span className="text-[11px] text-zinc-400">{hint}</span> : null}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2 py-1.5">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700"
          >
            {v}
            <button
              type="button"
              aria-label={`Remove ${v}`}
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="text-zinc-400 hover:text-zinc-700"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            } else if (e.key === "Backspace" && !draft && values.length) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={add}
          placeholder={values.length ? "" : placeholder}
          className="min-w-24 flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-zinc-300"
        />
      </div>
    </div>
  );
}

export default function FilterEditor({
  value,
  onChange,
}: {
  value: SearchFilters;
  onChange: (next: SearchFilters) => void;
}) {
  const set = <K extends keyof SearchFilters>(key: K, v: SearchFilters[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
          Job title
        </label>
        <input
          value={value.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="e.g. CTO"
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-zinc-300 focus:border-zinc-400"
        />
      </div>

      <ChipList
        label="Industries"
        values={value.industries}
        onChange={(v) => set("industries", v)}
        placeholder="e.g. Fintech — Enter to add"
      />
      <ChipList
        label="Locations"
        hint="empty = worldwide"
        values={value.locations}
        onChange={(v) => set("locations", v)}
        placeholder="e.g. London — Enter to add"
      />
      <ChipList
        label="Current companies"
        values={value.current_companies}
        onChange={(v) => set("current_companies", v)}
        placeholder="e.g. Stripe — Enter to add"
      />

      <details className="group">
        <summary className="cursor-pointer select-none text-xs font-medium text-zinc-400 hover:text-zinc-600">
          Advanced
        </summary>
        <div className="mt-3 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
              Keywords
            </label>
            <input
              value={value.keywords}
              onChange={(e) => set("keywords", e.target.value)}
              placeholder="residual freetext — matches the whole profile"
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-zinc-300 focus:border-zinc-400"
            />
          </div>
          <div>
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
              Network
            </span>
            <div className="flex gap-1.5">
              {(Object.keys(NETWORK_LABELS) as ("F" | "S" | "O")[]).map((n) => {
                const on = value.network.includes(n);
                return (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      set(
                        "network",
                        on ? value.network.filter((x) => x !== n) : [...value.network, n],
                      )
                    }
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      on
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                    }`}
                  >
                    {NETWORK_LABELS[n]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}
