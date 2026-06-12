"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { swipeCandidateAction } from "@/app/campaigns/actions";

// Tinder-style screening deck. Pure pointer-events + CSS transforms — no
// animation lib. Commits are optimistic: the deck advances immediately and the
// server action fires in a transition; "pending" re-decks on undo.

export type SwipeCard = {
  id: string;
  name: string;
  photo: string | null;
  initials: string;
  headline: string | null;
  summary: string | null;
  score: number | null;
  verdictLabel: string;
  verdictChip: string;
  highlights: { label: string; tier: number }[];
  facts: string[]; // scraped extras: positions, education, followers, availability
  linkedinUrl: string;
};

const COMMIT_RATIO = 0.32; // fraction of container width to commit a swipe
const FLICK_VX = 0.6; // px/ms — fast flicks commit regardless of distance

export default function SwipeDeck({
  cards,
  needId,
  reviewHref,
  backHref,
}: {
  cards: SwipeCard[];
  needId: string;
  reviewHref: string;
  backHref: string;
}) {
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<{ id: string; decision: "approved" | "skipped" }[]>([]);
  // drag state lives in refs (no re-render per move); committed to style directly
  const cardRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startX: number; startY: number; x: number; t: number; lastX: number; lastT: number; active: boolean }>({
    startX: 0, startY: 0, x: 0, t: 0, lastX: 0, lastT: 0, active: false,
  });
  const [leaving, setLeaving] = useState<{ id: string; dir: 1 | -1 } | null>(null);
  const [, startTransition] = useTransition();

  const current = cards[index];
  const done = index >= cards.length;

  const setCardStyle = (x: number, withTransition: boolean) => {
    const el = cardRef.current;
    if (!el) return;
    el.style.transition = withTransition ? "transform 0.25s ease, opacity 0.25s ease" : "none";
    el.style.transform = `translateX(${x}px) rotate(${x / 18}deg)`;
    const stamp = el.querySelector<HTMLElement>("[data-stamp]");
    if (stamp) {
      const w = frameRef.current?.clientWidth ?? 360;
      const p = Math.min(Math.abs(x) / (w * COMMIT_RATIO), 1);
      stamp.style.opacity = String(p);
      stamp.dataset.dir = x >= 0 ? "yes" : "no";
    }
  };

  const commit = useCallback(
    (dir: 1 | -1) => {
      if (!current || leaving) return;
      const decision = dir === 1 ? ("approved" as const) : ("skipped" as const);
      setLeaving({ id: current.id, dir });
      setHistory((h) => [...h, { id: current.id, decision }]);
      startTransition(() => swipeCandidateAction(current.id, decision, needId));
      // let the fly-off animation play, then advance the deck
      window.setTimeout(() => {
        setLeaving(null);
        setIndex((i) => i + 1);
      }, 260);
    },
    [current, leaving, needId],
  );

  const undo = useCallback(() => {
    const last = history[history.length - 1];
    if (!last || leaving) return;
    setHistory((h) => h.slice(0, -1));
    setIndex((i) => Math.max(0, i - 1));
    startTransition(() => swipeCandidateAction(last.id, "pending", needId));
  }, [history, leaving, needId]);

  // keyboard: ← no, → yes, u undo (desktop convenience)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") commit(1);
      else if (e.key === "ArrowLeft") commit(-1);
      else if (e.key.toLowerCase() === "u") undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commit, undo]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (leaving) return;
    drag.current = {
      startX: e.clientX, startY: e.clientY, x: 0,
      t: performance.now(), lastX: e.clientX, lastT: performance.now(), active: true,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.active) return;
    d.lastX = e.clientX;
    d.lastT = performance.now();
    d.x = e.clientX - d.startX;
    setCardStyle(d.x, false);
  };
  const onPointerUp = () => {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    const w = frameRef.current?.clientWidth ?? 360;
    const dt = Math.max(performance.now() - d.lastT + 1, 1);
    const vx = (d.lastX - d.startX) / Math.max(performance.now() - d.t, 1);
    const fast = Math.abs(vx) > FLICK_VX && dt < 120;
    if (Math.abs(d.x) > w * COMMIT_RATIO || fast) {
      commit(d.x >= 0 ? 1 : -1);
    } else {
      setCardStyle(0, true); // spring back
    }
  };

  if (done) {
    return (
      <div className="card mx-auto flex w-full max-w-sm flex-col items-center gap-4 p-10 text-center">
        <span className="text-4xl">🛰</span>
        <p className="font-display text-2xl text-ink">All caught up</p>
        <p className="text-sm text-muted">
          Every ranked candidate in this campaign has been swiped.
        </p>
        <div className="mt-2 flex gap-2">
          <Link href={reviewHref} className="btn btn-primary">Review board</Link>
          <Link href={backHref} className="btn btn-ghost">Campaign</Link>
        </div>
        {history.length ? (
          <button onClick={undo} className="btn btn-ghost text-xs">↩ Undo last swipe</button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div ref={frameRef} className="relative h-[34rem] w-full max-w-sm select-none">
        {/* stack illusion: next two cards peek out beneath */}
        {cards.slice(index + 1, index + 3).map((c, i) => (
          <div
            key={c.id}
            aria-hidden
            className="card absolute inset-0 overflow-hidden"
            style={{
              transform: `translateY(${(i + 1) * 10}px) scale(${1 - (i + 1) * 0.04})`,
              zIndex: 2 - i,
              opacity: 0.7 - i * 0.3,
            }}
          >
            {c.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.photo} alt="" referrerPolicy="no-referrer" className="h-2/5 w-full object-cover opacity-60" />
            ) : (
              <div className="h-2/5 w-full bg-surface-2" />
            )}
          </div>
        ))}

        {/* top card */}
        <div
          key={current.id}
          ref={cardRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="card absolute inset-0 z-10 flex touch-none flex-col overflow-hidden"
          style={
            leaving
              ? {
                  transition: "transform 0.26s ease-in, opacity 0.26s ease-in",
                  transform: `translateX(${leaving.dir * 130}%) rotate(${leaving.dir * 18}deg)`,
                  opacity: 0,
                }
              : undefined
          }
        >
          {/* YES / NO stamp — fades in with drag distance, side set by direction */}
          <div
            data-stamp
            className="group pointer-events-none absolute top-6 z-20 rounded-lg border-4 px-4 py-1 font-mono text-3xl font-bold tracking-widest opacity-0 data-[dir=no]:right-6 data-[dir=no]:rotate-12 data-[dir=no]:border-rose-400 data-[dir=no]:text-rose-400 data-[dir=yes]:left-6 data-[dir=yes]:-rotate-12 data-[dir=yes]:border-emerald-400 data-[dir=yes]:text-emerald-300"
          >
            <span className="hidden group-data-[dir=yes]:inline">YES</span>
            <span className="hidden group-data-[dir=no]:inline">NO</span>
          </div>

          {/* ① picture + ④ score */}
          <div className="relative h-[45%] shrink-0 bg-surface-2">
            {current.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={current.photo}
                alt=""
                referrerPolicy="no-referrer"
                draggable={false}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full w-full place-items-center font-display text-6xl text-faint">
                {current.initials}
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-4 pb-3 pt-12">
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-display text-2xl leading-tight text-white">
                    {current.name}
                  </p>
                  {current.headline ? (
                    <p className="mt-0.5 line-clamp-2 text-xs text-white/75">{current.headline}</p>
                  ) : null}
                </div>
                {current.score != null ? (
                  <div className="shrink-0 text-right">
                    <div className="text-3xl font-bold tabular-nums leading-none text-white">
                      {current.score}
                    </div>
                    <span className={`chip mt-1 ${current.verdictChip}`}>{current.verdictLabel}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* ② summary + ③ scraped info */}
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
            {current.summary ? (
              <p className="text-sm leading-relaxed text-ink">{current.summary}</p>
            ) : null}
            {current.highlights.length ? (
              <div className="flex flex-wrap gap-1.5">
                {current.highlights.map((h, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[11px] font-medium text-cyan-200 ring-1 ring-cyan-500/25"
                  >
                    {h.tier === 1 ? "★ " : ""}
                    {h.label}
                  </span>
                ))}
              </div>
            ) : null}
            {current.facts.length ? (
              <ul className="space-y-1.5">
                {current.facts.map((f, i) => (
                  <li key={i} className="flex gap-2 text-xs leading-snug text-muted">
                    <span className="mt-0.5 shrink-0 text-faint">·</span>
                    {f}
                  </li>
                ))}
              </ul>
            ) : null}
            <a
              href={current.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              onPointerDown={(e) => e.stopPropagation()}
              className="mt-auto inline-flex w-fit items-center gap-1 rounded border border-border-soft px-2 py-1 text-xs text-muted hover:border-border hover:text-ink"
            >
              LinkedIn ↗
            </a>
          </div>
        </div>
      </div>

      {/* controls */}
      <div className="flex items-center gap-6">
        <button
          onClick={() => commit(-1)}
          aria-label="No — skip this candidate"
          className="grid h-16 w-16 place-items-center rounded-full border border-rose-500/40 bg-rose-500/10 text-2xl text-rose-300 transition hover:bg-rose-500/25 active:scale-95"
        >
          ✕
        </button>
        <button
          onClick={undo}
          disabled={!history.length}
          aria-label="Undo last swipe"
          className="grid h-11 w-11 place-items-center rounded-full border border-border-soft bg-surface-2/60 text-base text-muted transition hover:text-ink active:scale-95 disabled:opacity-30"
        >
          ↩
        </button>
        <button
          onClick={() => commit(1)}
          aria-label="Yes — approve this candidate"
          className="grid h-16 w-16 place-items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-2xl text-emerald-300 transition hover:bg-emerald-500/25 active:scale-95"
        >
          ✓
        </button>
      </div>

      <p className="font-mono text-xs text-faint">
        {index + 1} of {cards.length}
      </p>
    </div>
  );
}
