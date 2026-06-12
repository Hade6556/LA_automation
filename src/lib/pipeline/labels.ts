import type { Candidate, CandidateStatus, Label, NeedStatus } from "@/lib/types";

// Ilona's manual verdict ALWAYS overrides the computed label (hard rule #5).
export function effectiveLabel(
  c: Pick<Candidate, "ilona_verdict" | "computed_label">,
): Label | null {
  return c.ilona_verdict ?? c.computed_label;
}

export const STATUS_META: Record<CandidateStatus, string> = {
  sourced: "Sourced",
  ranked: "Ranked",
  in_review: "In review",
  approved: "Approved",
  invited: "Invited",
  accepted: "Accepted",
  in_chat: "In chat",
  meeting_booked: "Meeting booked",
  met: "Met",
  labeled: "Labeled",
  holding: "Holding",
};

export function labelClasses(l: Label): string {
  return {
    green: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25",
    yellow: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/25",
    red: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/25",
  }[l];
}

export function statusClasses(s: CandidateStatus): string {
  if (s === "labeled") return "bg-gradient-to-r from-glow to-blue text-[#001417]";
  if (s === "holding") return "bg-surface-2 text-faint ring-1 ring-border-soft";
  return "bg-surface-2 text-muted ring-1 ring-border-soft";
}

// Campaign (need) pipeline status, for the home list + campaign page banner.
// `live` statuses pulse — the pipeline is (supposed to be) working.
export const NEED_STATUS_META: Record<
  NeedStatus,
  { label: string; chip: string; live: boolean }
> = {
  new: { label: "Draft", chip: "bg-surface-2 text-faint ring-1 ring-border-soft", live: false },
  queued: { label: "Starting…", chip: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/25", live: true },
  scanning: { label: "Scanning…", chip: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/25", live: true },
  ranking: { label: "Ranking…", chip: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/25", live: true },
  researching: { label: "Researching…", chip: "bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/25", live: true },
  done: { label: "Done", chip: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25", live: false },
  error: { label: "Error", chip: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/25", live: false },
};

// Cohort-percentile → bar colour for the per-signal bars on the candidate page.
export function relColor(percentile: number): string {
  if (percentile >= 0.66) return "bg-emerald-400";
  if (percentile >= 0.33) return "bg-amber-400";
  return "bg-rose-400";
}

// Verdict derived from the overall fit score, for the 60-second scorecard.
export function verdictFor(
  score: number | null,
): { label: string; chip: string; bar: string } {
  if (score == null) return { label: "Unscored", chip: "bg-surface-2 text-faint ring-1 ring-border-soft", bar: "bg-border" };
  if (score >= 75) return { label: "Strong fit", chip: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25", bar: "bg-emerald-400" };
  if (score >= 55) return { label: "Promising", chip: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/25", bar: "bg-amber-400" };
  return { label: "Weak fit", chip: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/25", bar: "bg-rose-400" };
}
