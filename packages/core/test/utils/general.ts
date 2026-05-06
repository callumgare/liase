import fs from "node:fs/promises";
import path from "node:path";
import type { GenericRequest } from "@/src/index.js";

export async function getSecrets(request: GenericRequest) {
  try {
    const secretsPath = process.env.LIASE_SECRETS_FILE
      ? path.resolve(process.env.LIASE_SECRETS_FILE)
      : path.join(import.meta.dirname, "../../.secrets.mjs");
    try {
      await fs.access(secretsPath);
    } catch (error) {
      if (process.env.LIASE_SECRETS_FILE) {
        throw Error(
          `LIASE_SECRETS_FILE is set to ${process.env.LIASE_SECRETS_FILE} but secrets file not found or accessible`,
        );
      }
      return {};
    }
    const { default: importedGetSecrets } = await import(secretsPath);
    return importedGetSecrets({ request });
  } catch (error) {
    console.error(error);
  }
  return {};
}
