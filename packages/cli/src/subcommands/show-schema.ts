import { Command, Option } from "commander";
import { z } from "zod";
import {
  getLiaseDetailsFromArgs,
  getSharedLiaseOptions,
} from "../lib/liase-details.js";
import { getLiaseQuery } from "../lib/liase-query.js";
import { zodSchemaToSimpleSchema } from "../lib/zod.js";

export async function getShowSchemaCommand(): Promise<Command> {
  const showSchemaCommand = new Command();
  const liaseDetails = await getLiaseDetailsFromArgs();
  const { sourceOption, requestHandlerOption, pluginsOption } =
    getSharedLiaseOptions(liaseDetails);
  const { requestHandler } = liaseDetails;
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
        const liaseQuery = await getLiaseQuery({
          request,
          loadPluginsFromArgs: true,
        });
        schema = liaseQuery.getResponseDetails().schema;
      } else {
        throw Error(`Unknown schema type option "${options.schemaType}"`);
      }

      const simpleSchema = zodSchemaToSimpleSchema(schema);
      console.dir(simpleSchema, { depth: null });
    });
  return showSchemaCommand;
}
