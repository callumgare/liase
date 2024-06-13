module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    "standard",
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["@typescript-eslint", "zod"],
  rules: {
    "zod/prefer-enum": 2,
    "zod/require-strict": 2,
    "@typescript-eslint/no-explicit-any": "off", // Most MediaFinder's code is about manipulating
      // data from untyped sources. We use zod extensively to verify that user input and responses
      // given to the user have the type we'd expect so because of that we don't worry too much
      // what the type of data a source returns to us. We assume it's the type we'd expect and let
      // the output validation catch it if it's not. Because of this fairly safely use the `any`
      // type liberally throughout the codebase.
  },
};
