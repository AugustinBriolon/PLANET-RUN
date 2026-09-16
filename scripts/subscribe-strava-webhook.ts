/**
 * Registers the Strava push subscription. Strava allows a single subscription per application.
 * Usage: pnpm strava:webhook:subscribe https://<public-host>/api/webhooks/strava
 */
async function main() {
  const callbackUrl = process.argv[2];
  const { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_WEBHOOK_VERIFY_TOKEN } = process.env;
  if (!callbackUrl || !STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET || !STRAVA_WEBHOOK_VERIFY_TOKEN) {
    throw new Error("Usage: pnpm strava:webhook:subscribe <callback-url> (with Strava env vars set)");
  }

  const response = await fetch("https://www.strava.com/api/v3/push_subscriptions", {
    method: "POST",
    body: new URLSearchParams({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      callback_url: callbackUrl,
      verify_token: STRAVA_WEBHOOK_VERIFY_TOKEN,
    }),
  });
  console.log(response.status, await response.text());
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
