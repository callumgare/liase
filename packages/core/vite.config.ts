import path from "node:path";
import { defineConfig } from "vitest/config";

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
    setupFiles: ["dotenv-flow/config"],
    exclude: ["dist/**"],
  },
});
