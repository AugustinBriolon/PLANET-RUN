/**
 * One-shot: mint a cityfil-mobile JWT for local simulator login bypass.
 * Usage: pnpm exec tsx --env-file=.env.local scripts/mint-mobile-dev-token.ts
 */
import { SignJWT } from "jose";
import postgres from "postgres";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const authSecret = process.env.AUTH_SECRET;
  if (!databaseUrl || !authSecret) {
    throw new Error("DATABASE_URL and AUTH_SECRET are required");
  }

  const sql = postgres(databaseUrl, { max: 1 });
  try {
    const users = await sql<{ id: string; display_name: string | null }[]>`
      select id, display_name from users order by created_at asc nulls last limit 30
    `;
    const me =
      users.find((user) => /augustin|briolon/i.test(user.display_name ?? "")) ?? users[0];
    if (!me) throw new Error("No users in database");

    const token = await new SignJWT({ typ: "cityfil-mobile" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(me.id)
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(new TextEncoder().encode(authSecret));

    process.stdout.write(`${JSON.stringify({ userId: me.id, displayName: me.display_name, token })}\n`);
  } finally {
    await sql.end({ timeout: 1 });
  }
}

void main();
