import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 40,
        backgroundColor: "#0c0e18",
        backgroundImage: "radial-gradient(circle at 62% 32%, rgba(255,138,76,0.22), rgba(12,14,24,0) 55%)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <svg width={120} height={120} viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="9" fill="rgba(255,255,255,0.12)" stroke="#f5f3ee" strokeWidth="1.4" />
          <ellipse
            cx="16"
            cy="16"
            rx="14"
            ry="5.3"
            transform="rotate(-24 16 16)"
            fill="none"
            stroke="#ff8a4c"
            strokeWidth="1.4"
          />
          <circle cx="27.7" cy="10.9" r="2.3" fill="#ff8a4c" />
        </svg>
        <div style={{ fontSize: 96, fontWeight: 600, color: "#f5f3ee", letterSpacing: -2 }}>Planet Run</div>
      </div>
      <div style={{ fontSize: 34, color: "#a9a6ad", letterSpacing: 2 }}>Every run, one planet</div>
    </div>,
    { ...size },
  );
}
