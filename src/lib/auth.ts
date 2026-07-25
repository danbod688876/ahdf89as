import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, calendarAccounts } from "@/lib/db/schema";

/**
 * The app's one and only auth system (spec §4.1) — Garden doesn't get its
 * own login. Each person authenticates Outlook and/or Gmail separately;
 * tokens are written straight to `calendar_accounts` (server-side only,
 * never sent to the client — spec §4.2) rather than into NextAuth's own
 * session/account tables, since the household's `users` rows are the
 * source of truth the rest of the app joins against.
 *
 * Read scopes (`calendar.readonly` / `Calendars.Read`) power the merged
 * calendar view. The heavier write scopes below are what §2.6 needs for
 * the "create event & send invites" action — call out why on the consent
 * screen, since this is a bigger permission ask than a read-only app.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/calendar",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
    MicrosoftEntraID({
      authorization: {
        params: {
          scope: "openid email profile offline_access Calendars.ReadWrite",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (!account || !profile?.email) return token;

      const provider: "google" | "microsoft" = account.provider === "google" ? "google" : "microsoft";
      const email = profile.email;

      const existing = await db.query.calendarAccounts.findFirst({
        where: and(eq(calendarAccounts.provider, provider), eq(calendarAccounts.email, email)),
      });

      let userId = existing?.userId;
      if (!userId) {
        // First time this email has been connected — create the household
        // member it belongs to. Linking a second provider (e.g. this
        // person's Outlook after their Gmail) to the same existing user
        // is a manual step for now; the scaffold doesn't infer it.
        const [newUser] = await db
          .insert(users)
          .values({ name: profile.name ?? email })
          .returning();
        userId = newUser.id;
      }

      const tokenValues = {
        userId,
        provider,
        email,
        accessToken: account.access_token ?? "",
        refreshToken: account.refresh_token,
        expiresAt: account.expires_at ? new Date(account.expires_at * 1000) : undefined,
        scope: account.scope,
      };

      if (existing) {
        await db
          .update(calendarAccounts)
          .set(tokenValues)
          .where(eq(calendarAccounts.id, existing.id));
      } else {
        await db.insert(calendarAccounts).values(tokenValues);
      }

      token.householdUserId = userId;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { householdUserId?: string }).householdUserId =
          token.householdUserId as string | undefined;
      }
      return session;
    },
  },
});
