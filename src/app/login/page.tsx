import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
      <form
        action={login}
        className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
      >
        <h1 className="text-lg font-semibold text-zinc-900">Lost Astronaut</h1>
        <p className="mt-1 mb-5 text-sm text-zinc-500">
          Candidate cockpit · operator access
        </p>
        <label
          htmlFor="password"
          className="mb-1 block text-sm font-medium text-zinc-700"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoFocus
          suppressHydrationWarning
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900"
        />
        {error ? (
          <p className="mt-2 text-sm text-red-600">Incorrect password.</p>
        ) : null}
        <button
          type="submit"
          className="mt-4 w-full rounded-md bg-zinc-900 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Enter
        </button>
      </form>
    </main>
  );
}
