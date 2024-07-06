#!/usr/bin/env npx -y tsx
import { Command, Option } from 'commander';
import open from 'open';
import 'dotenv-flow/config'
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

    let valueType
    let valueParser
    let choices

    if (Array.isArray(requestOption.type) && requestOption.type.every(subtype => subtype.type === "literal")) {
      choices = requestOption.type.map(unionSubtype => unionSubtype.value)

      // Add all subtypes to a set to work out the list of unique subtypes
      const unionSubtypes = new Set( requestOption.type.map(subtype => subtype.valueType) )

      valueType = [...unionSubtypes].join(" | ")
    } else {
      valueType = requestOption.type
    }

    if (valueType === "number") {
      valueParser = parseFloat
    }

    const flagDetails = valueType === "boolean" ? `--${name}` : `--${name} <${valueType}>`
    const description = [
      requestOption.description,
      requestOption.optional ? undefined : "(required)"
    ].filter(part => part).join(" ")

    const option = new Option(flagDetails, description)

    if (requestOption.default !== undefined) {
      option.default(requestOption.default)
    }
    option.makeOptionMandatory(!requestOption.optional)
    if (valueParser) {
      option.argParser(valueParser)
    }
    if (choices) {
      option.choices(choices)
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

    let arrayOfSchemas
    const schemaOrArrayOfSchema = requestHandler[schemaPropKey]
    if (Array.isArray(schemaOrArrayOfSchema)) {
      arrayOfSchemas = schemaOrArrayOfSchema.map(schemaDetails => schemaDetails.schema)
    } else {
      arrayOfSchemas = schemaOrArrayOfSchema
    }

    for (const [index, schema] of arrayOfSchemas.entries()) {
      const simpleSchema = zodSchemaToSimpleSchema(schema).children
      console.dir(simpleSchema, { depth: null })
      if ((index+1) < arrayOfSchemas.length) {
        console.log("\nOr\n")
      }
    }
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
