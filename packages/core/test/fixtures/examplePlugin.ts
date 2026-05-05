import type { Plugin } from "@/src/schemas/plugin.js";
import exampleSource from "./exampleSource.js";

export default {
  sources: [exampleSource],
} satisfies Plugin;
