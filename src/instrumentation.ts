// Runs once when the Next server boots. On the cockpit machine this brings up
// the queue dispatcher (scripts/worker.mjs) so campaigns/research launched
// from ANY host — including the deployed Vercel app — get executed here.
// The worker's pid lock makes repeat boots (dev restarts) harmless.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { pipelineHostAvailable, spawnWorker } = await import("@/lib/pipeline/spawn");
  if (pipelineHostAvailable()) spawnWorker();
}
