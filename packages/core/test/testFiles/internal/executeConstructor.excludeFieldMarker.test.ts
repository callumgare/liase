import { excludeFieldMarker } from "@/src/ActionContext.js";
import { executeConstructor } from "@/src/constructorExecution.js";
import type { Constructor } from "@/src/schemas/constructor.js";
import { createExampleActionContext } from "@/src/testing/vitest.js";
import { describe, expect, it } from "vitest";

describe("executeConstructor excludeFieldMarker", () => {
  it("removes object fields and array elements marked with excludeFieldMarker", async () => {
    const constructorDef = {
      keepString: "kept",
      keepUndefined: undefined,
      keepNull: null,
      removeField: excludeFieldMarker,
      nested: {
        keepNested: 123,
        keepNestedUndefined: undefined,
        removeNested: excludeFieldMarker,
      },
      arrayValues: ["a", excludeFieldMarker, "b", excludeFieldMarker, null],
    } satisfies Constructor;

    const context = await createExampleActionContext();
    const result = (await executeConstructor(constructorDef, context)) as {
      keepString: string;
      keepUndefined: undefined;
      keepNull: null;
      nested: {
        keepNested: number;
        keepNestedUndefined: undefined;
      };
      arrayValues: Array<string | null>;
      removeField?: unknown;
    };

    expect(result).toEqual({
      keepString: "kept",
      keepUndefined: undefined,
      keepNull: null,
      nested: {
        keepNested: 123,
        keepNestedUndefined: undefined,
      },
      arrayValues: ["a", "b", null],
    });
    expect("keepUndefined" in result).toBe(true);
    expect(result.keepUndefined).toBeUndefined();
    expect("removeField" in result).toBe(false);
    expect("keepNestedUndefined" in result.nested).toBe(true);
    expect(result.nested.keepNestedUndefined).toBeUndefined();
    expect("removeNested" in result.nested).toBe(false);
  });
});
