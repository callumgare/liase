import {
	type GenericRequest,
	type MediaFinderQuery,
	type Plugin,
	createMediaFinderQuery,
} from "media-finder";
import { getMediaFinderDetailsFromArgs } from "./media-finder-details.js";
import { getSecretsSets } from "./secrets.js";

export async function getMediaFinderQuery({
	request,
	secretsSet,
	cacheNetworkRequests,
	loadPluginsFromArgs,
}: {
	request: Record<string, unknown>;
	secretsSet?: string;
	cacheNetworkRequests?: "never" | "auto" | "always";
	loadPluginsFromArgs?: boolean;
}): Promise<MediaFinderQuery> {
	const plugins: Plugin[] = [];
	if (loadPluginsFromArgs) {
		const mediaFinderDetails = await getMediaFinderDetailsFromArgs();
		plugins.push(...mediaFinderDetails.plugins);
	}
	let secrets = {};
	if (secretsSet) {
		const secretsSets = await getSecretsSets();
		secrets = secretsSets[secretsSet];
	}

	return createMediaFinderQuery({
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
