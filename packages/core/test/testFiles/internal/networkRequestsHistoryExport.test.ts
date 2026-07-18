import fs from "node:fs/promises";
import { type Server, createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import type { Source } from "@/src/index.js";
import { createLiaseQuery } from "@/src/index.js";
import { afterEach, beforeEach, expect, test } from "vitest";
import { z } from "zod";

let server: Server;
let serverUrl: string;

function startTestServer() {
  return new Promise<void>((resolve) => {
    server = createServer((req, res) => {
      if (req.url === "/page1") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ data: "page1-data" }));
        return;
      }
      if (req.url === "/page2") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ data: "page2-data" }));
        return;
      }
      if (req.url === "/page3") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ data: "page3-data" }));
        return;
      }
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("default response");
    }).listen(0, "127.0.0.1", () => {
      const addr = server.address() as { port: number };
      serverUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
}

function stopTestServer() {
  return new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

const multiLevelErrorSource = {
  id: "multi-level-error",
  displayName: "Multi Level Error Source",
  description: "",
  requestHandlers: [
    {
      id: "test-query",
      displayName: "Test Query",
      description: "",
      requestSchema: z
        .object({ source: z.string(), queryType: z.string() })
        .strict(),
      paginationType: "none" as const,
      responses: [
        {
          schema: z.object({ media: z.array(z.any()) }),
          constructor: {
            // Top level: makes request 1
            _setup: ($) => $.fetch(`${serverUrl}/page1`).then((r) => r.json()),
            // Nested level 1: makes request 2
            nested1: {
              _setup: ($) =>
                $.fetch(`${serverUrl}/page2`).then((r) => r.json()),
              // Nested level 2: makes request 3 then throws error
              nested2: {
                _setup: ($) =>
                  $.fetch(`${serverUrl}/page3`)
                    .then((r) => r.json())
                    .then(() => {
                      throw new Error("Deliberate error in deep nested node");
                    }),
                value: "should not execute",
              },
              value2: ($) => "from nested1",
            },
            media: [],
          },
        },
      ],
    },
  ],
} satisfies Source;

beforeEach(async () => {
  await startTestServer();
});

afterEach(async () => {
  await stopTestServer();
});

test("exportNetworkRequestsHistoryIfRelevantError exports all requests made before error in constructor with multiple depths", async () => {
  const liaseOptions = {
    plugins: [{ sources: [multiLevelErrorSource] }],
  };

  const query = createLiaseQuery({
    request: { source: "multi-level-error", queryType: "test-query" },
    liaseOptions,
  });

  // Capture console.info to get the export directory
  let exportDir: string | undefined;
  const originalConsoleInfo = console.info;
  console.info = (...args: unknown[]) => {
    // console.info is called with multiple args: message, directory path
    // Find the argument that looks like a directory path ending with /liase-exports/number
    for (const arg of args) {
      if (typeof arg === "string" && arg.includes("/liase-exports/")) {
        exportDir = arg;
        break;
      }
    }
    originalConsoleInfo(...args);
  };

  try {
    const error = await query.getNext().catch((e) => e);

    // Verify error was thrown
    expect(error).toBeDefined();
    expect(error.name).toBe("QueryError");
    expect(error.cause?.message).toContain(
      "Deliberate error in deep nested node",
    );

    // Verify that export directory was captured
    expect(exportDir).toBeDefined();
    if (!exportDir) {
      throw new Error("Export directory was not captured");
    }
    expect(exportDir).toContain("/liase-exports/");

    // Assign to a const to satisfy TypeScript in closures
    const dir = exportDir;

    // Verify that exported files exist for each request
    const files = await fs.readdir(dir);

    // Should have 3 request files (+ 3 metadata files)
    // 3 requests: page1, page2, page3
    // 3 metadata files: page1.metadata.txt, page2.metadata.txt, page3.metadata.txt
    const jsonFiles = files.filter(
      (f) => f.endsWith(".json") && !f.endsWith(".metadata.txt"),
    );
    const metadataFiles = files.filter((f) => f.endsWith(".metadata.txt"));

    expect(jsonFiles.length).toBe(3); // 3 requests made
    expect(metadataFiles.length).toBe(3); // 3 metadata files

    // Verify content of exported files
    const pageFiles = await Promise.all(
      jsonFiles.map((f) =>
        fs
          .readFile(path.join(dir, f), "utf-8")
          .then((content) => ({ filename: f, content })),
      ),
    );

    // Check that all three pages' data are present
    const allContent = pageFiles.map((p) => p.content).join("");
    expect(allContent).toContain("page1-data");
    expect(allContent).toContain("page2-data");
    expect(allContent).toContain("page3-data");

    // Verify metadata files contain request information
    const metadataFilesContent = await Promise.all(
      metadataFiles.map((f) =>
        fs
          .readFile(path.join(dir, f), "utf-8")
          .then((content) => ({ filename: f, content })),
      ),
    );

    // Check that metadata contains expected request info
    const allMetadata = metadataFilesContent.map((m) => m.content).join("\n");
    expect(allMetadata).toContain("Request URL:");
    expect(allMetadata).toContain("Request method:");
    expect(allMetadata).toContain("Response cached:");
    expect(allMetadata).toContain("Status code: 200");

    // Cleanup exported directory
    await fs.rm(path.dirname(dir), { recursive: true, force: true });
  } finally {
    console.info = originalConsoleInfo;
  }
});
