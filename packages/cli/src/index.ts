#!/usr/bin/env node
import { Command } from "commander";

import { getRunCommand } from "./subcommands/run.js";
import { getShowSchemaCommand } from "./subcommands/show-schema.js";
import { getWebUiCommand } from "./subcommands/web-ui.js";

const program = new Command();

program.addCommand(await getRunCommand());
program.addCommand(await getShowSchemaCommand());
program.addCommand(await getWebUiCommand());

program.parseAsync();
