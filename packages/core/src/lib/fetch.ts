type ParsedFetchArgs = {
  url: URL;
  method: string;
  headers: Record<string, string>;
  body: string | Promise<string>;
};

export function parseFetchArgs(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
): ParsedFetchArgs {
  let url: URL;
  let body: string | Promise<string>;
  let headers: Record<string, string>;
  let method: string;
  if (typeof input === "string" || input instanceof URL) {
    url = input instanceof URL ? input : new URL(input);
    if (!init || !init.body) {
      body = "";
    } else if (init.body instanceof URLSearchParams) {
      body = init.body.toString();
    } else if (init.body instanceof FormData) {
      body = init.body.toString();
    } else if (typeof init.body === "object") {
      throw Error(
        "Only string, URLSearchParams and FormData type bodies are currently supported. Sorry!",
      );
    } else {
      body = init.body;
    }
    headers = headersToNormalisedBasicObject(init?.headers ?? {});
    method = init?.method ?? "";
  } else if (input instanceof Request) {
    const clonedRequest = input.clone();
    url = new URL(clonedRequest.url);
    body = clonedRequest.text();
    headers = headersToNormalisedBasicObject(clonedRequest.headers);
    method = clonedRequest.method;
  } else {
    input satisfies never;
    throw Error("Input is invalid");
  }
  return {
    url,
    body,
    headers,
    method,
  };
}

export function headersToNormalisedBasicObject(
  headers:
    | globalThis.Headers
    | string[][]
    | Record<string, string | string[] | readonly string[] | undefined>,
) {
  let entries:
    | string[][]
    | [string, string | string[] | readonly string[] | undefined][];
  if (Array.isArray(headers)) {
    entries = headers;
  } else if (headers instanceof global.Headers) {
    entries = [...headers.entries()];
  } else {
    entries = Object.entries(headers);
  }
  return Object.fromEntries(
    entries.map((entry) => [entry[0].toLocaleLowerCase(), entry[1]]),
  ) as Record<string, string>;
}
