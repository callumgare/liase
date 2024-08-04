import globals from "globals";
import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";
import eslintPluginZod from "eslint-plugin-zod";
import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import url from "node:url";

export default [
  ...new FlatCompat({
    baseDirectory: path.dirname(url.fileURLToPath(import.meta.url)),
  }).extends("eslint-config-standard"),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.es2021,
        ...globals.node,
      },
    },
    plugins: {
      zod: eslintPluginZod,
    },
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
  },
];
