import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import util from "node:util";
import { Liase } from "@liase/core";
import AnsiToHtml from "ansi-to-html";
import { Command, Option } from "commander";
import mimeTypes from "mime-types";
import {
  getLiaseDetailsFromArgs,
  getSharedLiaseOptions,
} from "../lib/liase-details.js";
import { getLiaseQuery } from "../lib/liase-query.js";
import { getSecretsSets } from "../lib/secrets.js";
import { zodSchemaToSimpleSchema } from "../lib/zod.js";

export async function getWebUiCommand(): Promise<Command> {
  const webUiCommand = new Command();
  const { pluginsOption } = getSharedLiaseOptions({ plugins: [] });
  webUiCommand
    .name("web-ui")
    .addOption(pluginsOption)
    .addOption(
      new Option("--port <port>", "Port to listen on")
        .default(4000)
        .argParser(Number),
    )
    .action(async (options) => {
      await startServer(options.port);
    });
  return webUiCommand;
}

function startServer(port = 4000): Promise<void> {
  const buildId = Date.now();

  const server = http
    .createServer(async (req, res) => {
      if (req.method === "GET" && req.url === "/build-id") {
        res.writeHead(200, {
          "Content-Type": "text/application/json",
          "Access-Control-Allow-Origin": "*",
        });
        res.end(JSON.stringify(buildId));
      } else if (req.method === "GET" && req.url === "/secrets-sets") {
        return handleSecretSetsRequest(req, res);
      } else if (req.method === "GET" && req.url === "/sources") {
        return handleSourcesRequest(req, res);
      } else if (req.method === "POST") {
        console.log(`${req.method} ${req.url}`);
        return handleMediaQueryRequest(req, res);
      } else if (req.method === "GET") {
        console.log(`${req.method} ${req.url}`);
        return handleStaticFileRequest(req, res);
      }
    })
    .listen(port);

  return new Promise((resolve, reject) => {
    server.once("listening", () => {
      const serverAddress = server.address();
      console.log(
        "Server listening:",
        `http://localhost:${typeof serverAddress === "object" && serverAddress?.port}`,
      );
    });

    function cleanup() {
      server.close();
    }
    process.on("SIGINT", cleanup);
    process.on("SIGQUIT", cleanup);
    process.on("SIGTERM", cleanup);

    server.on("close", resolve);
  });
}

async function handleSecretSetsRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse<http.IncomingMessage> & {
    req: http.IncomingMessage;
  },
) {
  const secretSets = await getSecretsSets();
  res.writeHead(200, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(Object.keys(secretSets)));
}

async function handleSourcesRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse<http.IncomingMessage> & {
    req: http.IncomingMessage;
  },
) {
  const { plugins } = await getLiaseDetailsFromArgs();
  const liase = new Liase({ plugins });
  const sources = liase.sources.map((source) => ({
    id: source.id,
    displayName: source.displayName,
    description: source.description,
    requestHandlers: source.requestHandlers.map((handler) => {
      const fullSchema = zodSchemaToSimpleSchema(handler.requestSchema);
      if (fullSchema.type !== "object") {
        throw new Error(
          `Expected object schema for request handler ${handler.id}`,
        );
      }
      const schemaFields = Object.fromEntries(
        Object.entries(fullSchema.children).filter(
          ([key]) => key !== "source" && key !== "queryType",
        ),
      );
      return {
        id: handler.id,
        displayName: handler.displayName,
        description: handler.description,
        schemaFields,
      };
    }),
  }));
  res.writeHead(200, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(sources));
}

function handleMediaQueryRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse<http.IncomingMessage> & {
    req: http.IncomingMessage;
  },
) {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });
  req.on("end", async () => {
    const { liaseRequest, secretsSet, cacheNetworkRequests } = JSON.parse(body);
    let response: unknown;
    try {
      const query = await getLiaseQuery({
        request: liaseRequest,
        secretsSet,
        loadPluginsFromArgs: true,
        cacheNetworkRequests,
      });
      response = await query.getNext();
    } catch (error) {
      res.writeHead(400, {
        "Content-Type": "text/application/json",
        "Access-Control-Allow-Origin": "*",
      });
      const errorString = new AnsiToHtml({
        fg: "#000",
        bg: "#888",
        newline: true,
      }).toHtml(util.inspect(error));
      console.log(error);
      res.end(JSON.stringify({ error: errorString }));
      return;
    }
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(JSON.stringify(response));
  });
}

async function handleStaticFileRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse<http.IncomingMessage> & {
    req: http.IncomingMessage;
  },
) {
  // parse URL
  const parsedUrl = new URL(req.url || "", "http://domain");

  const sanitizePath = path
    .normalize(parsedUrl.pathname)
    .replace(/^(\.\.[/\\])+/, "");
  let pathname = path.join(import.meta.dirname, "../web-ui", sanitizePath);

  try {
    await fs.access(pathname);
  } catch (error) {
    // if the file is not found, return 404
    res.statusCode = 404;
    res.end(`File ${pathname} not found!`);
    return;
  }

  // if is a directory, then look for index.html
  if ((await fs.stat(pathname)).isDirectory()) {
    pathname += "/index.html";
  }

  // read file from file system
  try {
    const data = await fs.readFile(pathname);
    // based on the URL path, extract the file extension. e.g. .js, .doc, ...
    const ext = path.parse(pathname).ext;
    // if the file is found, set Content-type and send data
    res.setHeader("Content-type", mimeTypes.lookup(ext) || "text/plain");
    res.end(data);
  } catch (error) {
    res.statusCode = 500;
    res.end(`Error getting the file: ${error}.`);
  }
}
