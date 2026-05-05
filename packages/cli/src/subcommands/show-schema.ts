import { Command, Option } from "commander";
import { z } from "zod";
import {
  getLiasonDetailsFromArgs,
  getSharedLiasonOptions,
} from "../lib/liason-details.js";
import { getLiasonQuery } from "../lib/liason-query.js";
import { zodSchemaToSimpleSchema } from "../lib/zod.js";

export async function getShowSchemaCommand(): Promise<Command> {
  const showSchemaCommand = new Command();
  const liasonDetails = await getLiasonDetailsFromArgs();
  const { sourceOption, requestHandlerOption, pluginsOption } =
    getSharedLiasonOptions(liasonDetails);
  const { requestHandler } = liasonDetails;
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
        const liasonQuery = await getLiasonQuery({
          request,
          loadPluginsFromArgs: true,
        });
        schema = liasonQuery.getResponseDetails().schema;
      } else {
        throw Error(`Unknown schema type option "${options.schemaType}"`);
      }

      const simpleSchema = zodSchemaToSimpleSchema(schema);
      console.dir(simpleSchema, { depth: null });
    });
  return showSchemaCommand;
}
