import {
  Liase,
  type Plugin,
  type RequestHandler,
  type Source,
} from "@liase/core";
import { Command, Option } from "commander";
import { tsImport } from "tsx/esm/api";

type LiaseDetails = {
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
let cachedLiaseDetails: LiaseDetails | undefined = undefined;
export async function getLiaseDetailsFromArgs(): Promise<LiaseDetails> {
  if (!cachedLiaseDetails) {
    const program = new Command();
    const silenceCommand = (command: Command) =>
      command
        .helpCommand(false)
        .helpOption(false)
        .exitOverride()
        .configureOutput({
          writeOut: () => {},
          writeErr: () => {},
          outputError: () => {},
        })
        .allowUnknownOption()
        .allowExcessArguments(true);

    silenceCommand(program);

    let options: Record<string, unknown> = {};

    function addSubcommand(program: Command, subcommandName: string) {
      const command = new Command();
      command
        .name(subcommandName)
        .option("-s, --source <source id>")
        .option("-r, --requestHandler <request handler id>")
        .option("-p, --plugins <comma separated list of filepaths to plugins>")
        .action((_options) => {
          options = _options;
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
    const sourceId = options.source;
    const requestHandlerId = options.requestHandler;
    const pluginFilePaths =
      typeof options.plugins === "string" ? options.plugins.split(",") : [];

    const plugins = await Promise.all(
      pluginFilePaths
        .filter((path) => path)
        .map(
          async (pluginFilePath) =>
            await tsImport(pluginFilePath, import.meta.url),
        ),
    ).then((modules) => modules.map((module) => module.default));

    const liase = new Liase({ plugins });

    const source: Source | undefined = liase.sources.find(
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
    cachedLiaseDetails = { source, requestHandler, plugins };
  }

  return cachedLiaseDetails;
}

export function getSharedLiaseOptions({ source, plugins }: LiaseDetails) {
  const sourceOption = new Option(
    "-s, --source <source id>",
    "Liase source ID",
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

  const cachedResponseStrategyOption = new Option(
    "--cachedResponseStrategy <strategy>",
    `"never" = never cache, "if-cached" = use cache if available (fetch fresh if miss), "if-fresh" = use cache if available (validate with server), "exclusively" = cache-only (error if miss).`,
  )
    .choices(["never", "if-cached", "if-fresh", "exclusively"])
    .default("if-cached");

  const liase = new Liase({ plugins });
  sourceOption.choices(liase.sources.map((source) => source.id));

  if (source) {
    requestHandlerOption.choices(
      source.requestHandlers.map((handler) => handler.id),
    );
  }

  return {
    sourceOption,
    requestHandlerOption,
    pluginsOption,
    cachedResponseStrategyOption,
    secretsSetOption,
  };
}

export function getRequestFromArgs(
  options: Record<string, unknown>,
  requestHandler?: RequestHandler,
): Record<string, unknown> {
  const request: Record<string, unknown> = {};
  if (requestHandler) {
    for (const key in requestHandler.requestSchema.shape) {
      request[key] = options[key];
    }
  }
  request.queryType = options.requestHandler;
  return request;
}
