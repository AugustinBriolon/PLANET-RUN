import { z } from "zod";

/** ~11 h at one fix per second: far beyond any run, small enough for a serverless body. */
export const MAX_UPLOAD_POINTS = 40_000;

/**
 * GPS timestamps from iOS often arrive as non-integers; altitudes may be NaN.
 * Floor time and drop non-finite altitude so a finished run is not rejected as unreadable.
 */
export const runUploadPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  time: z
    .number()
    .positive()
    .transform((value) => Math.trunc(value)),
  altitude: z.preprocess(
    (value) => (typeof value === "number" && Number.isFinite(value) ? value : null),
    z.number().finite().nullable(),
  ),
});

export const runUploadBodySchema = z
  .object({
    clientRunId: z.string().regex(/^[A-Za-z0-9-]{8,64}$/),
    name: z.string().trim().min(1).max(120),
    segments: z.array(z.array(runUploadPointSchema)).min(1),
  })
  .refine(({ segments }) => {
    const count = segments.reduce((total, segment) => total + segment.length, 0);
    return count >= 2 && count <= MAX_UPLOAD_POINTS;
  }, "segments must hold between 2 and 40000 points");

export type RunUploadBody = z.infer<typeof runUploadBodySchema>;
