import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactCompiler from "eslint-plugin-react-compiler";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";

const ignores = [
  "**/node_modules/**",
  "**/build/**",
  "**/dist/**",
  "**/coverage/**",
  "**/*.gen.ts",
  "apps/api/migrations/**",
];

export default [
  { ignores },
  js.configs.recommended,

  // ESM root configs / scripts
  {
    files: ["*.config.{js,mjs,ts}"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node },
    },
  },

  // Backend TS (Express, Mongoose)
  ...tseslint.config({
    files: ["apps/api/**/*.ts", "packages/shared/**/*.ts"],
    extends: tseslint.configs.recommended,
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
    },
  }),

  // migrate-mongo CJS migrations
  {
    files: ["apps/api/migrations/**/*.cjs", "apps/api/migrate-mongo-config.cjs"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },

  // One-off Node scripts under scripts/ (seed-demo, clean-demo, etc).
  {
    files: ["scripts/**/*.{mjs,js,ts}"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },

  // Frontend TS + React 19 + React Compiler
  ...tseslint.config({
    files: ["apps/web/**/*.{ts,tsx}"],
    extends: tseslint.configs.recommended,
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-compiler": reactCompiler,
    },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: "19" } },
    rules: {
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-compiler/react-compiler": "error",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  }),

  prettierConfig,
];
