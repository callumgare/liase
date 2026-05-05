import {
  type GenericRequest,
  type LiasonQuery,
  type Plugin,
  createLiasonQuery,
} from "@liason/core";
import { getLiasonDetailsFromArgs } from "./liason-details.js";
import { getSecretsSets } from "./secrets.js";

export async function getLiasonQuery({
  request,
  secretsSet,
  cacheNetworkRequests,
  loadPluginsFromArgs,
}: {
  request: Record<string, unknown>;
  secretsSet?: string;
  cacheNetworkRequests?: "never" | "auto" | "always";
  loadPluginsFromArgs?: boolean;
}): Promise<LiasonQuery> {
  const plugins: Plugin[] = [];
  if (loadPluginsFromArgs) {
    const liasonDetails = await getLiasonDetailsFromArgs();
    plugins.push(...liasonDetails.plugins);
  }
  let secrets = {};
  if (secretsSet) {
    const secretsSets = await getSecretsSets();
    secrets = secretsSets[secretsSet];
  }

  return createLiasonQuery({
    request: request as GenericRequest,
    queryOptions: {
      secrets,
      cacheNetworkRequests,
    },
    finderOptions: {
      plugins,
    },
  });
}
