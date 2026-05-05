import type { Plugin } from "@/src/schemas/plugin.js";
import bluesky from "./bluesky/index.js";
import giphy from "./giphy/index.js";

export default {
  sources: [giphy, bluesky],
} satisfies Plugin;
