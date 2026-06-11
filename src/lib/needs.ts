import { supabaseAdmin } from "@/lib/supabase/server";
import type { Need, SearchFilters } from "@/lib/types";

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

// Needs newest-first, each with a live count of candidates it discovered.
export async function getNeeds(): Promise<(Need & { live_found: number })[]> {
  const db = supabaseAdmin();
  const [{ data: needs, error }, { data: counts, error: cErr }] = await Promise.all([
    db.from("needs").select("*").order("created_at", { ascending: false }),
    db.from("candidates").select("need_id").not("need_id", "is", null),
  ]);
  if (error) throw new Error(`getNeeds failed: ${error.message}`);
  if (cErr) throw new Error(`getNeeds counts failed: ${cErr.message}`);

  const byNeed: Record<string, number> = {};
  for (const row of counts ?? []) {
    const id = (row as { need_id: string }).need_id;
    byNeed[id] = (byNeed[id] ?? 0) + 1;
  }
  return ((needs ?? []) as Need[]).map((n) => ({
    ...n,
    live_found: byNeed[n.id] ?? 0,
  }));
}

export async function createNeed(
  needText: string,
  filters: SearchFilters,
): Promise<Need> {
  const { data, error } = await supabaseAdmin()
    .from("needs")
    .insert({ need_text: needText, label: labelForFilters(filters), filters })
    .select("*")
    .single();
  if (error) throw new Error(`createNeed failed: ${error.message}`);
  return data as Need;
}

export async function queueNeed(id: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("needs")
    .update({ status: "queued", error: null })
    .eq("id", id)
    .in("status", ["new", "done", "error"]); // no-op while queued/scanning
  if (error) throw new Error(`queueNeed failed: ${error.message}`);
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
