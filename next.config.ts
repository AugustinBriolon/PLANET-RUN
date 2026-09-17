import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // LAN/phone testing: Next blocks /_next HMR + RSC debug on non-localhost hosts
  // unless listed here — without it MapLibre never finishes hydrating (stuck loader dots).
  allowedDevOrigins: ["192.168.*.*"],
};

export default nextConfig;
