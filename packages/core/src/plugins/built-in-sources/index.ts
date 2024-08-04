import giphy from "./giphy/index.js";
import { Plugin } from "@/src/schemas/plugin.js";

export default {
  sources: [giphy],
} satisfies Plugin;
