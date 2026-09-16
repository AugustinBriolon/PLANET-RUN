import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const serverOnlyStub = new URL("./tests/stubs/server-only.ts", import.meta.url).pathname;

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: { "server-only": serverOnlyStub },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.{ts,tsx}"],
          environment: "jsdom",
          setupFiles: ["./tests/setup-unit.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          globalSetup: ["./tests/integration/global-setup.ts"],
          fileParallelism: false,
        },
      },
    ],
  },
});
