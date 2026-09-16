import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import { parseServerEnv } from "./env";

const validEnv = {
  DATABASE_URL: "postgres://planet_run:planet_run@localhost:5433/planet_run",
  AUTH_SECRET: "a".repeat(44),
  STRAVA_CLIENT_ID: "12345",
  STRAVA_CLIENT_SECRET: "strava-secret",
  TOKEN_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  STRAVA_WEBHOOK_VERIFY_TOKEN: "b".repeat(48),
};

describe("parseServerEnv", () => {
  it("accepts a complete environment", () => {
    expect(parseServerEnv(validEnv)).toMatchObject({ STRAVA_CLIENT_ID: "12345" });
  });

  it("rejects an empty encryption key", () => {
    expect(() => parseServerEnv({ ...validEnv, TOKEN_ENCRYPTION_KEY: "" })).toThrow(/TOKEN_ENCRYPTION_KEY/);
  });

  it("rejects an encryption key of the wrong size", () => {
    expect(() => parseServerEnv({ ...validEnv, TOKEN_ENCRYPTION_KEY: randomBytes(16).toString("base64") })).toThrow(
      /32-byte/,
    );
  });

  it("lists every invalid variable without leaking values", () => {
    const attempt = () => parseServerEnv({ ...validEnv, AUTH_SECRET: "short-secret-value", DATABASE_URL: "" });

    expect(attempt).toThrow(/AUTH_SECRET/);
    expect(attempt).toThrow(/DATABASE_URL/);
    expect(attempt).not.toThrow(/short-secret-value/);
  });
});
