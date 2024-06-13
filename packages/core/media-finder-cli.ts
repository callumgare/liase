#!/usr/bin/env npx tsx --no-warnings
import { Command, Option } from 'commander';
import open from 'open';
import { MediaFinder, Source, RequestHandler, createMediaFinderQuery } from "./src/index.js";
import { zodSchemaToSimpleSchema } from "./src/utils.js"

const {source, requestHandler} = getRequestHandlerFromArgs()

const sourceOption = (new Option('-s, --source <source id>', 'Media finder source ID'))
  .makeOptionMandatory(true)
const requestHandlerOption = (new Option('-r, --requestHandler <request handler id>', 'ID of the request handler'))
  .makeOptionMandatory(true)


const mediaFinder = new MediaFinder()
sourceOption.choices(
  mediaFinder.sources.map(source => source.id)
)

if (source) {
  requestHandlerOption.choices(
    source.requestHandlers.map(handler => handler.id)
  )
}


const program = (new Command())



/***********************
 * Run subcommand
 **********************/

const runCommand = new Command()

runCommand
  .name("run")
  .addOption(sourceOption)
  .addOption(requestHandlerOption)
  .addOption(
    (new Option('-f, --outputFormat <output format>'))
      .choices(["pretty", "json", "online"])
      .default("pretty")
  )
  .action(async (options) => {
    const {requestHandler: queryType, outputFormat, ...request} = options
    request.queryType = queryType

    const response = await createMediaFinderQuery({
      request,
      queryOptions: {
        secrets: {
          apiKey: process.env.GIPHY_API_KEY,
        }
      }
    }).getNext()

    if (outputFormat === "pretty") {
      console.dir(response, {depth: null})
    } else if (outputFormat === "json") {
      console.log(JSON.stringify(response, null, 2))
    } else if (outputFormat === "online") {
      const mediaUrlList = response.media?.map(media => media.files[0]?.url).join("\n")
      open(`https://medialistviewer.glitch.me/?data=${encodeURIComponent(mediaUrlList)}`)
    } else {
      throw Error(`Unknown output format "${outputFormat}"`)
    }
  })

if (requestHandler) {
  const requestOpts = Object.entries(zodSchemaToSimpleSchema(requestHandler.requestSchema).children);
  for (const [name, requestOption] of requestOpts) {
    if (["source", "queryType"].includes(name)) continue;
    const flagDetails = requestOption.type === "boolean" ? `--${name}` : `--${name} <${requestOption.type}>`
    const description = [
      requestOption.description,
      requestOption.optional ? undefined : "(required)"
    ].filter(part => part).join(" ")

    const option = new Option(flagDetails, description)

    if (requestOption.default !== undefined) {
      option.default(requestOption.default)
    }
    option
      .makeOptionMandatory(!requestOption.optional)
    if (requestOption.type === "number") {
      option.argParser(parseFloat)
    } else if (Array.isArray(requestOption.type) && requestOption.type.every(subtype => subtype.type === "literal")) {
      option.choices(
        requestOption.type.map(unionSubtype => unionSubtype.value)
      )
      // Type of union subtypes if all subtypes are of the same type (e.g union is all strings or all numbers)
      const sharedUnionSubtype = requestOption.type.every(
        subtype => subtype.valueType === requestOption.type[0]?.valueType
      )
      if (sharedUnionSubtype === "number") {
        option.argParser(parseFloat)
      }
    }
    runCommand.addOption(option)
  }
}

program.addCommand(runCommand)



/***********************
 * Show schema subcommand
 **********************/

const showSchemaCommand = new Command()

showSchemaCommand
  .name("show-schema")
  .addOption(sourceOption)
  .addOption(requestHandlerOption)
  .addOption(
    (new Option("-t, --schemaType <schemaType>", "Type of schema to return"))
      .choices(["request", "secrets", "response"])
      .default("response")
  )
  .action(async (options) => {
    const schemaPropKey = {
      "request": "requestSchema",
      "secrets": "secretsSchema",
      "response": "responseSchema"
    }[options.schemaType]

    const {source, queryType, ...otherProps } = zodSchemaToSimpleSchema(requestHandler[schemaPropKey]).children
    console.dir(otherProps, { depth: null })
  })

program.addCommand(showSchemaCommand)

/***********************
 * Execute
 **********************/

program.parseAsync()


/***********************
 * Helper functions
 **********************/

function getRequestHandlerFromArgs(): {source?: Source, requestHandler?: RequestHandler} {
  const program = new Command()
  const silenceCommand = (command) => command
    .helpCommand(false)
    .helpOption('')
    .exitOverride()
    .configureOutput({
      writeOut: () => {},
      writeErr: () => {},
      outputError: () => {},
    })
    .allowUnknownOption()

  silenceCommand(program)

  let sourceId: string
  let requestHandlerId: string

  function addSubcommand(program, subcommandName) {
    const command = new Command();
    command
      .name(subcommandName)
      .option('-s, --source <source id>')
      .option('-r, --requestHandler <request handler id>')
      .action((options) => {
        sourceId = options.source
        requestHandlerId = options.requestHandler
      })
    silenceCommand(command)
    program.addCommand(command)
    return command
  }

  addSubcommand(program, "run")
  addSubcommand(program, "show-schema")

  try {
    program.parse()
  } catch (error) {
    // We don't care if there's an error
  }

  const mediaFinder = new MediaFinder()
  const source: Source = sourceId && mediaFinder.sources.find(source => source.id === sourceId)
  const requestHandler: RequestHandler = source?.requestHandlers.find(handler => handler.id === requestHandlerId)

  return {source, requestHandler}
}
