import Link from "next/link";
import { notFound } from "next/navigation";
import { swipeCandidateFormAction } from "@/app/campaigns/actions";
import AppHeader from "@/components/AppHeader";
import { getCandidatesByNeed } from "@/lib/candidates";
import { getNeed } from "@/lib/needs";
import { initials, photoUrl } from "@/lib/people";
import type { Candidate } from "@/lib/types";

// The outcome board for one campaign's swiping session: YES column (approved)
// and NO column (skipped), with buttons to move someone across or back into
// the deck — fat-finger insurance.

function Cell({ c, needId, column }: { c: Candidate; needId: string; column: "yes" | "no" }) {
  const photo = photoUrl(c.social);
  const flip = column === "yes" ? "skipped" : "approved";
  return (
    <div className="card flex items-center gap-2.5 p-2.5">
      <Link href={`/candidates/${c.id}`} className="shrink-0" title="Open dossier">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt=""
            referrerPolicy="no-referrer"
            className="h-9 w-9 rounded-full bg-surface-2 object-cover ring-1 ring-border-soft"
          />
        ) : (
          <div className="grid h-9 w-9 place-items-center rounded-full bg-surface-2 text-xs font-medium text-muted ring-1 ring-border-soft">
            {initials(c.full_name)}
          </div>
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          href={`/candidates/${c.id}`}
          className="block truncate text-xs font-medium text-ink hover:underline"
        >
          {c.full_name ?? "—"}
        </Link>
        <p className="truncate text-[11px] text-faint" title={c.headline ?? undefined}>
          {c.headline ?? c.current_title ?? ""}
        </p>
      </div>
      <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-muted">
        {c.rank_score ?? "—"}
      </span>
      <div className="flex shrink-0 flex-col gap-1">
        <form action={swipeCandidateFormAction}>
          <input type="hidden" name="id" value={c.id} />
          <input type="hidden" name="need_id" value={needId} />
          <input type="hidden" name="decision" value={flip} />
          <button
            type="submit"
            title={column === "yes" ? "Move to NO" : "Move to YES"}
            className="grid h-6 w-6 place-items-center rounded border border-border-soft text-[11px] text-muted hover:border-border hover:text-ink"
          >
            {column === "yes" ? "→" : "←"}
          </button>
        </form>
        <form action={swipeCandidateFormAction}>
          <input type="hidden" name="id" value={c.id} />
          <input type="hidden" name="need_id" value={needId} />
          <input type="hidden" name="decision" value="pending" />
          <button
            type="submit"
            title="Put back into the swipe deck"
            className="grid h-6 w-6 place-items-center rounded border border-border-soft text-[11px] text-muted hover:border-border hover:text-ink"
          >
            ↩
          </button>
        </form>
      </div>
    </div>
  );
}

export default async function ReviewBoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const need = await getNeed(id);
  if (!need) notFound();

  const all = await getCandidatesByNeed(id);
  const yes = all.filter((c) => c.swipe_decision === "approved");
  const no = all.filter((c) => c.swipe_decision === "skipped");
  const pending = all.filter(
    (c) => c.rank_score != null && (c.swipe_decision ?? "pending") === "pending",
  ).length;

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader active="swipe" back={{ href: `/campaigns/${id}`, label: need.need_text }} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl text-ink">Swipe results</h1>
            <p className="mt-1 font-mono text-xs text-faint" title={need.need_text}>
              {need.need_text}
            </p>
          </div>
          <Link href={`/campaigns/${id}/swipe`} className="btn btn-primary shrink-0 text-xs">
            {pending > 0 ? `Swipe ${pending} left` : "Open deck"}
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <section>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-300">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
              YES ({yes.length})
            </h2>
            <div className="space-y-2">
              {yes.length ? (
                yes.map((c) => <Cell key={c.id} c={c} needId={id} column="yes" />)
              ) : (
                <p className="card p-4 text-center text-xs text-faint">No one approved yet.</p>
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-rose-300">
              <span className="inline-block h-2 w-2 rounded-full bg-rose-400" />
              NO ({no.length})
            </h2>
            <div className="space-y-2">
              {no.length ? (
                no.map((c) => <Cell key={c.id} c={c} needId={id} column="no" />)
              ) : (
                <p className="card p-4 text-center text-xs text-faint">No one skipped yet.</p>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
