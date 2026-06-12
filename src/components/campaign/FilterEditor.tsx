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
      <div className="mb-1.5 flex items-baseline gap-2">
        <label className="eyebrow">{label}</label>
        {hint ? <span className="font-mono text-[11px] text-faint">{hint}</span> : null}
      </div>
      <div className="field flex flex-wrap items-center gap-1.5 px-2 py-1.5">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 px-2 py-0.5 text-xs font-medium text-cyan-200 ring-1 ring-cyan-500/25"
          >
            {v}
            <button
              type="button"
              aria-label={`Remove ${v}`}
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="text-cyan-300/60 hover:text-cyan-100"
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
          className="min-w-24 flex-1 bg-transparent py-0.5 text-sm text-ink outline-none placeholder:text-faint"
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
        <label className="eyebrow mb-1.5 block">Job title</label>
        <input
          value={value.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="e.g. CTO"
          className="field w-full px-3 py-2 text-sm"
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
        <summary className="cursor-pointer select-none font-mono text-xs text-faint transition-colors hover:text-muted">
          + Advanced
        </summary>
        <div className="mt-3 space-y-4">
          <div>
            <label className="eyebrow mb-1.5 block">Keywords</label>
            <input
              value={value.keywords}
              onChange={(e) => set("keywords", e.target.value)}
              placeholder="residual freetext — matches the whole profile"
              className="field w-full px-3 py-2 text-sm"
            />
          </div>
          <div>
            <span className="eyebrow mb-1.5 block">Network</span>
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
                        ? "border-transparent bg-gradient-to-r from-glow to-blue text-[#001417]"
                        : "border-border-soft bg-surface-2/50 text-muted hover:text-ink"
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
