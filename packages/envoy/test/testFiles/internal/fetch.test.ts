import {
  headersToNormalisedBasicObject,
  parseFetchArgs,
} from "@/src/lib/fetch.js";
import { describe, expect, it } from "vitest";

describe("fetch helpers", () => {
  it("normalises headers from arrays, Headers, and objects", () => {
    expect(
      headersToNormalisedBasicObject([
        ["X-Test", "one"],
        ["content-type", "text/plain"],
      ]),
    ).toEqual({
      "x-test": "one",
      "content-type": "text/plain",
    });

    const headers = new Headers();
    headers.set("X-Other", "two");
    expect(headersToNormalisedBasicObject(headers)).toEqual({
      "x-other": "two",
    });

    expect(
      headersToNormalisedBasicObject({
        "X-Mixed": "three",
      }),
    ).toEqual({
      "x-mixed": "three",
    });
  });

  it("parses string and URL inputs with empty/default body", async () => {
    const parsedFromString = parseFetchArgs("https://example.test/a");
    expect(parsedFromString.url.href).toBe("https://example.test/a");
    expect(parsedFromString.method).toBe("");
    expect(parsedFromString.headers).toEqual({});
    expect(await parsedFromString.body).toBe("");

    const parsedFromUrl = parseFetchArgs(new URL("https://example.test/b"), {
      method: "POST",
      headers: { "X-Test": "1" },
    });
    expect(parsedFromUrl.url.href).toBe("https://example.test/b");
    expect(parsedFromUrl.method).toBe("POST");
    expect(parsedFromUrl.headers).toEqual({ "x-test": "1" });
    expect(await parsedFromUrl.body).toBe("");
  });

  it("parses URLSearchParams and FormData request bodies", async () => {
    const paramsBody = new URLSearchParams({ a: "1", b: "two" });
    const parsedParams = parseFetchArgs("https://example.test/params", {
      body: paramsBody,
    });
    expect(await parsedParams.body).toBe("a=1&b=two");

    const formData = new FormData();
    formData.append("field", "value");
    const parsedFormData = parseFetchArgs("https://example.test/form", {
      body: formData,
    });
    expect(await parsedFormData.body).toBe("[object FormData]");
  });

  it("parses ArrayBuffer, TypedArray, Blob, and ReadableStream bodies", async () => {
    const parsedArrayBuffer = parseFetchArgs("https://example.test/ab", {
      body: new TextEncoder().encode("array-buffer").buffer,
    });
    expect(await parsedArrayBuffer.body).toBe("array-buffer");

    const parsedTypedArray = parseFetchArgs("https://example.test/typed", {
      body: new Uint8Array(new TextEncoder().encode("typed-array")),
    });
    expect(await parsedTypedArray.body).toBe("typed-array");

    const parsedBlob = parseFetchArgs("https://example.test/blob", {
      body: new Blob(["blob-body"], { type: "text/plain" }),
    });
    expect(await parsedBlob.body).toBe("blob-body");

    const parsedStream = parseFetchArgs("https://example.test/stream", {
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("stream-body"));
          controller.close();
        },
      }),
    });
    expect(await parsedStream.body).toBe("stream-body");
  });

  it("parses Request input and rejects unsupported object body types", async () => {
    const request = new Request("https://example.test/request", {
      method: "PUT",
      headers: { "X-From-Request": "yes" },
      body: "request-body",
    });
    const parsedRequest = parseFetchArgs(request);
    expect(parsedRequest.url.href).toBe("https://example.test/request");
    expect(parsedRequest.method).toBe("PUT");
    expect(parsedRequest.headers["x-from-request"]).toBe("yes");
    expect(parsedRequest.headers["content-type"]).toContain("text/plain");
    expect(await parsedRequest.body).toBe("request-body");

    expect(() =>
      parseFetchArgs("https://example.test/unsupported", {
        // biome-ignore lint/suspicious/noExplicitAny: intentionally invalid body for error branch coverage
        body: { some: "object" } as any,
      }),
    ).toThrow("Only string, URLSearchParams, FormData");
  });
});
