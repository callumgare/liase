import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);

const cliPath = fileURLToPath(new URL("../../src/index.ts", import.meta.url));
const simplePluginPath = fileURLToPath(
  new URL("../fixtures/simplePlugin.ts", import.meta.url),
);

function resolveTsx(): string {
  const candidates = [
    // package-level node_modules
    new URL("../../node_modules/.bin/tsx", import.meta.url),
    // workspace-root node_modules (monorepo hoisting)
    new URL("../../../../node_modules/.bin/tsx", import.meta.url),
  ];
  for (const url of candidates) {
    const p = fileURLToPath(url);
    if (existsSync(p)) return p;
  }
  return "tsx"; // fall back to PATH
}

const TSX = resolveTsx();

type CliResult = { stdout: string; stderr: string; exitCode: number };

async function runCli(args: string[]): Promise<CliResult> {
  try {
    const { stdout, stderr } = await execFileAsync(TSX, [cliPath, ...args]);
    return { stdout, stderr, exitCode: 0 };
  } catch (error: unknown) {
    const err = error as {
      stdout?: string;
      stderr?: string;
      code?: number;
    };
    return {
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
      exitCode: err.code ?? 1,
    };
  }
}

describe("CLI", () => {
  describe("run", () => {
    test("outputs JSON for a valid query", async () => {
      const { stdout, exitCode } = await runCli([
        "run",
        "--plugins",
        simplePluginPath,
        "-s",
        "test-source",
        "-r",
        "list",
        "--tag",
        "nature",
        "--outputFormat",
        "json",
      ]);
      expect(exitCode).toBe(0);
      const output = JSON.parse(stdout);
      expect(output.media).toHaveLength(1);
      expect(output.media[0].title).toBe("Tagged: nature");
    }, 30_000);

    test("errors with a message about the missing option when a required dynamic option is omitted", async () => {
      const { stderr, exitCode } = await runCli([
        "run",
        "--plugins",
        simplePluginPath,
        "-s",
        "test-source",
        "-r",
        "list",
        "--outputFormat",
        "json",
      ]);
      expect(exitCode).not.toBe(0);
      expect(stderr).toMatch(/--tag/);
    }, 30_000);

    test("recognises dynamic options when they are passed alongside --source and --requestHandler", async () => {
      // Regression: commander v13 set _allowExcessArguments=false by default, so passing
      // a value for an unknown option (e.g. '--tag nature') caused the shadow-parse that
      // discovers dynamic CLI options to throw before its action fired, leaving
      // requestHandler undefined and resulting in "unknown option '--tag'".
      const { stdout, stderr, exitCode } = await runCli([
        "run",
        "--plugins",
        simplePluginPath,
        "-s",
        "test-source",
        "-r",
        "list",
        "--tag",
        "books",
        "--outputFormat",
        "json",
      ]);
      expect(stderr).not.toMatch(/unknown option/i);
      expect(exitCode).toBe(0);
      const output = JSON.parse(stdout);
      expect(output.media[0].title).toBe("Tagged: books");
    }, 30_000);
  });

  describe("show-schema", () => {
    test("prints the request schema including dynamic fields", async () => {
      const { stdout, exitCode } = await runCli([
        "show-schema",
        "--plugins",
        simplePluginPath,
        "-s",
        "test-source",
        "-r",
        "list",
        "--schemaType",
        "request",
      ]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("tag");
    }, 30_000);
  });
});
