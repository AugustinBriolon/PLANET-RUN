import { z } from "zod";

/** Subset of Strava's SummaryActivity used by Planet Run. */
export const stravaActivitySchema = z.object({
  id: z.number(),
  athlete: z.object({ id: z.number() }),
  name: z.string(),
  sport_type: z.string(),
  start_date: z.string(),
  distance: z.number(),
  moving_time: z.number(),
  total_elevation_gain: z.number(),
  map: z.object({
    summary_polyline: z.string().nullish(),
  }),
});

export type StravaActivity = z.infer<typeof stravaActivitySchema>;

export const stravaTokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_at: z.number(),
});

export type StravaTokenResponse = z.infer<typeof stravaTokenResponseSchema>;

export const stravaWebhookEventSchema = z.object({
  object_type: z.enum(["activity", "athlete"]),
  object_id: z.number(),
  aspect_type: z.enum(["create", "update", "delete"]),
  owner_id: z.number(),
  subscription_id: z.number(),
  event_time: z.number(),
  updates: z.record(z.string(), z.string()).optional(),
});

export type StravaWebhookEvent = z.infer<typeof stravaWebhookEventSchema>;
