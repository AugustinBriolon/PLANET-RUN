/** Client-safe view of a run: no user ids, no tokens. */
export type RunSummary = {
  id: number;
  name: string;
  startDate: string;
  distanceMeters: number;
  movingTimeSeconds: number;
  elevationGainMeters: number;
  polyline: string;
};
