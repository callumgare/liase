import {
  addCachingFetchWrapper,
  cacheResponse,
  getCachedResponse,
} from "@/src/lib/networkRequestsCache.js";
import { describe, expect, it } from "vitest";

function uniqueRequestSeed() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

describe("network request cache", () => {
  it("returns undefined for cache miss", async () => {
    const seed = uniqueRequestSeed();
    const res = await getCachedResponse({
      url: `https://example.test/miss/${seed}`,
      method: "GET",
      headers: { accept: "text/plain" },
      body: "",
    });
    expect(res).toBeUndefined();
  });

  it("writes and reads cached responses", async () => {
    const seed = uniqueRequestSeed();
    const req = {
      url: `https://example.test/hit/${seed}`,
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "body",
    };

    await cacheResponse(req, {
      body: "cached-body",
      statusCode: 201,
      headers: { "content-type": "text/plain" },
      request: { headers: { "x-sent": "1" } },
    });

    const cached = await getCachedResponse(req);
    expect(cached).toBeDefined();
    expect(cached?.body).toBe("cached-body");
    expect(cached?.statusCode).toBe(201);
    expect(cached?.cachedOn).toBeInstanceOf(Date);
    expect(cached?.request.headers).toEqual({ "x-sent": "1" });
  });

  it("throws for unsupported auto mode in caching fetch wrapper", async () => {
    const wrapped = addCachingFetchWrapper(fetch, "auto");
    await expect(wrapped("https://example.test/auto")).rejects.toThrow(
      'The "auto" value for the cacheNetworkRequests option is not yet supported',
    );
  });

  it("passes through in never mode without caching", async () => {
    let callCount = 0;
    const originalFetch: typeof fetch = async () => {
      callCount++;
      return new Response("never-mode", {
        status: 200,
        headers: { "x-original": "1" },
      });
    };

    const wrapped = addCachingFetchWrapper(originalFetch, "never");
    const first = await wrapped("https://example.test/never");
    const second = await wrapped("https://example.test/never");

    expect(await first.text()).toBe("never-mode");
    expect(await second.text()).toBe("never-mode");
    expect(callCount).toBe(2);
  });

  it("uses cache in always mode after first fetch", async () => {
    const seed = uniqueRequestSeed();
    let callCount = 0;
    const originalFetch: typeof fetch = async () => {
      callCount++;
      return new Response("cached-on-second-call", {
        status: 202,
        headers: { "x-cache": "origin" },
      });
    };

    const wrapped = addCachingFetchWrapper(originalFetch, "always");
    const url = `https://example.test/wrapper/${seed}`;

    const first = await wrapped(url, {
      method: "POST",
      headers: { "X-Req": "abc" },
      body: "payload",
    });
    expect(await first.text()).toBe("cached-on-second-call");

    const second = await wrapped(url, {
      method: "POST",
      headers: { "X-Req": "abc" },
      body: "payload",
    });

    expect(await second.text()).toBe("cached-on-second-call");
    expect(second.status).toBe(202);
    expect(second.statusText).toContain("Cached on:");
    expect(callCount).toBe(1);
  });
});
