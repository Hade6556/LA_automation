-- lost-astronaut · per-candidate high-signal highlights (chips in cockpit + dossier)
-- Applied to project yjgsjajjucnpawivwlst on 2026-06-11.

alter table candidates
  add column highlights jsonb not null default '[]'::jsonb;

comment on column candidates.highlights is
  'Array of {label, category: education|exit|scale|pedigree|recognition|social, tier: 1|2, evidence?}. LLM-extracted (research-rank / backfill-highlights); empty = UI falls back to the rules extractor at render time.';
