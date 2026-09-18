/**
 * Priority cities whose street geometry is worth preloading (large / slow Overpass).
 * Boundaries for many more cities live in `city_catalog`; only these get `street_segments`.
 * Relation ids must be verified on openstreetmap.org (admin_level=8 commune).
 */
export const PRIORITY_STREET_CITIES = [
  { osmRelationId: 7444, name: "Paris" },
  { osmRelationId: 120965, name: "Lyon" },
  { osmRelationId: 76469, name: "Marseille" },
  { osmRelationId: 35738, name: "Toulouse" },
  { osmRelationId: 91738, name: "Colombes" },
  { osmRelationId: 91775, name: "La Garenne-Colombes" },
] as const;
