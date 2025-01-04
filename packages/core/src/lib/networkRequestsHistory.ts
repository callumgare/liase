import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import mimeTypes from "mime-types";
import { timeSince } from "./time.js";
import chalk from "chalk";

export type NetworkRequestsHistoryItem = {
  constructorPath: (string | number)[];
  request: {
    url: URL;
    method: string;
    headers: Record<string, string>;
    body?: string | Promise<string>;
  };
  response: {
    headers: Record<string, string>;
    body: string | Promise<string>;
    statusCode: number;
    cached: boolean;
    cachedOn: Date | null;
  };
};

export async function exportNetworkRequestsHistory({
  networkRequestsHistory,
}: {
  networkRequestsHistory: NetworkRequestsHistoryItem[];
}) {
  if (!networkRequestsHistory.length) {
    return;
  }
  const tmpDir = path.join(
    os.tmpdir(),
    "media-finder-exports",
    Date.now().toString(),
  );
  try {
    await fs.access(tmpDir);
  } catch (error) {
    await fs.mkdir(tmpDir, { recursive: true });
  }
  const constructorPathCount: Record<string, number> = {};
  for (const networkRequestsHistoryItem of networkRequestsHistory) {
    const constructorPath =
      networkRequestsHistoryItem.constructorPath.join(".");
    if (!constructorPathCount[constructorPath]) {
      constructorPathCount[constructorPath] = 1;
    } else {
      constructorPathCount[constructorPath]++;
    }
    const mimeType =
      networkRequestsHistoryItem.response.headers["content-type"];
    const ext = mimeTypes.extension(mimeType ?? "") || "txt";
    const filename = path.join(
      tmpDir,
      [
        networkRequestsHistoryItem.constructorPath
          .map((value) => (typeof value === "number" ? `[${value}]` : value))
          .join("."),
        constructorPathCount[constructorPath],
        networkRequestsHistoryItem.request.url.href
          .replaceAll(/(?:^\w+:\/\/|\/+$)/g, "")
          .replaceAll("/", "."),
      ].join("_") +
        "." +
        ext,
    );
    let body;
    if (ext === "json") {
      body = JSON.stringify(
        JSON.parse(await networkRequestsHistoryItem.response.body),
        null,
        2,
      );
    } else {
      body = await networkRequestsHistoryItem.response.body;
    }
    await fs.writeFile(filename, body);
    await fs.writeFile(
      filename + ".metadata.txt",
      [
        "Request URL: " + networkRequestsHistoryItem.request.url.href,
        "",
        "Request method: " + networkRequestsHistoryItem.request.method,
        "",
        "Request headers:",
        Object.entries(networkRequestsHistoryItem.request.headers)
          .map(([key, value]) => `  ${key}: ${value}`)
          .join("\n"),
        "",
        "Response cached: " +
          (networkRequestsHistoryItem.response.cachedOn
            ? `Yes (${timeSince(networkRequestsHistoryItem.response.cachedOn)})`
            : "No"),
        "",
        "Response headers:",
        Object.entries(networkRequestsHistoryItem.response.headers)
          .map(([key, value]) => `  ${key}: ${value}`)
          .join("\n"),
        "",
        "Status code: " + networkRequestsHistoryItem.response.statusCode,
      ].join("\n"),
    );
  }
  console.info(
    chalk.bold(
      "To assist with debugging all requests made with loadUrl have been exported to:",
    ),
    tmpDir,
  );
}
