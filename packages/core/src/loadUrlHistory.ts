import path from "node:path";
import os from "node:os";
import { loadUrl, LoadUrlResponse } from "./loadUrl.js";
import fs from "node:fs/promises";

export type LoadUrlHistoryItem = {
  constructorPath: (string | number)[];
  url: string;
  options: Parameters<typeof loadUrl>[1];
  response: LoadUrlResponse;
};

export async function exportLoadUrlHistory({
  loadUrlHistory,
}: {
  loadUrlHistory: LoadUrlHistoryItem[];
}) {
  if (!loadUrlHistory.length) {
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
  for (const loadUrlHistoryItem of loadUrlHistory) {
    const constructorPath = loadUrlHistoryItem.constructorPath.join(".");
    if (!constructorPathCount[constructorPath]) {
      constructorPathCount[constructorPath] = 1;
    } else {
      constructorPathCount[constructorPath]++;
    }
    const filename = path.join(
      tmpDir,
      [
        loadUrlHistoryItem.constructorPath
          .map((value) => (typeof value === "number" ? `[${value}]` : value))
          .join("."),
        constructorPathCount[constructorPath],
        loadUrlHistoryItem.url
          .replaceAll(/(?:^https?:\/\/|\/+$)/g, "")
          .replaceAll("/", "."),
      ].join("_") + ".html",
    );
    let body;
    if ("data" in loadUrlHistoryItem.response) {
      if (typeof loadUrlHistoryItem.response.data === "string") {
        body = loadUrlHistoryItem.response.data;
      } else {
        body = JSON.stringify(loadUrlHistoryItem.response.data);
      }
    } else if ("root" in loadUrlHistoryItem.response) {
      body = loadUrlHistoryItem.response.root.nativeSelector.html() ?? "";
    } else {
      loadUrlHistoryItem.response satisfies never;
      throw Error("Internal error");
    }
    await fs.writeFile(filename, body);
  }
  console.info(
    "To assist with debugging all requests made with loadUrl have been exported to:",
    tmpDir,
  );
}
