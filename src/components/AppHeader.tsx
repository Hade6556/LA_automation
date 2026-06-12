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
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" className="group flex items-center gap-2.5">
            <span
              aria-hidden
              className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-glow to-blue text-[13px] shadow-[0_0_18px_-2px_var(--color-cyan)]"
            >
              🛰
            </span>
            <span className="font-display text-[1.15rem] leading-none text-ink">
              Lost Astronaut
            </span>
          </Link>
          {back ? (
            <>
              <span className="text-faint">/</span>
              <Link
                href={back.href}
                className="truncate font-mono text-xs text-muted hover:text-ink"
              >
                {back.label}
              </Link>
            </>
          ) : null}
        </div>

        <nav className="flex shrink-0 items-center gap-1.5">
          <Link
            href="/"
            className={`btn btn-ghost ${active === "campaigns" ? "text-ink" : ""}`}
          >
            Campaigns
          </Link>
          <Link
            href="/candidates"
            className={`btn btn-ghost ${active === "candidates" ? "text-ink" : ""}`}
          >
            Candidates
          </Link>
          <Link
            href="/swipe"
            className={`btn btn-ghost ${active === "swipe" ? "text-ink" : ""}`}
          >
            Swipe
          </Link>
          <form action={logout}>
            <button type="submit" className="btn btn-ghost" title="Log out">
              ⏏
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
