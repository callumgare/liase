# Liason

Liason is a library that provide a uniform interface to fetch and return media from different sources all in a
standardised format.

## Packages

| Package | Description |
|---|---|
| [`@liason/core`](packages/core) | The core library |
| [`@liason/cli`](packages/cli) | CLI tool for interacting with the core library |
| [`@liason/example-plugin`](packages/example-plugin) | An example plugin demonstrating how to extend liason |
| [`@liason/output-viewer`](packages/output-viewer) | A Next.js web app for viewing liason output |

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

## Name
It should probably be spelt "liaison" by my dyslexia-ass brain can't spell that reliabably 😆
