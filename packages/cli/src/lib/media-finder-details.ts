import { Command, Option } from "commander";
import {
	MediaFinder,
	type Plugin,
	type RequestHandler,
	type Source,
} from "media-finder";
import { tsImport } from "tsx/esm/api";

type MediaFinderDetails = {
	source?: Source;
	requestHandler?: RequestHandler;
	plugins: Plugin[];
};

// In order to add more details to the help text of some command and their arguments
// we want to look some some details of some of the args the user may have given us.
// For example if viewing the help text of the "run" command and they've also given
// us the "--source" argument with the value "bluesky" then we want the list of valid
// options for the "--requestHandler" to show only the request handlers provided by
// the bluesky source. But to do this we need to first parse what options the user has
// given us.

// We normally can't do this before we define all the details for our commands
// so to get around this we create a "shadow" command object with the subcommands and
// subcommand options we care about, parse this in order to determine which values
// the user has given us, then finally we lookup any relevant info based on this and
// return it so it can be used for building our actual options.
let cachedMediaFinderDetails: MediaFinderDetails | undefined = undefined;
export async function getMediaFinderDetailsFromArgs(): Promise<MediaFinderDetails> {
	if (!cachedMediaFinderDetails) {
		const program = new Command();
		const silenceCommand = (command: Command) =>
			command
				.helpCommand(false)
				.helpOption("")
				.exitOverride()
				.configureOutput({
					writeOut: () => {},
					writeErr: () => {},
					outputError: () => {},
				})
				.allowUnknownOption();

		silenceCommand(program);

		let sourceId = "";
		let requestHandlerId = "";
		let pluginFilePaths: string[] = [];

		function addSubcommand(program: Command, subcommandName: string) {
			const command = new Command();
			command
				.name(subcommandName)
				.option("-s, --source <source id>")
				.option("-r, --requestHandler <request handler id>")
				.option("-p, --plugins <comma separated list of filepaths to plugins>")
				.action((options) => {
					sourceId = options.source;
					requestHandlerId = options.requestHandler;
					pluginFilePaths = options.plugins?.split(",") || [];
				});
			silenceCommand(command);
			program.addCommand(command);
			return command;
		}

		addSubcommand(program, "run");
		addSubcommand(program, "show-schema");
		addSubcommand(program, "web-ui");

		try {
			program.parse();
		} catch (error) {
			// We don't care if there's an error
		}

		const plugins = await Promise.all(
			pluginFilePaths.map(
				async (pluginFilePath) =>
					await tsImport(pluginFilePath, import.meta.url),
			),
		).then((modules) => modules.map((module) => module.default));

		const mediaFinder = new MediaFinder({ plugins });

		const source: Source | undefined = mediaFinder.sources.find(
			(source) => source.id === sourceId,
		);

		if (sourceId && !source) {
			throw Error(`Could not find source for "${sourceId}"`);
		}

		const requestHandler: RequestHandler | undefined =
			source?.requestHandlers.find(
				(handler) => handler.id === requestHandlerId,
			);

		if (source && requestHandlerId && !requestHandler) {
			throw Error(`Could not find request handler for "${requestHandlerId}"`);
		}
		cachedMediaFinderDetails = { source, requestHandler, plugins };
	}

	return cachedMediaFinderDetails;
}

export function getSharedMediaFinderOptions({
	source,
	plugins,
}: MediaFinderDetails) {
	const sourceOption = new Option(
		"-s, --source <source id>",
		"Media finder source ID",
	).makeOptionMandatory(true);

	const requestHandlerOption = new Option(
		"-r, --requestHandler <request handler id>",
		"ID of the request handler",
	).makeOptionMandatory(true);

	const pluginsOption = new Option(
		"-p, --plugins <comma separated list of filepaths to plugins>",
		"Plugins to load",
	);

	const secretsSetOption = new Option(
		"--secretsSet <secrets set name>",
		"Finds secrets set with given name and uses secrets in query",
	);

	const cacheNetworkRequestsOption = new Option(
		"--cacheNetworkRequests <caching option>",
		`"never" will never cache network requests, "auto" will cache requests that seem like they might be cacheable and store them for as long as they seem fresh, ` +
			`"always" will always cache requests with no expiry.`,
	)
		.choices(["never", "auto", "always"])
		.default("always");

	const mediaFinder = new MediaFinder({ plugins });
	sourceOption.choices(mediaFinder.sources.map((source) => source.id));

	if (source) {
		requestHandlerOption.choices(
			source.requestHandlers.map((handler) => handler.id),
		);
	}

	return {
		sourceOption,
		requestHandlerOption,
		pluginsOption,
		cacheNetworkRequestsOption,
		secretsSetOption,
	};
}
