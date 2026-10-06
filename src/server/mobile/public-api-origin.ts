/**
 * Origin for Strava `redirect_uri`.
 * Use AUTH_URL when set; otherwise the host the client actually hit.
 * Never prefer `VERCEL_URL` — it is a per-deployment hostname and breaks Strava's callback domain.
 */
export function publicApiOrigin(request: Request, env: Record<string, string | undefined> = process.env): string {
  const authUrl = env.AUTH_URL?.replace(/\/$/, "");
  if (authUrl) return authUrl;
  return new URL(request.url).origin;
}
