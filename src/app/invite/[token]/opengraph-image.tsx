import { ImageResponse } from "next/og";

import { formatPercent } from "@/lib/format";
import {
  inviteShareDescription,
  inviteShareHeadline,
  titleChips,
  type InviteSharePreview,
} from "@/lib/conquest/invite-share-card";
import { loadInvitePreview } from "@/server/conquest/load-invite-preview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Cityfil city rivalry invite";

type ImageProps = { params: Promise<{ token: string }> };

export default async function InviteOpengraphImage({ params }: ImageProps) {
  const { token } = await params;
  const preview = await loadInvitePreview(token);
  return new ImageResponse(<InviteCard preview={preview} />, { ...size });
}

function InviteCard({ preview }: { preview: InviteSharePreview | null }) {
  if (!preview) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          backgroundColor: "#0c0e18",
          backgroundImage: "radial-gradient(circle at 62% 32%, rgba(255,138,76,0.18), rgba(12,14,24,0) 55%)",
        }}
      >
        <Brand />
        <div style={{ marginTop: 48, fontSize: 64, fontWeight: 600, color: "#f5f3ee", letterSpacing: -1.5 }}>
          This invite expired
        </div>
        <div style={{ marginTop: 20, fontSize: 32, color: "#a9a6ad" }}>Ask your rival for a new 14-day link.</div>
      </div>
    );
  }

  const share = preview.inviterShare == null ? "—" : formatPercent(preview.inviterShare);
  const chips = titleChips(preview);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        backgroundColor: "#0c0e18",
        backgroundImage: "radial-gradient(circle at 78% 18%, rgba(255,138,76,0.28), rgba(12,14,24,0) 48%)",
      }}
    >
      <Brand />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 28, color: "#ff8a4c", letterSpacing: 4, textTransform: "uppercase" }}>
          City rivalry
        </div>
        <div
          style={{
            marginTop: 16,
            fontSize: 72,
            fontWeight: 600,
            color: "#f5f3ee",
            letterSpacing: -2,
            lineHeight: 1.05,
          }}
        >
          {inviteShareHeadline(preview)}
        </div>
        <div style={{ marginTop: 20, fontSize: 32, color: "#a9a6ad", lineHeight: 1.35 }}>
          {inviteShareDescription(preview)}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 22, color: "#a9a6ad" }}>{preview.inviterName}</div>
          <div style={{ fontSize: 88, fontWeight: 700, color: "#ffe08a", letterSpacing: -3 }}>{share}</div>
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          {chips.map((chip) => (
            <div
              key={chip.name}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "14px 22px",
                borderRadius: 999,
                backgroundColor: chip.open ? "rgba(255,138,76,0.18)" : "rgba(255,255,255,0.06)",
                color: chip.open ? "#ff8a4c" : "#7d7a82",
                fontSize: 24,
                fontWeight: 600,
              }}
            >
              {chip.name} {chip.open ? "open" : "claimed"}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <svg width={56} height={56} viewBox="0 0 32 32">
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
      <div style={{ fontSize: 36, fontWeight: 600, color: "#f5f3ee" }}>Cityfil</div>
    </div>
  );
}
