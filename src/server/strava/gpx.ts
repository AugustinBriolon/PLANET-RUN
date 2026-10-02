export type RecordedPoint = {
  lat: number;
  lng: number;
  /** Epoch milliseconds. */
  time: number;
  /** Meters above sea level, when the device reported it. */
  altitude?: number | null;
};

export type RecordedRun = {
  name: string;
  /** One segment per stretch between pauses; Strava excludes the gaps from moving time. */
  segments: RecordedPoint[][];
};

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (char) => `&#${char.charCodeAt(0)};`);
}

function trackPoint({ lat, lng, time, altitude }: RecordedPoint): string {
  const elevation = altitude != null && Number.isFinite(altitude) ? `<ele>${altitude.toFixed(1)}</ele>` : "";
  return `<trkpt lat="${lat.toFixed(7)}" lon="${lng.toFixed(7)}">${elevation}<time>${new Date(time).toISOString()}</time></trkpt>`;
}

/** GPX 1.1 document Strava's upload endpoint accepts for a recorded run. */
export function buildRunGpx({ name, segments }: RecordedRun): string {
  const tracks = segments
    .filter((segment) => segment.length > 0)
    .map((segment) => `<trkseg>${segment.map(trackPoint).join("")}</trkseg>`)
    .join("");
  const startedAt = segments.flat()[0]?.time;
  const metadata = startedAt != null ? `<metadata><time>${new Date(startedAt).toISOString()}</time></metadata>` : "";

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<gpx version="1.1" creator="Planet Run" xmlns="http://www.topografix.com/GPX/1/1">` +
    metadata +
    `<trk><name>${escapeXml(name)}</name><type>running</type>${tracks}</trk>` +
    `</gpx>`
  );
}
