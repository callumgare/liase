import type {Config} from 'jest';

const config: Config = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  resolver: "ts-jest-resolver",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  transform: {},
};

export default config;
