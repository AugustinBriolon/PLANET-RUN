import "server-only";

import { z } from "zod";

const TOKEN_ENCRYPTION_KEY_BYTES = 32;

const serverEnvSchema = z.object({
  DATABASE_URL: z.url(),
  AUTH_SECRET: z.string().min(32),
  STRAVA_CLIENT_ID: z.string().min(1),
  STRAVA_CLIENT_SECRET: z.string().min(1),
  TOKEN_ENCRYPTION_KEY: z.base64().refine((key) => Buffer.from(key, "base64").length === TOKEN_ENCRYPTION_KEY_BYTES, {
    error: `Must be a base64-encoded ${TOKEN_ENCRYPTION_KEY_BYTES}-byte key (openssl rand -base64 32)`,
  }),
  STRAVA_WEBHOOK_VERIFY_TOKEN: z.string().min(16),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    // Only variable names and rules are reported: values are secrets.
    const problems = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid server environment variables:\n- ${problems.join("\n- ")}`);
  }
  return result.data;
}

let cachedEnv: ServerEnv | undefined;

// Parsed lazily so `next build` does not require runtime secrets.
export function getServerEnv(): ServerEnv {
  cachedEnv ??= parseServerEnv(process.env);
  return cachedEnv;
}
