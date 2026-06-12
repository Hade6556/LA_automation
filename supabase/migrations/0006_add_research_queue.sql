-- Research-request queue marker: set by the app (any host — including the
-- deployed Vercel app, which can't spawn the pipeline itself); claimed and
-- cleared by the cockpit worker (scripts/worker.mjs), which spawns
-- research-rank.mjs for the batch. Campaigns need no equivalent column:
-- needs.status = 'queued' already is the campaign queue.
alter table candidates
  add column if not exists research_requested_at timestamptz;

create index if not exists candidates_research_requested_idx
  on candidates (research_requested_at)
  where research_requested_at is not null;
