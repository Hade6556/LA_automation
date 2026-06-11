-- lost-astronaut · campaign pipeline: needs become campaigns driven end-to-end
-- by the app. The campaign-pipeline orchestrator advances a need through
-- scanning → ranking → researching → done and heartbeats while alive so the
-- UI can detect a stalled pipeline.
-- Applied to project yjgsjajjucnpawivwlst on 2026-06-11.

alter type need_status add value if not exists 'ranking';
alter type need_status add value if not exists 'researching';

alter table needs add column started_at timestamptz;   -- pipeline kickoff
alter table needs add column heartbeat_at timestamptz; -- orchestrator liveness
