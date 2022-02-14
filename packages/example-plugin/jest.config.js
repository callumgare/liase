/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  resolver: "ts-jest-resolver",
  transform: {
    "node_modules/media-finder/.+\\.(j|t)sx?$": "ts-jest"
  },
  transformIgnorePatterns: [
    "node_modules/(?!media-finder/.*)"
  ]
};