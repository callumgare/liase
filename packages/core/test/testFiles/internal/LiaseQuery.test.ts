import { type Source, createLiaseQuery } from "@/src/index.js";
import { expect, test } from "vitest";
import { z } from "zod";

const errorThrowingSource = {
  id: "error-throwing",
  displayName: "Error Throwing Source",
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
          schema: z.object({}).passthrough(),
          constructor: {
            _setup: () => {
              throw new Error("original error");
            },
          },
        },
      ],
    },
  ],
} satisfies Source;

const liaseOptions = {
  plugins: [{ sources: [errorThrowingSource] }],
};

test("errors thrown during query execution are wrapped in QueryError with request info", async () => {
  const query = createLiaseQuery({
    request: { source: "error-throwing", queryType: "test-query" },
    liaseOptions,
  });

  const error = await query.getNext().catch((e) => e);

  expect(error.name).toBe("QueryError");
  expect(error.message).toContain('"source":"error-throwing"');
  expect(error.message).toContain('"queryType":"test-query"');
  expect(error.cause).toBeDefined();
});

test("QueryError message includes sanitized secrets when secrets are present", async () => {
  const sourceWithSecrets = {
    ...errorThrowingSource,
    id: "error-throwing-with-secrets",
    requestHandlers: [
      {
        ...errorThrowingSource.requestHandlers[0],
        secretsSchema: z.object({ apiKey: z.string() }).strict(),
      },
    ],
  } satisfies Source;

  const query = createLiaseQuery({
    request: {
      source: "error-throwing-with-secrets",
      queryType: "test-query",
    },
    liaseOptions: { plugins: [{ sources: [sourceWithSecrets] }] },
    queryOptions: { secrets: { apiKey: "super-secret-value" } },
  });

  const error = await query.getNext().catch((e) => e);

  expect(error.name).toBe("QueryError");
  expect(error.message).toContain('"apiKey":"***"');
  expect(error.message).not.toContain("super-secret-value");
});
