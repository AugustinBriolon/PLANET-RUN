import type { MapArcDatum } from "@/components/ui/map";

const cities = {
  paris: [2.3522, 48.8566],
  newYork: [-74.006, 40.7128],
  capeTown: [18.4241, -33.9249],
  tokyo: [139.6917, 35.6895],
  rio: [-43.1729, -22.9068],
  sydney: [151.2093, -33.8688],
  nairobi: [36.8219, -1.2921],
} satisfies Record<string, [number, number]>;

/** Famous marathon cities linked together on the login globe. */
export const showcaseArcs: MapArcDatum[] = [
  { id: "paris-new-york", from: cities.paris, to: cities.newYork },
  { id: "paris-nairobi", from: cities.paris, to: cities.nairobi },
  { id: "nairobi-cape-town", from: cities.nairobi, to: cities.capeTown },
  { id: "new-york-rio", from: cities.newYork, to: cities.rio },
  { id: "tokyo-sydney", from: cities.tokyo, to: cities.sydney },
  { id: "paris-tokyo", from: cities.paris, to: cities.tokyo },
];
