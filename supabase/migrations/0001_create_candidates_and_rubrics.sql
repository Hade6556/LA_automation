-- lost-astronaut · core schema: candidates + versioned rubrics
-- Applied to project yjgsjajjucnpawivwlst on 2026-06-11.

-- ===== Enums =====
create type candidate_status as enum (
  'sourced','ranked','in_review','approved','invited','accepted',
  'in_chat','meeting_booked','met','labeled','holding'
);
create type swipe_decision as enum ('pending','approved','skipped');
create type label as enum ('green','yellow','red');
create type reentry_reason as enum ('passed','not_accepted','warm_goodbye');
create type fit_track as enum ('recruit','co_found','build_for','none');
create type rubric_kind as enum ('ranking','chat_outcomes','label');
create type business_model as enum ('venture_builder','hacker_house');
create type rubric_source as enum ('seed','manual','feedback_suggestion');

-- ===== updated_at helper (hardened search_path) =====
create or replace function set_updated_at()
returns trigger language plpgsql
set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ===== candidates: one row per person, keyed on LinkedIn URL =====
create table candidates (
  id uuid primary key default gen_random_uuid(),
  linkedin_url text not null unique,            -- unique identity (never name/email)
  full_name text,
  headline text,
  current_company text,
  current_title text,
  company_domain text,
  background jsonb not null default '{}'::jsonb,  -- ex-jobs/employers, ex-universities, ex-ventures, notable
  social jsonb not null default '{}'::jsonb,      -- handles + follower counts, online footprint
  current_focus text,                             -- what they're working on now
  signals jsonb not null default '{}'::jsonb,      -- availability/openness cues, recent moves
  rank_score numeric,
  rank_reason text,
  status candidate_status not null default 'sourced',
  swipe_decision swipe_decision not null default 'pending',
  skip_reason text,
  chat_transcript jsonb not null default '[]'::jsonb,
  meeting_notes jsonb,                            -- from Granola (stubbed)
  computed_label label,                           -- post-meeting only
  label_reason text,
  ilona_verdict label,                            -- OVERRIDES computed_label
  verdict_reason text,
  fit_track fit_track,                            -- recruit | co_found | build_for | none (set at verdict)
  reentry_reason reentry_reason,                  -- holding-pool re-entry semantics
  next_review_at timestamptz,                     -- when a holding candidate resurfaces
  source text,
  suppressed boolean not null default false,      -- never contact twice / after a reject
  provenance jsonb not null default '{}'::jsonb,   -- per-field confidence where enriched
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index candidates_status_idx on candidates (status);
create index candidates_next_review_at_idx on candidates (next_review_at);
create trigger candidates_set_updated_at before update on candidates
  for each row execute function set_updated_at();

-- ===== rubrics: versioned, editable config (ranking / chat / label) =====
create table rubrics (
  id uuid primary key default gen_random_uuid(),
  kind rubric_kind not null,
  version int not null,
  business_model business_model,                 -- venture_builder | hacker_house (nullable)
  content jsonb not null,
  is_active boolean not null default false,
  source rubric_source not null default 'seed',   -- seed | manual | feedback_suggestion
  notes text,
  created_at timestamptz not null default now(),
  unique (kind, version)
);
-- at most one active rubric per kind
create unique index rubrics_one_active_per_kind on rubrics (kind) where is_active;

-- ===== RLS: enabled, no public policies. All app DB access is server-side via
-- the service-role key (bypasses RLS) behind the password gate. =====
alter table candidates enable row level security;
alter table rubrics enable row level security;
