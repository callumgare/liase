import fs from "node:fs/promises";
import path from "node:path";
import type { GenericRequest } from "@/src/index.js";

export async function getSecrets(request: GenericRequest) {
  try {
    if (process.env.LIASE_SECRETS_FILE) {
      const secretsPath = path.resolve(process.env.LIASE_SECRETS_FILE);
      try {
        await fs.access(secretsPath);
      } catch {
        throw Error(
          `LIASE_SECRETS_FILE is set to ${process.env.LIASE_SECRETS_FILE} but secrets file not found or accessible`,
        );
      }
      const { default: importedGetSecrets } = await import(secretsPath);
      return importedGetSecrets({ request });
    }
    // Find .secrets.mjs by searching upward from import.meta.dirname
    // (supports both source test/ and compiled dist/test/ locations)
    for (const relativePath of [
      "../../.secrets.mjs",
      "../../../.secrets.mjs",
    ]) {
      const secretsPath = path.join(import.meta.dirname, relativePath);
      try {
        await fs.access(secretsPath);
        const { default: importedGetSecrets } = await import(secretsPath);
        return importedGetSecrets({ request });
      } catch {
        // try next candidate
      }
    }
    return {};
  } catch (error) {
    console.error(error);
  }
  return {};
}
