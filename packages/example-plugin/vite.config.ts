import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// We support the loading of .env files as an easy way to set environment variables for local development. But we don't
// care if there are none so we silence the warning from dotenv-flow about no .env files being found.
process.env.DOTENV_FLOW_SILENT = "true";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./"),
    },
  },
  test: {
    globalSetup: "./test/setup.ts",
    setupFiles: ["dotenv-flow/config"],
  },
});
