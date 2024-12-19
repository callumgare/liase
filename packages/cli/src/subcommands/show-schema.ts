import { Command, Option } from "commander";
import { z } from "zod";
import {
	getMediaFinderDetailsFromArgs,
	getSharedMediaFinderOptions,
} from "../lib/media-finder-details.js";
import { getMediaFinderQuery } from "../lib/media-finder-query.js";
import { zodSchemaToSimpleSchema } from "../lib/zod.js";

export async function getShowSchemaCommand(): Promise<Command> {
	const showSchemaCommand = new Command();
	const mediaFinderDetails = await getMediaFinderDetailsFromArgs();
	const { sourceOption, requestHandlerOption, pluginsOption } =
		getSharedMediaFinderOptions(mediaFinderDetails);
	const { requestHandler } = mediaFinderDetails;
	showSchemaCommand
		.name("show-schema")
		.addOption(sourceOption)
		.addOption(requestHandlerOption)
		.addOption(
			new Option(
				"-t, --schemaType <schemaType>",
				'Type of schema to return. If type is "response" then any required request options must be given in order to determine which response schema will be returned',
			)
				.choices(["request", "secrets", "response"])
				.default("response"),
		)
		.action(async (options) => {
			if (!requestHandler) {
				throw Error(
					"Internal error: Trying to show schema without request handler being set first",
				);
			}

			let schema: z.AnyZodObject;
			if (options.schemaType === "request") {
				schema = requestHandler.requestSchema;
			} else if (options.schemaType === "secrets") {
				schema = requestHandler.secretsSchema || z.object({}).strict();
			} else if (options.schemaType === "response") {
				const { plugins, outputFormat, request } = options;
				const mediaFinderQuery = await getMediaFinderQuery({
					request,
					loadPluginsFromArgs: true,
				});
				schema = mediaFinderQuery.getResponseDetails().schema;
			} else {
				throw Error(`Unknown schema type option "${options.schemaType}"`);
			}

			const simpleSchema = zodSchemaToSimpleSchema(schema);
			console.dir(simpleSchema, { depth: null });
		});
	return showSchemaCommand;
}
