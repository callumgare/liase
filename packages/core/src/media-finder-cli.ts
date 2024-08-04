#!/usr/bin/env node
import { Command, Option } from "commander";
import open from "open";
import "dotenv-flow/config";
import http, { Server } from "node:http";
import { ProxyServer } from "@refactorjs/http-proxy";
import { tsImport } from "tsx/esm/api";

import {
  MediaFinder,
  Source,
  Plugin,
  GenericRequest,
  RequestHandler,
  createMediaFinderQuery,
  MediaFinderQuery,
} from "./index.js";
import { zodSchemaToSimpleSchema } from "./lib/zod.js";
import { z } from "zod";

const { source, requestHandler, plugins } = await getRequestHandlerFromArgs();

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
).makeOptionMandatory(true);

const mediaFinder = new MediaFinder({ plugins });
sourceOption.choices(mediaFinder.sources.map((source) => source.id));

if (source) {
  requestHandlerOption.choices(
    source.requestHandlers.map((handler) => handler.id),
  );
}

const program = new Command();

/***********************
 * Run subcommand
 **********************/

const runCommand = new Command();

runCommand
  .name("run")
  .addOption(sourceOption)
  .addOption(requestHandlerOption)
  .addOption(pluginsOption)
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
    const response = await getMediaFinderQuery(options).getNext();

    if (response === null) {
      throw Error("No response received");
    } else if (options.outputFormat === "pretty") {
      console.dir(response, { depth: null });
    } else if (options.outputFormat === "json") {
      console.log(JSON.stringify(response, null, 2));
    } else if (options.outputFormat === "online") {
      const { origin: proxyOrigin } = await startProxyServer();

      for (const media of response.media || []) {
        for (const file of media.files || []) {
          file.url = proxyOrigin + "/" + file.url;
        }
      }

      const res = await fetch(
        `https://mediafinderviewer.cals.cafe/api/output`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(response),
        },
      );
      const { viewerUrl } = await res.json();
      open(viewerUrl);
    } else {
      throw Error(`Unknown output format "${options.outputFormat}"`);
    }
  });

if (requestHandler) {
  const simpleSchema = zodSchemaToSimpleSchema(requestHandler.requestSchema);
  if (simpleSchema.type !== "object") {
    throw Error("Internal error: Request schema was not an object");
  }
  const requestOpts = Object.entries(simpleSchema.children);
  for (const [name, requestOption] of requestOpts) {
    if (["source", "queryType"].includes(name)) continue;

    let valueType;
    let valueParser;
    let choices;

    if (
      Array.isArray(requestOption.type) &&
      requestOption.type.every((subtype) => subtype.type === "literal")
    ) {
      choices = requestOption.type.map((unionSubtype) =>
        String(unionSubtype.value),
      );

      // Add all subtypes to a set to work out the list of unique subtypes
      const unionSubtypes = new Set(
        requestOption.type.map((subtype) => subtype.valueType),
      );

      valueType = [...unionSubtypes].join(" | ");
    } else {
      valueType = requestOption.type;
    }

    if (valueType === "number") {
      valueParser = parseFloat;
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

program.addCommand(runCommand);

/***********************
 * Show schema subcommand
 **********************/

const showSchemaCommand = new Command();

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

    let schema;
    if (options.schemaType === "request") {
      schema = requestHandler.requestSchema;
    } else if (options.schemaType === "secrets") {
      schema = requestHandler.secretsSchema || z.object({}).strict();
    } else if (options.schemaType === "response") {
      const mediaFinderQuery = getMediaFinderQuery(options);
      schema = mediaFinderQuery.getResponseDetails().schema;
    } else {
      throw Error(`Unknown schema type option "${options.schemaType}"`);
    }

    const simpleSchema = zodSchemaToSimpleSchema(schema);
    console.dir(simpleSchema, { depth: null });
  });

program.addCommand(showSchemaCommand);

/***********************
 * Execute
 **********************/

program.parseAsync();

/***********************
 * Helper functions
 **********************/

async function getRequestHandlerFromArgs(): Promise<{
  source?: Source;
  requestHandler?: RequestHandler;
  plugins: Plugin[];
}> {
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

  let sourceId: string = "";
  let requestHandlerId: string = "";
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

  try {
    program.parse();
  } catch (error) {
    // We don't care if there's an error
  }

  const plugins = await Promise.all(
    pluginFilePaths.map(
      async (pluginFilePath) => await tsImport(pluginFilePath, import.meta.url),
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
    source?.requestHandlers.find((handler) => handler.id === requestHandlerId);

  if (source && requestHandlerId && !requestHandler) {
    throw Error(`Could not find request handler for "${requestHandlerId}"`);
  }

  return { source, requestHandler, plugins };
}

function startProxyServer(): Promise<{ origin: string; server: Server }> {
  const proxy = new ProxyServer();

  proxy.on("proxyRes", function (proxyRes, req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    proxyRes.pipe(res);
  });
  const server = http.createServer((req, res) => {
    const targetUrlString = req.url?.replace(/^\//, "") || "";
    let targetUrl;
    try {
      targetUrl = new URL(targetUrlString);
    } catch (error) {
      res.statusCode = 400;
      res.end(`Invalid url "${targetUrlString}"`);
      return;
    }
    req.url = targetUrl.pathname + targetUrl.search;
    proxy.web(req, res, {
      target: targetUrl.origin,
      changeOrigin: true,
      secure: false,
      selfHandleResponse: true,
    });
  });

  process.on("SIGINT", function () {
    server.close();
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.on("listening", () => {
      const address = server.address();
      if (address === null) {
        throw Error("Could not create proxy server");
      }
      const formattedAddress =
        typeof address === "object"
          ? `http://localhost:${address.port}`
          : address;
      resolve({
        server,
        origin: formattedAddress,
      });
    });

    server.listen();
  });
}

function getMediaFinderQuery(
  options: Record<string, unknown>,
): MediaFinderQuery {
  const { requestHandler: queryType, ...request } = options;
  request.queryType = queryType;
  // Delete unneeded global variables
  delete request.plugins;
  delete request.outputFormat;

  return createMediaFinderQuery({
    request: request as GenericRequest,
    queryOptions: {
      secrets: {
        apiKey: process.env.GIPHY_API_KEY,
      },
    },
    finderOptions: {
      plugins,
    },
  });
}
