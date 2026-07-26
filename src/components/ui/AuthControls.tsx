import { auth, signOut } from "@/lib/auth";

export async function AuthControls() {
  // Sign-in is optional right now (spec-mandated login gate is disabled for
  // solo testing) — a misconfigured auth setup (e.g. missing AUTH_SECRET)
  // should degrade this one control, not take down the whole dashboard.
  const session = await auth().catch(() => null);

  if (!session?.user) {
    return (
      // A plain <a> is intentional — /api/auth/signin is a route handler, not
      // a Next.js page, so it needs a full navigation rather than client-side routing.
      // eslint-disable-next-line @next/next/no-html-link-for-pages
      <a
        href="/api/auth/signin"
        className="rounded-full bg-pine px-4 py-2 text-sm font-medium text-white"
      >
        Sign in
      </a>
    );
  }

  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
      className="flex items-center gap-3"
    >
      <span className="text-sm text-sage">{session.user.name ?? session.user.email}</span>
      <button type="submit" className="text-sm text-sage underline underline-offset-2">
        Sign out
      </button>
    </form>
  );
}
