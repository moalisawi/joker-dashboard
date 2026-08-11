import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "functions/lib/**",
    "next-env.d.ts",
    "auto-migrate.js",
    "migrate.js",
    // Generated/deployment artifacts — not source code:
    ".firebase/**",
    ".vercel/**",
    ".sixth/**",
    "coverage/**",
    "test-results/**",
    "playwright-qa-shots/**",
    "playwright-report/**",
  ]),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
      // The codebase already writes `_name` for a binding it must declare but
      // does not read — a positional callback parameter, a destructured field
      // kept for shape. The rule was flagging those anyway, so the convention
      // carried no weight and the warnings were noise that hid real ones.
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern:         "^_",
        varsIgnorePattern:         "^_",
        caughtErrorsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
      }],
    },
  },
  {
    // CommonJS config files — require() is the correct module form here.
    files: ["jest.config.js", "next.config.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    // Playwright test helpers — not React code; `use` here is a Playwright
    // fixture callback, not a hook, which trips react-hooks/rules-of-hooks.
    files: ["e2e/**"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
]);

export default eslintConfig;
