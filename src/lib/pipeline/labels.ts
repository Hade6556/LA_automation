import type { Candidate, CandidateStatus, Label } from "@/lib/types";

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

// Verdict derived from the overall fit score, for the 60-second scorecard.
export function verdictFor(
  score: number | null,
): { label: string; chip: string; bar: string } {
  if (score == null) return { label: "Unscored", chip: "bg-zinc-100 text-zinc-500", bar: "bg-zinc-300" };
  if (score >= 75) return { label: "Strong fit", chip: "bg-emerald-100 text-emerald-800", bar: "bg-emerald-500" };
  if (score >= 55) return { label: "Promising", chip: "bg-amber-100 text-amber-800", bar: "bg-amber-500" };
  return { label: "Weak fit", chip: "bg-rose-100 text-rose-700", bar: "bg-rose-400" };
}
