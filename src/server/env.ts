import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.url(),
  AUTH_SECRET: z.string().min(32),
  STRAVA_CLIENT_ID: z.string().min(1),
  STRAVA_CLIENT_SECRET: z.string().min(1),
  TOKEN_ENCRYPTION_KEY: z.base64(),
  STRAVA_WEBHOOK_VERIFY_TOKEN: z.string().min(16),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | undefined;

// Parsed lazily so `next build` does not require runtime secrets.
export function getServerEnv(): ServerEnv {
  cachedEnv ??= serverEnvSchema.parse(process.env);
  return cachedEnv;
}
