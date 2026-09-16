import NextAuth from "next-auth";
import Strava from "next-auth/providers/strava";

import { getServices } from "@/server/services";
import { toAthleteIdentity } from "@/server/strava/strava-profile";

declare module "next-auth" {
  interface Session {
    user: { id: string };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    Strava({
      clientId: process.env.STRAVA_CLIENT_ID,
      clientSecret: process.env.STRAVA_CLIENT_SECRET,
      // Strava ignores PKCE, so `state` is what actually protects the callback from CSRF.
      checks: ["pkce", "state"],
      authorization: {
        params: { scope: "read,activity:read_all", approval_prompt: "auto", response_type: "code" },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (!account) return token;
      if (!account.access_token || !account.refresh_token || !account.expires_at) {
        throw new Error("Strava did not return a complete token set");
      }

      // Strava embeds the athlete in the token exchange response; the /athlete profile is only a fallback.
      const identity = toAthleteIdentity(account.athlete, profile);
      const userId = await getServices().accountLinking.linkStravaAthlete({
        ...identity,
        tokens: {
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAtEpochSeconds: account.expires_at,
        },
      });
      // Only the internal id is kept in the cookie; Strava tokens stay encrypted in the database.
      return { sub: userId, userId };
    },
    session({ session, token }) {
      session.user = { ...session.user, id: typeof token.userId === "string" ? token.userId : "" };
      return session;
    },
  },
});
