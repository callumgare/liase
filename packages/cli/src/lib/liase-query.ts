import {
  type GenericRequest,
  type LiaseQuery,
  type Plugin,
  createLiaseQuery,
} from "@liase/core";
import { getLiaseDetailsFromArgs } from "./liase-details.js";
import { getSecretsSets } from "./secrets.js";

export async function getLiaseQuery({
  request,
  secretsSet,
  cacheNetworkRequests,
  loadPluginsFromArgs,
}: {
  request: Record<string, unknown>;
  secretsSet?: string;
  cacheNetworkRequests?: "never" | "auto" | "always";
  loadPluginsFromArgs?: boolean;
}): Promise<LiaseQuery> {
  const plugins: Plugin[] = [];
  if (loadPluginsFromArgs) {
    const liaseDetails = await getLiaseDetailsFromArgs();
    plugins.push(...liaseDetails.plugins);
  }
  let secrets = {};
  if (secretsSet) {
    const secretsSets = await getSecretsSets();
    secrets = secretsSets[secretsSet];
  }

  return createLiaseQuery({
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
