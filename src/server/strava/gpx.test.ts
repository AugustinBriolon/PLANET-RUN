import { describe, expect, it } from "vitest";

import { buildRunGpx } from "./gpx";

const START = Date.UTC(2026, 9, 2, 7, 0, 0);

describe("buildRunGpx", () => {
  it("writes one track segment per stretch between pauses", () => {
    const gpx = buildRunGpx({
      name: "Morning conquest",
      segments: [
        [
          { lat: 48.1, lng: -1.6, time: START },
          { lat: 48.1001, lng: -1.6001, time: START + 5_000 },
        ],
        [{ lat: 48.2, lng: -1.7, time: START + 60_000, altitude: 42.26 }],
      ],
    });

    expect(gpx.match(/<trkseg>/g)).toHaveLength(2);
    expect(gpx).toContain('<trkpt lat="48.1000000" lon="-1.6000000"><time>2026-10-02T07:00:00.000Z</time></trkpt>');
    expect(gpx).toContain("<ele>42.3</ele>");
    expect(gpx).toContain("<metadata><time>2026-10-02T07:00:00.000Z</time></metadata>");
  });

  it("escapes the run name and skips empty segments", () => {
    const gpx = buildRunGpx({ name: `Rennes <run> & "fun"`, segments: [[], [{ lat: 1, lng: 2, time: START }]] });

    expect(gpx).toContain("<name>Rennes &#60;run&#62; &#38; &#34;fun&#34;</name>");
    expect(gpx.match(/<trkseg>/g)).toHaveLength(1);
  });
});
