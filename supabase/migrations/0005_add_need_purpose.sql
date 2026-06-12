-- lost-astronaut · campaign purpose: what the operator will DO with the list
-- (recruit / invite / sell to / advise…). Extracted by Claude from the need
-- sentence, editable in the campaign review step, and injected into the
-- ranking + research prompts so fit is scored FOR the campaign, not generically.
-- Applied to project yjgsjajjucnpawivwlst on 2026-06-12.

alter table needs add column purpose text not null default '';

comment on column needs.purpose is
  'What the user will do with the candidate list (e.g. "invite to join Lost Astronaut as CEO"). Empty = unstated.';
