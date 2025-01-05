import { Command, Option } from "commander";
import open from "open";
import {
	getMediaFinderDetailsFromArgs,
	getRequestFromArgs,
	getSharedMediaFinderOptions,
} from "../lib/media-finder-details.js";
import { getMediaFinderQuery } from "../lib/media-finder-query.js";
import { startProxyServer } from "../lib/proxy.js";
import { zodSchemaToSimpleSchema } from "../lib/zod.js";

export async function getRunCommand(): Promise<Command> {
	const runCommand = new Command();
	const mediaFinderDetails = await getMediaFinderDetailsFromArgs();
	const {
		sourceOption,
		requestHandlerOption,
		pluginsOption,
		cacheNetworkRequestsOption,
		secretsSetOption,
	} = getSharedMediaFinderOptions(mediaFinderDetails);
	runCommand
		.name("run")
		.addOption(sourceOption)
		.addOption(requestHandlerOption)
		.addOption(pluginsOption)
		.addOption(cacheNetworkRequestsOption)
		.addOption(secretsSetOption)
		.addOption(
			new Option(
				"-f, --outputFormat <output format>",
				`"JSON" will format the output as JSON, "pretty" will format the output in a more human readable way with syntax highlighting, ` +
					`"online" will open a webpage with the results visible. Default is "pretty" unless output is being piped in which case the default is "json".`,
			)
				.choices(["json", "pretty", "online"])
				.default(process.stdout.isTTY ? "pretty" : "json"),
		)
		.action(async (options) => {
			const { outputFormat, cacheNetworkRequests, secretsSet } = options;
			const request = getRequestFromArgs(
				options,
				mediaFinderDetails.requestHandler,
			);
			const query = await getMediaFinderQuery({
				request,
				loadPluginsFromArgs: true,
				cacheNetworkRequests,
				secretsSet,
			});
			const response = await query.getNext();

			if (response === null) {
				throw Error("No response received");
			}
			if (outputFormat === "pretty") {
				console.dir(response, { depth: null });
			} else if (outputFormat === "json") {
				console.log(JSON.stringify(response, null, 2));
			} else if (outputFormat === "online") {
				const { origin: proxyOrigin } = await startProxyServer();

				for (const media of response.media || []) {
					for (const file of media.files || []) {
						file.url = `${proxyOrigin}/${file.url}`;
					}
				}

				const res = await fetch(
					"https://mediafinderviewer.cals.cafe/api/output",
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify(response),
					},
				);
				const data = await res.json();
				if (
					data &&
					typeof data === "object" &&
					"viewerUrl" in data &&
					typeof data.viewerUrl === "string"
				) {
					open(data.viewerUrl);
				} else {
					throw Error("Invalid response for server");
				}
			} else {
				throw Error(`Unknown output format "${outputFormat}"`);
			}
		});

	const { requestHandler } = mediaFinderDetails;

	if (requestHandler) {
		const simpleSchema = zodSchemaToSimpleSchema(requestHandler.requestSchema);
		if (simpleSchema.type !== "object") {
			throw Error("Internal error: Request schema was not an object");
		}
		const requestOpts = Object.entries(simpleSchema.children);
		for (const [name, requestOption] of requestOpts) {
			if (["source", "queryType"].includes(name)) continue;

			let valueType: string;
			let valueParser: ((string: string) => number) | undefined = undefined;
			let choices: string[] | undefined = undefined;

			if (Array.isArray(requestOption.type)) {
				if (requestOption.type.every((subtype) => subtype.type === "literal")) {
					choices = requestOption.type.map((unionSubtype) =>
						String(unionSubtype.value),
					);

					// Add all subtypes to a set to work out the list of unique subtypes
					const unionSubtypes = new Set(
						requestOption.type.map((subtype) => subtype.valueType),
					);

					valueType = [...unionSubtypes].join(" | ");
				} else {
					// TODO: Deal with this case
					valueType = "unknown";
				}
			} else {
				valueType = requestOption.type;
			}

			if (valueType === "number") {
				valueParser = Number.parseFloat;
			}

			const flagDetails =
				valueType === "boolean" ? `--${name}` : `--${name} <${valueType}>`;
			const description = [
				requestOption.description,
				requestOption.optional ? undefined : "(required)",
			]
				.filter((part) => part)
				.join(" ");

			const option = new Option(flagDetails, description);

			if (requestOption.default !== undefined) {
				option.default(requestOption.default);
			}
			option.makeOptionMandatory(!requestOption.optional);
			if (valueParser) {
				option.argParser(valueParser);
			}
			if (choices) {
				option.choices(choices);
			}
			runCommand.addOption(option);
		}
	}
	return runCommand;
}
