import { RANK_SIGNALS } from "@/lib/types";

// Cohort-relative standing: where a candidate sits vs the other researched
// candidates on each rubric signal. Makes "is this person good?" instant —
// #1 is obviously strong, last is obviously weak — instead of raw 0-100 numbers.

export type Tier = "Top" | "Above avg" | "Below avg" | "Bottom";

export type SignalStanding = {
  key: string;
  label: string;
  score: number; // candidate's own absolute score (kept for the detail view)
  rank: number; // 1 = best in cohort
  of: number; // cohort size scored on this signal
  percentile: number; // (N-rank)/(N-1): 1 = best, 0 = worst
  tier: Tier;
};

type Breakdown = Record<string, { score: number; note?: string } | null> | null;
export type CohortRow = { id: string; rank_breakdown: Breakdown };

function tierFor(p: number): Tier {
  if (p >= 0.75) return "Top";
  if (p >= 0.5) return "Above avg";
  if (p >= 0.25) return "Below avg";
  return "Bottom";
}

export function computeStanding(
  cohort: CohortRow[],
  candidateId: string,
): SignalStanding[] | null {
  const rows = cohort.filter((c) => c.rank_breakdown);
  if (rows.length < 2) return null; // need peers to be "relative"
  const me = rows.find((c) => c.id === candidateId);
  if (!me?.rank_breakdown) return null;

  return RANK_SIGNALS.map(([key, label]) => {
    const scored = rows
      .map((c) => ({ id: c.id, score: Number(c.rank_breakdown?.[key]?.score ?? NaN) }))
      .filter((x) => Number.isFinite(x.score))
      .sort((a, b) => b.score - a.score);
    const of = scored.length;
    const myScore = Number(me.rank_breakdown?.[key]?.score ?? NaN);
    let rank = scored.findIndex((x) => x.id === candidateId) + 1;
    if (rank === 0) rank = of || 1; // not scored on this signal → treat as worst
    const percentile = of > 1 ? (of - rank) / (of - 1) : 1;
    return { key, label, score: myScore, rank, of, percentile, tier: tierFor(percentile) };
  });
}

export function standoutsAndLags(standing: SignalStanding[]): {
  standouts: SignalStanding[];
  lags: SignalStanding[];
} {
  const bestFirst = [...standing].sort((a, b) => a.rank - b.rank);
  const worstFirst = [...standing].sort((a, b) => b.rank - a.rank);
  return {
    standouts: bestFirst.filter((s) => s.percentile >= 0.5).slice(0, 3),
    lags: worstFirst.filter((s) => s.percentile < 0.5).slice(0, 2),
  };
}
