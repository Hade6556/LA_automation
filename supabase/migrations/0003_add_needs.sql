-- lost-astronaut · needs: sourcing intents driven from the /needs page.
-- A need is "what I want" in plain text, converted to structured LinkedIn
-- search filters by Claude. The local needs-worker executes 'queued' needs
-- via OpenOutreach's faceted search and upserts findings into candidates.
-- Applied to project yjgsjajjucnpawivwlst on 2026-06-11.

create type need_status as enum ('new', 'queued', 'scanning', 'done', 'error');

create table needs (
  id uuid primary key default gen_random_uuid(),
  need_text text not null,                        -- what the operator typed
  label text not null,                            -- human-readable filter rendering
  filters jsonb not null,                         -- SearchFilter dict (title/industries/locations/…)
  status need_status not null default 'new',
  error text,                                     -- last worker error, if status = 'error'
  found_count integer not null default 0,         -- candidates upserted by the last scan
  scanned_at timestamptz,                         -- last successful scan
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger needs_updated_at
  before update on needs
  for each row execute function set_updated_at();

-- Provenance: which need discovered each candidate (null = manual/legacy ingest).
alter table candidates
  add column need_id uuid references needs(id) on delete set null;

create index candidates_need_id_idx on candidates (need_id);
create index needs_status_idx on needs (status);

alter table needs enable row level security;  -- service-role access only, like candidates
