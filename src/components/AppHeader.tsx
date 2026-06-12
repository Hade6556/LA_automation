import Link from "next/link";
import { logout } from "@/app/login/actions";

// Sticky, blurred cosmic header shared across pages. `active` dims the current
// nav target. Pass `back` to show a "← Campaigns" affordance on inner pages.
export default function AppHeader({
  active,
  back,
}: {
  active?: "campaigns" | "candidates" | "swipe";
  back?: { href: string; label: string };
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border-soft/80 bg-bg/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3.5 sm:gap-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" className="group flex shrink-0 items-center gap-2.5">
            <span
              aria-hidden
              className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-glow to-blue text-[13px] shadow-[0_0_18px_-2px_var(--color-cyan)]"
            >
              🛰
            </span>
            {/* Mobile shows the glyph only — the full wordmark wraps and collides with the nav. */}
            <span className="hidden whitespace-nowrap font-display text-[1.15rem] leading-none text-ink sm:inline">
              Lost Astronaut
            </span>
          </Link>
          {back ? (
            <span className="hidden min-w-0 items-center gap-3 md:flex">
              <span className="text-faint">/</span>
              <Link
                href={back.href}
                className="truncate font-mono text-xs text-muted hover:text-ink"
              >
                {back.label}
              </Link>
            </span>
          ) : null}
        </div>

        <nav className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          {/* Compact paddings/text on mobile so all four items fit one row at 375px. */}
          <Link
            href="/"
            className={`btn btn-ghost whitespace-nowrap px-2 py-1.5 text-xs sm:px-3.5 sm:py-2 sm:text-sm ${active === "campaigns" ? "text-ink" : ""}`}
          >
            Campaigns
          </Link>
          <Link
            href="/candidates"
            className={`btn btn-ghost whitespace-nowrap px-2 py-1.5 text-xs sm:px-3.5 sm:py-2 sm:text-sm ${active === "candidates" ? "text-ink" : ""}`}
          >
            Candidates
          </Link>
          <Link
            href="/swipe"
            className={`btn btn-ghost whitespace-nowrap px-2 py-1.5 text-xs sm:px-3.5 sm:py-2 sm:text-sm ${active === "swipe" ? "text-ink" : ""}`}
          >
            Swipe
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="btn btn-ghost px-2 py-1.5 text-xs sm:px-3.5 sm:py-2 sm:text-sm"
              title="Log out"
            >
              ⏏
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
