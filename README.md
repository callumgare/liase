# liaison

> *Named "liaison" — because apparently the creator can't spell it. The library acts as a liaison between your code and media sources, which felt clever at the time and still does, regardless of how many times it gets autocorrected from "liason".*

A monorepo containing the liaison ecosystem — a consistent API for fetching media metadata from a variety of sources and platforms.

## Packages

| Package | Description |
|---|---|
| [`@liaison/core`](packages/core) | The core library |
| [`@liaison/cli`](packages/cli) | CLI tool for interacting with the core library |
| [`@liaison/example-plugin`](packages/example-plugin) | An example plugin demonstrating how to extend liaison |
| [`@liaison/output-viewer`](packages/output-viewer) | A Next.js web app for viewing liaison output |

## Development

This is an [npm workspaces](https://docs.npmjs.com/cli/using-npm/workspaces) monorepo using [Turborepo](https://turbo.build) for task orchestration and [Biome](https://biomejs.dev) for linting and formatting.

### Setup

```bash
npm install
```

### Build all packages

```bash
npm run build
```

### Test all packages

```bash
npm run test
```

### Lint all packages

```bash
npm run lint
```
