import { GenericRequest } from "@/src/index.js";
import fs from "node:fs/promises";
import path from "path";

export async function getSecrets(request: GenericRequest) {
  try {
    const secretsPath =
      process.env.MEDIA_FINDER_SECRETS_FILE ??
      path.join(import.meta.dirname, "../../.secrets.mjs");
    try {
      await fs.access(secretsPath);
    } catch (error) {
      if (process.env.MEDIA_FINDER_SECRETS_FILE) {
        throw Error(
          `MEDIA_FINDER_SECRETS_FILE is set to ${process.env.MEDIA_FINDER_SECRETS_FILE} but secrets file not found or accessible`,
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

// const cake: number = "fdsafas"
