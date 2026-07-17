import path from "node:path";
import { defineConfig } from "vitest/config";

const isCI = process.env.CI === "true";

// We support the loading of .env files as an easy way to set environment variables for local development. But we don't
// care if there are none so we silence the warning from dotenv-flow about no .env files being found.
process.env.DOTENV_FLOW_SILENT = "true";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./"),
    },
  },
  test: {
    setupFiles: ["dotenv-flow/config", "./test/setup.ts"],
    testTimeout: 10_000, // 10s to allow for Playwright browser startup and page load
    reporters: isCI ? ["default", "junit", "html"] : ["default"],
    outputFile: isCI
      ? {
          junit: "./test-results/junit.xml",
          html: "./test-results/html/index.html",
        }
      : undefined,
  },
});
