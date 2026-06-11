// Domain types — mirror the Supabase schema (0001_create_candidates_and_rubrics.sql).

export const CANDIDATE_STATUSES = [
  "sourced",
  "ranked",
  "in_review",
  "approved",
  "invited",
  "accepted",
  "in_chat",
  "meeting_booked",
  "met",
  "labeled",
  "holding",
] as const;
export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

export type SwipeDecision = "pending" | "approved" | "skipped";
export type Label = "green" | "yellow" | "red";
export type ReentryReason = "passed" | "not_accepted" | "warm_goodbye";
export type FitTrack = "recruit" | "co_found" | "build_for" | "none";
export type RubricKind = "ranking" | "chat_outcomes" | "label";
export type BusinessModel = "venture_builder" | "hacker_house";
export type RubricSource = "seed" | "manual" | "feedback_suggestion";

// High-signal profile facts surfaced as chips (cockpit + dossier scorecard).
export const HIGHLIGHT_CATEGORIES = [
  "education",
  "exit",
  "scale",
  "pedigree",
  "recognition",
  "social",
] as const;
export type HighlightCategory = (typeof HIGHLIGHT_CATEGORIES)[number];

export interface Highlight {
  label: string; // short chip text, e.g. "Harvard MBA", "Exit to Datadog"
  category: HighlightCategory;
  tier: 1 | 2; // 1 = top-1% signal, 2 = strong
  evidence?: string; // one-line source fact (shown as tooltip)
}

export interface Candidate {
  id: string;
  linkedin_url: string;
  need_id: string | null; // which need discovered this candidate (0003_add_needs)
  full_name: string | null;
  headline: string | null;
  current_company: string | null;
  current_title: string | null;
  company_domain: string | null;
  background: Record<string, unknown>;
  social: Record<string, unknown>;
  current_focus: string | null;
  signals: Record<string, unknown>;
  rank_score: number | null;
  rank_reason: string | null;
  status: CandidateStatus;
  swipe_decision: SwipeDecision;
  skip_reason: string | null;
  chat_transcript: unknown[];
  meeting_notes: Record<string, unknown> | null;
  computed_label: Label | null;
  label_reason: string | null;
  ilona_verdict: Label | null;
  verdict_reason: string | null;
  fit_track: FitTrack | null;
  reentry_reason: ReentryReason | null;
  next_review_at: string | null;
  source: string | null;
  suppressed: boolean;
  provenance: Record<string, unknown>;
  // Tier-2 deep research (research-rank.mjs)
  dossier: {
    one_liner?: string | null;
    bottom_line?: string | null;
    top_strengths?: string[];
    watch_outs?: string[];
    summary?: string;
    key_achievements?: string[];
    education_summary?: string | null;
    current_focus?: string | null;
  } | null;
  rank_breakdown: Record<string, { score: number; note: string } | null> | null;
  highlights: Highlight[] | null;
  sources: { title?: string; url: string }[] | null;
  comparison_note: string | null;
  researched_at: string | null;
  researching: boolean;
  created_at: string;
  updated_at: string;
}

// Ordered rubric signals for the per-candidate breakdown bars.
export const RANK_SIGNALS: ReadonlyArray<readonly [string, string]> = [
  ["seniority", "Seniority"],
  ["builder_track_record", "Builder track record"],
  ["domain_fit", "Domain fit"],
  ["availability", "Availability"],
  ["pedigree", "Pedigree"],
  ["social_presence", "Social presence"],
];

// ===== Needs (0003_add_needs, 0004_campaign_pipeline) =====
// A need is a campaign in the UI: one "I'm looking for…" plus everyone it found.

export const NEED_STATUSES = [
  "new",
  "queued",
  "scanning",
  "ranking",
  "researching",
  "done",
  "error",
] as const;
export type NeedStatus = (typeof NEED_STATUSES)[number];

// Statuses where the pipeline is (supposed to be) actively working.
export const ACTIVE_NEED_STATUSES: NeedStatus[] = ["queued", "scanning", "ranking", "researching"];

// Structured LinkedIn search filters — mirrors OpenOutreach's SearchFilter
// (linkedin/pipeline/search_filters.py); consumed by `manage.py search_scan`.
export interface SearchFilters {
  title: string; // bare job title → LinkedIn's current-job-title filter
  industries: string[];
  locations: string[]; // empty = worldwide
  current_companies: string[];
  keywords: string; // residual freetext only
  network: ("F" | "S" | "O")[];
}

export interface Need {
  id: string;
  need_text: string;
  label: string;
  filters: SearchFilters;
  status: NeedStatus;
  error: string | null;
  found_count: number;
  scanned_at: string | null;
  started_at: string | null;
  heartbeat_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Rubric {
  id: string;
  kind: RubricKind;
  version: number;
  business_model: BusinessModel | null;
  content: Record<string, unknown>;
  is_active: boolean;
  source: RubricSource;
  notes: string | null;
  created_at: string;
}
