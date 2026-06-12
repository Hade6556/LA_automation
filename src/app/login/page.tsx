import RotatingRole from "@/components/RotatingRole";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form
        action={login}
        className="card animate-fade-up w-full max-w-sm p-7"
      >
        <div className="mb-6 text-center">
          <span
            aria-hidden
            className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-glow to-blue text-lg shadow-[0_0_28px_-4px_var(--color-cyan)]"
          >
            🛰
          </span>
          <h1 className="font-display text-3xl text-ink">Lost Astronaut</h1>
          <p className="mt-1 font-mono text-xs text-faint">
            I want to find <RotatingRole />
          </p>
        </div>

        <label htmlFor="password" className="eyebrow mb-1.5 block">
          Operator access
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoFocus
          suppressHydrationWarning
          placeholder="password"
          className="field w-full px-3 py-2.5 text-sm"
        />
        {error ? (
          <p className="mt-2 text-sm text-rose-300">Incorrect password.</p>
        ) : null}
        <button type="submit" className="btn btn-primary mt-4 w-full py-2.5 font-semibold">
          Enter →
        </button>
      </form>
    </main>
  );
}
