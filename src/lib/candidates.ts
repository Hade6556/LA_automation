import { supabaseAdmin } from "@/lib/supabase/server";
import type { Candidate } from "@/lib/types";

// Fetch candidates, optionally filtered by status. Ranked highest first,
// unranked/oldest last.
export async function getCandidates(status?: string): Promise<Candidate[]> {
  let q = supabaseAdmin()
    .from("candidates")
    .select("*")
    .order("rank_score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (status && status !== "all") q = q.eq("status", status);

  const { data, error } = await q;
  if (error) throw new Error(`getCandidates failed: ${error.message}`);
  return (data ?? []) as Candidate[];
}

export async function getCandidate(id: string): Promise<Candidate | null> {
  const { data, error } = await supabaseAdmin()
    .from("candidates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getCandidate failed: ${error.message}`);
  return (data as Candidate) ?? null;
}

// Lightweight cohort fetch for relative ranking — only researched candidates.
export async function getResearchedCohort(): Promise<
  { id: string; rank_breakdown: Candidate["rank_breakdown"] }[]
> {
  const { data, error } = await supabaseAdmin()
    .from("candidates")
    .select("id, rank_breakdown")
    .not("researched_at", "is", null);
  if (error) throw new Error(`getResearchedCohort failed: ${error.message}`);
  return (data ?? []) as { id: string; rank_breakdown: Candidate["rank_breakdown"] }[];
}

export async function getStatusCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabaseAdmin()
    .from("candidates")
    .select("status");
  if (error) throw new Error(`getStatusCounts failed: ${error.message}`);

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const s = (row as { status: string }).status;
    counts[s] = (counts[s] ?? 0) + 1;
  }
  return counts;
}
