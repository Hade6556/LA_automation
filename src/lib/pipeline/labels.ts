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
    green: "bg-green-100 text-green-800",
    yellow: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-800",
  }[l];
}

export function statusClasses(s: CandidateStatus): string {
  if (s === "labeled") return "bg-zinc-900 text-white";
  if (s === "holding") return "bg-zinc-100 text-zinc-500";
  return "bg-zinc-100 text-zinc-700";
}

// Campaign (need) pipeline status, for the home list + campaign page banner.
// `live` statuses pulse — the pipeline is (supposed to be) working.
export const NEED_STATUS_META: Record<
  NeedStatus,
  { label: string; chip: string; live: boolean }
> = {
  new: { label: "Draft", chip: "bg-zinc-100 text-zinc-500", live: false },
  queued: { label: "Starting…", chip: "bg-amber-100 text-amber-700", live: true },
  scanning: { label: "Scanning LinkedIn…", chip: "bg-amber-100 text-amber-700", live: true },
  ranking: { label: "Ranking…", chip: "bg-sky-100 text-sky-700", live: true },
  researching: { label: "Deep research…", chip: "bg-violet-100 text-violet-700", live: true },
  done: { label: "Done", chip: "bg-emerald-100 text-emerald-800", live: false },
  error: { label: "Error", chip: "bg-rose-100 text-rose-700", live: false },
};

// Cohort-percentile → bar colour for the per-signal bars on the candidate page.
export function relColor(percentile: number): string {
  if (percentile >= 0.66) return "bg-emerald-500";
  if (percentile >= 0.33) return "bg-amber-400";
  return "bg-rose-400";
}

// Verdict derived from the overall fit score, for the 60-second scorecard.
export function verdictFor(
  score: number | null,
): { label: string; chip: string; bar: string } {
  if (score == null) return { label: "Unscored", chip: "bg-zinc-100 text-zinc-500", bar: "bg-zinc-300" };
  if (score >= 75) return { label: "Strong fit", chip: "bg-emerald-100 text-emerald-800", bar: "bg-emerald-500" };
  if (score >= 55) return { label: "Promising", chip: "bg-amber-100 text-amber-800", bar: "bg-amber-500" };
  return { label: "Weak fit", chip: "bg-rose-100 text-rose-700", bar: "bg-rose-400" };
}
