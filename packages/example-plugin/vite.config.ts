import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./"),
    },
  },
  test: {
    globalSetup: "./test/setup.ts",
    setupFiles: ["dotenv-flow/config"],
  },
});
