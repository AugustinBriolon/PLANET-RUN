import { after, type NextRequest } from "next/server";

import { getServerEnv } from "@/server/env";
import { getServices } from "@/server/services";
import { stravaWebhookEventSchema } from "@/server/strava/strava-types";

/** Subscription validation handshake sent once by Strava when the webhook is registered. */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const isValid =
    params.get("hub.mode") === "subscribe" &&
    params.get("hub.verify_token") === getServerEnv().STRAVA_WEBHOOK_VERIFY_TOKEN;

  if (!isValid) return Response.json({ error: "Invalid verification request" }, { status: 403 });
  return Response.json({ "hub.challenge": params.get("hub.challenge") });
}

export async function POST(request: NextRequest) {
  const parsed = stravaWebhookEventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid event" }, { status: 400 });

  // Strava expects an acknowledgement within 2 seconds; processing continues after the response.
  after(async () => {
    try {
      await getServices().stravaWebhook.handleEvent(parsed.data);
    } catch (error) {
      console.error("Failed to process Strava webhook event", error);
    }
  });

  return new Response(null, { status: 200 });
}
