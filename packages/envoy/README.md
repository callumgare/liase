# @liase/envoy

A client for requesting content from URLs used by `@liase/core`. Envoy provides a standard interface on top of various
different clients such as Playwright. This allows a caller to swap between clients as needed with minimal code changes.

## Exports

- `envoy`
- `EnvoyOptions`
- DOM classes (`DomSelection`, `RenderedDomSelection`, etc.)
- Url response types (`UrlRes*`)
- Browser lifecycle helpers (`configureBrowser`, `shutdownBrowser`)
