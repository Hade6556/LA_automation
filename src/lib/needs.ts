import { supabaseAdmin } from "@/lib/supabase/server";
import { ACTIVE_NEED_STATUSES, type Need, type SearchFilters } from "@/lib/types";

// A live status whose pipeline hasn't heartbeat recently = the process died
// (heartbeats every 30s; spawn lag is covered by the created_at fallback).
export function needIsStale(
  n: Pick<Need, "status" | "heartbeat_at" | "started_at" | "created_at">,
  maxAgeMs = 2 * 60 * 1000,
): boolean {
  if (!ACTIVE_NEED_STATUSES.includes(n.status)) return false;
  const last = n.heartbeat_at ?? n.started_at ?? n.created_at;
  return Date.now() - new Date(last).getTime() > maxAgeMs;
}

// Human-readable one-line rendering of a filter set — mirrors OpenOutreach's
// SearchFilter.to_label so the two surfaces describe needs identically.
export function labelForFilters(f: SearchFilters): string {
  const bits: string[] = [];
  if (f.title?.trim()) bits.push(f.title.trim());
  if (f.industries?.length) bits.push("in " + f.industries.join("/"));
  if (f.locations?.length) bits.push("@ " + f.locations.join("/"));
  if (f.current_companies?.length) bits.push("at " + f.current_companies.join("/"));
  if (f.keywords?.trim()) bits.push(`(${f.keywords.trim()})`);
  if (f.network?.length) bits.push("[" + f.network.join(",") + "]");
  return bits.join(" ") || "(empty filter)";
}

// Live pipeline progress for one campaign, computed from its candidates.
export interface CampaignCounts {
  found: number;
  ranked: number;
  researched: number;
  researching: number;
}

const EMPTY_COUNTS: CampaignCounts = { found: 0, ranked: 0, researched: 0, researching: 0 };
const COUNT_COLS = "need_id, rank_score, researched_at, researching";

type CountRow = {
  need_id: string;
  rank_score: number | null;
  researched_at: string | null;
  researching: boolean;
};

function tally(rows: CountRow[]): Record<string, CampaignCounts> {
  const byNeed: Record<string, CampaignCounts> = {};
  for (const r of rows) {
    const c = (byNeed[r.need_id] ??= { ...EMPTY_COUNTS });
    c.found++;
    if (r.rank_score != null) c.ranked++;
    if (r.researched_at != null) c.researched++;
    if (r.researching) c.researching++;
  }
  return byNeed;
}

// Needs (campaigns) newest-first, each with live progress counts.
export async function getNeeds(): Promise<(Need & { counts: CampaignCounts })[]> {
  const db = supabaseAdmin();
  const [{ data: needs, error }, { data: rows, error: cErr }] = await Promise.all([
    db.from("needs").select("*").order("created_at", { ascending: false }),
    db.from("candidates").select(COUNT_COLS).not("need_id", "is", null),
  ]);
  if (error) throw new Error(`getNeeds failed: ${error.message}`);
  if (cErr) throw new Error(`getNeeds counts failed: ${cErr.message}`);

  const byNeed = tally((rows ?? []) as CountRow[]);
  return ((needs ?? []) as Need[]).map((n) => ({
    ...n,
    counts: byNeed[n.id] ?? EMPTY_COUNTS,
  }));
}

export async function getNeed(
  id: string,
): Promise<(Need & { counts: CampaignCounts }) | null> {
  const db = supabaseAdmin();
  const [{ data: need, error }, { data: rows, error: cErr }] = await Promise.all([
    db.from("needs").select("*").eq("id", id).maybeSingle(),
    db.from("candidates").select(COUNT_COLS).eq("need_id", id),
  ]);
  if (error) throw new Error(`getNeed failed: ${error.message}`);
  if (cErr) throw new Error(`getNeed counts failed: ${cErr.message}`);
  if (!need) return null;

  const byNeed = tally((rows ?? []) as CountRow[]);
  return { ...(need as Need), counts: byNeed[id] ?? EMPTY_COUNTS };
}

// A campaign is a need born 'queued' — the spawned pipeline takes it from there.
export async function createCampaign(
  needText: string,
  filters: SearchFilters,
): Promise<Need> {
  const { data, error } = await supabaseAdmin()
    .from("needs")
    .insert({
      need_text: needText,
      label: labelForFilters(filters),
      filters,
      status: "queued",
    })
    .select("*")
    .single();
  if (error) throw new Error(`createCampaign failed: ${error.message}`);
  return data as Need;
}

export async function retryNeed(id: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("needs")
    .update({ status: "queued", error: null, heartbeat_at: null })
    .eq("id", id);
  if (error) throw new Error(`retryNeed failed: ${error.message}`);
}

// Clear a need's findings and reset it to 'new':
//  - delete candidates it discovered that are still untouched
//    (status 'sourced'/'ranked', swipe still 'pending')
//  - detach (keep) any candidate that has progressed in the pipeline
export async function clearNeed(id: string): Promise<{ deleted: number; kept: number }> {
  const db = supabaseAdmin();

  const { data: deleted, error: dErr } = await db
    .from("candidates")
    .delete()
    .eq("need_id", id)
    .in("status", ["sourced", "ranked"])
    .eq("swipe_decision", "pending")
    .select("id");
  if (dErr) throw new Error(`clearNeed delete failed: ${dErr.message}`);

  const { data: kept, error: kErr } = await db
    .from("candidates")
    .update({ need_id: null })
    .eq("need_id", id)
    .select("id");
  if (kErr) throw new Error(`clearNeed detach failed: ${kErr.message}`);

  const { error: rErr } = await db
    .from("needs")
    .update({ status: "new", error: null, found_count: 0, scanned_at: null })
    .eq("id", id);
  if (rErr) throw new Error(`clearNeed reset failed: ${rErr.message}`);

  return { deleted: deleted?.length ?? 0, kept: kept?.length ?? 0 };
}

export async function deleteNeed(id: string): Promise<void> {
  // candidates.need_id is ON DELETE SET NULL — findings survive, detached.
  const { error } = await supabaseAdmin().from("needs").delete().eq("id", id);
  if (error) throw new Error(`deleteNeed failed: ${error.message}`);
}
