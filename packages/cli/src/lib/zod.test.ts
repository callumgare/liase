import { zodSchemaToSimpleSchema } from "@/src/lib/zod.js";
import { describe, expect, test } from "vitest";
import { z } from "zod";

describe("zodSchemaToSimpleSchema", () => {
  describe("primitive types", () => {
    test("converts ZodString", () => {
      expect(zodSchemaToSimpleSchema(z.string())).toEqual({ type: "string" });
    });

    test("converts ZodNumber", () => {
      expect(zodSchemaToSimpleSchema(z.number())).toEqual({ type: "number" });
    });

    test("converts ZodBoolean", () => {
      expect(zodSchemaToSimpleSchema(z.boolean())).toEqual({ type: "boolean" });
    });

    test("converts ZodNull", () => {
      expect(zodSchemaToSimpleSchema(z.null())).toEqual({ type: "null" });
    });

    test("converts ZodDate", () => {
      expect(zodSchemaToSimpleSchema(z.date())).toEqual({ type: "date" });
    });
  });

  describe("ZodLiteral", () => {
    test("converts string literal", () => {
      expect(zodSchemaToSimpleSchema(z.literal("hello"))).toEqual({
        type: "literal",
        value: "hello",
        valueType: "string",
      });
    });

    test("converts number literal", () => {
      expect(zodSchemaToSimpleSchema(z.literal(42))).toEqual({
        type: "literal",
        value: 42,
        valueType: "number",
      });
    });

    test("converts boolean literal", () => {
      expect(zodSchemaToSimpleSchema(z.literal(true))).toEqual({
        type: "literal",
        value: true,
        valueType: "boolean",
      });
    });

    test("converts null literal", () => {
      expect(zodSchemaToSimpleSchema(z.literal(null))).toEqual({
        type: "literal",
        value: null,
        valueType: "null",
      });
    });

    test("converts multi-value literal to union of literals", () => {
      expect(zodSchemaToSimpleSchema(z.literal([200, 201, 204]))).toEqual({
        type: [
          { type: "literal", value: 200, valueType: "number" },
          { type: "literal", value: 201, valueType: "number" },
          { type: "literal", value: 204, valueType: "number" },
        ],
      });
    });
  });

  describe("ZodEnum", () => {
    test("converts enum to union of string literals", () => {
      const result = zodSchemaToSimpleSchema(z.enum(["a", "b", "c"]));
      expect(result).toEqual({
        type: [
          {
            type: "literal",
            value: "a",
            valueType: "string",
            zodTypeName: "ZodLiteral",
          },
          {
            type: "literal",
            value: "b",
            valueType: "string",
            zodTypeName: "ZodLiteral",
          },
          {
            type: "literal",
            value: "c",
            valueType: "string",
            zodTypeName: "ZodLiteral",
          },
        ],
      });
    });
  });

  describe("ZodObject", () => {
    test("converts object with fields", () => {
      const schema = z.object({ name: z.string(), age: z.number() });
      expect(zodSchemaToSimpleSchema(schema)).toEqual({
        type: "object",
        children: {
          name: { type: "string" },
          age: { type: "number" },
        },
      });
    });

    test("converts nested objects", () => {
      const schema = z.object({ inner: z.object({ value: z.boolean() }) });
      expect(zodSchemaToSimpleSchema(schema)).toEqual({
        type: "object",
        children: {
          inner: {
            type: "object",
            children: { value: { type: "boolean" } },
          },
        },
      });
    });
  });

  describe("ZodArray", () => {
    test("converts array", () => {
      expect(zodSchemaToSimpleSchema(z.array(z.string()))).toEqual({
        type: "array",
        children: { type: "string" },
      });
    });
  });

  describe("ZodUnion", () => {
    test("converts union of primitives", () => {
      const result = zodSchemaToSimpleSchema(z.union([z.string(), z.number()]));
      expect(result).toEqual({
        type: [{ type: "string" }, { type: "number" }],
      });
    });

    test("marks union as optional when it includes ZodUndefined", () => {
      const result = zodSchemaToSimpleSchema(
        z.union([z.string(), z.undefined()]),
      );
      expect(result).toMatchObject({ optional: true });
    });
  });

  describe("ZodOptional", () => {
    test("marks field as optional", () => {
      const result = zodSchemaToSimpleSchema(z.optional(z.string()));
      expect(result).toEqual({ type: "string", optional: true });
    });
  });

  describe("ZodDefault", () => {
    test("carries default value through", () => {
      const result = zodSchemaToSimpleSchema(z.string().default("fallback"));
      expect(result).toEqual({ type: "string", default: "fallback" });
    });
  });

  describe("ZodNullable", () => {
    test("converts nullable to union with null", () => {
      const result = zodSchemaToSimpleSchema(z.nullable(z.string()));
      expect(result).toEqual({
        type: [{ type: "string" }, { type: "null" }],
      });
    });
  });

  describe("ZodIntersection", () => {
    test("merges two objects", () => {
      const schema = z.intersection(
        z.object({ a: z.string() }),
        z.object({ b: z.number() }),
      );
      expect(zodSchemaToSimpleSchema(schema)).toEqual({
        type: "object",
        children: {
          a: { type: "string" },
          b: { type: "number" },
        },
      });
    });
  });

  describe("description", () => {
    test("carries description through", () => {
      const result = zodSchemaToSimpleSchema(
        z.string().describe("a description"),
      );
      expect(result).toEqual({ type: "string", description: "a description" });
    });
  });
});
