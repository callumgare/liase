import giphy from "./giphy/index.js";
import bluesky from "./bluesky/index.js";
import { Plugin } from "@/src/schemas/plugin.js";

export default {
  sources: [giphy, bluesky],
} satisfies Plugin;
