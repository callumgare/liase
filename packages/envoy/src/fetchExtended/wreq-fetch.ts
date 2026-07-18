/*
wreq-js's interface is very nearly a clean extention of the standard Fetch API's interface
except for a few minor incompatabilities. This file exists to normalise wreq-js's fetch client 
so that it can be used as a drop-in replacement for the standard fetch client.

For more info see: https://github.com/sqdshguy/wreq-js/issues/167
*/

import {
  type CreateSessionOptions as WreqCreateSessionOptions,
  type RequestInit as WreqRequestInit,
  type Response as WreqResponse,
  type Session as WreqSession,
  createSession,
  fetch as wreqFetchRaw,
} from "wreq-js";

type NormalisedWreqRequestInit<
  TInit extends WreqRequestInit = WreqRequestInit,
> = Omit<TInit, "body" | "headers"> & {
  body?: BodyInit | null;
  headers?: HeadersInit;
  cache?: RequestCache;
};

type NormalisedWreqResponse<TResponse extends WreqResponse = WreqResponse> =
  Omit<TResponse, "bytes" | "clone" | "headers" | "body"> &
    Pick<Response, "bytes" | "clone" | "headers" | "body">;

type NormalisedWreqFetch<
  TInit extends WreqRequestInit = WreqRequestInit,
  TResponse extends NormalisedWreqResponse = NormalisedWreqResponse,
> = (
  input: string | URL | Request,
  init?: NormalisedWreqRequestInit<TInit> | undefined,
) => Promise<TResponse>;

type NormalisedWreqSession<
  TInit extends WreqRequestInit = WreqRequestInit,
  TResponse extends NormalisedWreqResponse = NormalisedWreqResponse,
> = WreqSession & { fetch: NormalisedWreqFetch<TInit, TResponse> };

export function normaliseWreqFetch<
  TInit extends WreqRequestInit = WreqRequestInit,
>(
  wreqFetchFn: typeof wreqFetchRaw,
): NormalisedWreqFetch<TInit, NormalisedWreqResponse> {
  return async (input, init) => {
    const normalisedInit = init
      ? await webRequestInitToWreqRequestInit(init)
      : undefined;
    const wreqResponse = await wreqFetchFn(input, normalisedInit);

    return wreqResponseToWebResponse(wreqResponse);
  };
}

async function webRequestInitToWreqRequestInit<T extends RequestInit>(init: T) {
  return {
    ...init,
    body:
      init.body instanceof ReadableStream
        ? await new Response(init.body).arrayBuffer()
        : init.body,
    headers:
      init.headers instanceof Headers
        ? Array.from(init.headers.entries())
        : init.headers,
  } satisfies WreqRequestInit;
}

function wreqResponseToWebResponse(
  wreqResponse: WreqResponse,
): NormalisedWreqResponse {
  // @ts-expect-error -- If WreqResponse is updated to include a bytes() method this will start throwing a type error
  // letting us know we no longer need to add it.
  type _BytesTest = WreqResponse["bytes"];

  function overrideProperties<
    BaseObject,
    Overrides extends Record<string, unknown>,
  >(
    objectToModify: BaseObject,
    overrides: Overrides,
  ): Omit<BaseObject, keyof Overrides> & {
    [K in keyof Overrides]: Overrides[K];
  } {
    for (const key in overrides) {
      Object.defineProperty(objectToModify, key, {
        get: () => overrides[key],
        configurable: true,
        enumerable: true,
      });
    }
    return objectToModify as Omit<BaseObject, keyof Overrides> & {
      [K in keyof Overrides]: Overrides[K];
    };
  }

  // Save original clone before overriding so we don't recurse into the override.
  const originalClone = wreqResponse.clone.bind(wreqResponse);

  const overriddenResponse = overrideProperties(wreqResponse, {
    // Wreq has a custom Headers object which seems close to but not fully compatible with standard Fetch API Headers.
    headers: new Headers(wreqResponse.headers.toObject()),
    // WreqFetch's Response does not have a bytes() method which is standard in the Fetch API, so we add it if missing.
    bytes: async () => {
      const buffer = await wreqResponse.arrayBuffer();
      return new Uint8Array(buffer);
    },
    // We also need to apply all of these normalisations to the new response created by .clone()
    clone: () => wreqResponseToWebResponse(originalClone()),
  });

  // WreqFetch's Response body is of type `ReadableStream<Uint8Array<ArrayBufferLike>> | null`
  // which seems to be functionally compatible with standard Fetch API's `ReadableStream<Uint8Array> | null`,
  // but the type definitions are incompatible so we're forced to cast it.
  return overriddenResponse as Omit<typeof overriddenResponse, "body"> & {
    body: ReadableStream<Uint8Array<ArrayBuffer>> | null;
  };
}

export const wreqFetch = normaliseWreqFetch(wreqFetchRaw);

export async function createWreqFetchSession(
  options?: WreqCreateSessionOptions,
): Promise<NormalisedWreqSession> {
  const unnormalisedSession = await createSession(options);
  const normalisedFetch = normaliseWreqFetch(
    unnormalisedSession.fetch.bind(unnormalisedSession),
  );
  return Object.assign(unnormalisedSession, {
    fetch: normalisedFetch,
  });
}

export type {
  NormalisedWreqRequestInit as WreqRequestInit,
  NormalisedWreqResponse as WreqResponse,
  NormalisedWreqFetch as WreqFetch,
  NormalisedWreqSession as WreqSession,
  WreqCreateSessionOptions,
};
