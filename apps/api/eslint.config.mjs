// @ts-check
import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

// Founder item 6 (D99, 2026-10-11) - this project's first ESLint config;
// "eslint ... couldn't find an eslint.config.(js|mjs|cjs)" was a real,
// confirmed-broken gap (the package.json `lint` script existed, nothing
// backed it). Deliberately NOT type-checked (tseslint.configs.recommended,
// not recommendedTypeChecked) - this is a large, previously-unlinted
// codebase; full type-aware linting is both much slower in CI and would
// surface a much larger first-pass violation count than this LOW item's
// scope. No Prettier - this repo has never had one, and adding it now
// would mean a sweeping reformat far beyond "make lint work."
export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: "commonjs",
    },
    rules: {
      // NestJS's own DI/decorator style relies on these throughout -
      // matches the exception the framework's own default template makes.
      "@typescript-eslint/no-explicit-any": "off",
      // Matches this codebase's own pre-existing destructuring-omit idiom
      // (`const { accessPasswordHash: _omit, ...rest } = store`, stripping
      // a sensitive/internal field before returning an object) - a
      // leading underscore already meant "deliberately unused" here before
      // this config existed; varsIgnorePattern/destructuredArrayIgnorePattern
      // just make the linter agree.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" },
      ],
      "no-unused-vars": "off",
    },
  },
);
