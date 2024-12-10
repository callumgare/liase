import http from "node:http";
import { createMediaFinderQuery } from "../../src/index.js";
import fs from "node:fs/promises";
import path from "node:path";
import cachingNetworkPlugin from "@/src/plugins/cache-network.js";
import { getSecrets } from "../utils/general.js";
import mimeTypes from "mime-types";

const buildId = Date.now();

const server = http
  .createServer(async function (req, res) {
    if (req.url === "/build-id") {
      res.writeHead(200, {
        "Content-Type": "text/application/json",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(JSON.stringify(buildId));
    } else if (req.method === "POST") {
      console.log(`${req.method} ${req.url}`);
      return handleMediaQueryRequest(req, res);
    } else if (req.method === "GET") {
      console.log(`${req.method} ${req.url}`);
      return handleStaticFileRequest(req, res);
    }
  })
  .listen(4000);
const serverAddress = server.address();
console.log(
  "Server listening:",
  `http://localhost:${typeof serverAddress === "object" && serverAddress?.port}`,
);

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
    const mediaFinderRequest = JSON.parse(body);
    const response = await createMediaFinderQuery({
      request: mediaFinderRequest,
      queryOptions: {
        secrets: await getSecrets(mediaFinderRequest),
      },
      finderOptions: {
        plugins: [cachingNetworkPlugin],
      },
    }).getNext();
    res.writeHead(200, {
      "Content-Type": "text/application/json",
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
  let pathname = path.join(import.meta.dirname, sanitizePath);

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

function cleanup() {
  server.close();
}
process.on("SIGINT", cleanup);
process.on("SIGQUIT", cleanup);
process.on("SIGTERM", cleanup);
