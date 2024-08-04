import { defineConfig } from "vitest/config";
import path from "path";

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
