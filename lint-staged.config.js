export default {
  "*.{js,ts,tsx,mjs,cjs,json}": ["biome check --fix --no-errors-on-unmatched"],
  "*.{ts,tsx}": () => "turbo typecheck",
};
