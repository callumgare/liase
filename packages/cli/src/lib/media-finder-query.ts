import {
	type GenericRequest,
	type MediaFinderQuery,
	type Plugin,
	createMediaFinderQuery,
} from "media-finder";
import cachingNetworkPlugin, {
	setupCachingProxy,
	cachingProxyDetected,
} from "media-finder/dist/plugins/cache-network.js";
import { getMediaFinderDetailsFromArgs } from "./media-finder-details.js";
import { getSecretsSets } from "./secrets.js";

export async function getMediaFinderQuery({
	request,
	secretsSet,
	noCachingPlugin,
	loadPluginsFromArgs,
}: {
	request: Record<string, unknown>;
	secretsSet?: string;
	noCachingPlugin?: boolean;
	loadPluginsFromArgs?: boolean;
}): Promise<MediaFinderQuery> {
	const plugins: Plugin[] = [];
	if (loadPluginsFromArgs) {
		const mediaFinderDetails = await getMediaFinderDetailsFromArgs();
		plugins.push(...mediaFinderDetails.plugins);
	}
	if (!noCachingPlugin) {
		if (!cachingProxyDetected()) {
			const { cleanup } = await setupCachingProxy();

			process.on("SIGINT", cleanup);
			process.on("SIGQUIT", cleanup);
			process.on("SIGTERM", cleanup);
		}
		plugins.push(cachingNetworkPlugin);
	}
	let secrets = {};
	if (secretsSet) {
		const secretsSets = await getSecretsSets();
		secrets = secretsSets[secretsSet];
	}
	if (request.requestHandler) {
		request.queryType = request.requestHandler;
		// biome-ignore lint/performance/noDelete: Performance isn't really a concern here
		delete request.requestHandler;
	}

	return createMediaFinderQuery({
		request: request as GenericRequest,
		queryOptions: {
			secrets,
		},
		finderOptions: {
			plugins,
		},
	});
}
