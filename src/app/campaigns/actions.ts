"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { parseNeed } from "@/lib/need-filters";
import { markResearching } from "@/lib/candidates";
import { createCampaign, deleteNeed, retryNeed } from "@/lib/needs";
import { spawnCampaignPipeline, spawnResearch } from "@/lib/pipeline/spawn";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { SearchFilters, SwipeDecision } from "@/lib/types";

// Per the Next.js data-security guidance: verify auth inside every Server
// Action — the proxy gate alone doesn't cover direct action invocation.
async function requireAuth(): Promise<void> {
  const store = await cookies();
  if (!verifySessionToken(store.get(SESSION_COOKIE)?.value)) {
    redirect("/login");
  }
}

const clip = (s: unknown) => String(s ?? "").trim().slice(0, 200);
const clipPurpose = (s: unknown) => String(s ?? "").trim().slice(0, 500);
const clipList = (xs: unknown) =>
  (Array.isArray(xs) ? xs : []).map(clip).filter(Boolean).slice(0, 10);

// The filters round-trip through the client filter editor — re-sanitize before
// they reach the DB and, later, the OpenOutreach CLI.
function sanitizeFilters(f: SearchFilters): SearchFilters {
  const NETWORK = ["F", "S", "O"] as const;
  return {
    title: clip(f.title),
    industries: clipList(f.industries),
    locations: clipList(f.locations),
    current_companies: clipList(f.current_companies),
    keywords: clip(f.keywords),
    network: (Array.isArray(f.network) ? f.network : []).filter(
      (n): n is (typeof NETWORK)[number] => (NETWORK as readonly string[]).includes(n),
    ),
  };
}

export type SuggestFiltersResult =
  | { ok: true; filters: SearchFilters; purpose: string }
  | { ok: false; error: string };

export async function suggestFiltersAction(needText: string): Promise<SuggestFiltersResult> {
  await requireAuth();
  const text = String(needText ?? "").trim();
  if (!text) return { ok: false, error: "Type what you're looking for first." };
  try {
    const { filters, purpose } = await parseNeed(text);
    return { ok: true, filters: sanitizeFilters(filters), purpose: clipPurpose(purpose) };
  } catch (e) {
    console.error("parseNeed failed:", e);
    return { ok: false, error: "Couldn't turn that into filters — try rephrasing." };
  }
}

export async function createCampaignAction(
  needText: string,
  filters: SearchFilters,
  purpose: string,
): Promise<{ ok: false; error: string } | never> {
  await requireAuth();
  const text = String(needText ?? "").trim();
  const clean = sanitizeFilters(filters);
  const hasAnyFilter =
    clean.title || clean.keywords || clean.industries.length ||
    clean.locations.length || clean.current_companies.length;
  if (!text || !hasAnyFilter) {
    return { ok: false, error: "Campaign needs at least one filter." };
  }

  const need = await createCampaign(text, clean, clipPurpose(purpose));
  spawnCampaignPipeline(need.id);
  revalidatePath("/");
  redirect(`/campaigns/${need.id}`);
}

export async function researchCandidateAction(formData: FormData): Promise<void> {
  await requireAuth();
  const id = String(formData.get("id") ?? "");
  const needId = String(formData.get("need_id") ?? "");
  if (!id) return;
  await markResearching(id); // instant "researching…" pulse on the card
  spawnResearch([id], { force: true });
  if (needId) revalidatePath(`/campaigns/${needId}`);
}

const SWIPE_DECISIONS: SwipeDecision[] = ["pending", "approved", "skipped"];

// Ilona's screening swipe: right = approved, left = skipped, "pending" = undo /
// re-deck. Called directly from the SwipeDeck client component and from the
// review-board move buttons (via form wrapper below).
export async function swipeCandidateAction(
  candidateId: string,
  decision: SwipeDecision,
  needId: string | null,
): Promise<void> {
  await requireAuth();
  const id = String(candidateId ?? "");
  if (!id || !SWIPE_DECISIONS.includes(decision)) return;
  const { error } = await supabaseAdmin()
    .from("candidates")
    .update({ swipe_decision: decision })
    .eq("id", id);
  if (error) throw new Error(`swipe failed: ${error.message}`);
  revalidatePath("/swipe");
  if (needId) {
    revalidatePath(`/campaigns/${needId}`);
    revalidatePath(`/campaigns/${needId}/swipe`);
    revalidatePath(`/campaigns/${needId}/review`);
  }
}

// Form-action wrapper for the review board's move/re-deck buttons.
export async function swipeCandidateFormAction(formData: FormData): Promise<void> {
  const decision = String(formData.get("decision") ?? "") as SwipeDecision;
  await swipeCandidateAction(
    String(formData.get("id") ?? ""),
    decision,
    String(formData.get("need_id") ?? "") || null,
  );
}

export async function retryCampaignAction(formData: FormData): Promise<void> {
  await requireAuth();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  // Safe to re-run end-to-end: scan upserts ignore duplicates, ranking only
  // touches still-'sourced' people, research skips anyone already researched.
  await retryNeed(id);
  spawnCampaignPipeline(id);
  revalidatePath(`/campaigns/${id}`);
}

export async function deleteCampaignAction(formData: FormData): Promise<void> {
  await requireAuth();
  const id = String(formData.get("id") ?? "");
  if (id) await deleteNeed(id); // candidates survive, detached (FK SET NULL)
  revalidatePath("/");
}
