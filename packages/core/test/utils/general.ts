import { GenericRequest } from "@/src/index.js";
import path from "path";

export async function getSecrets(request: GenericRequest) {
  try {
    const { default: importedGetSecrets } = await import(
      path.join(import.meta.dirname, "../../.secrets.mjs")
    );
    return importedGetSecrets({ request });
  } catch (error) {
    console.error(error);
  }
  return {};
}
