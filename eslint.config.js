import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
// Pinned to v5 on purpose: v7 adds experimental rules (refs, set-state-in-effect)
// that flag working patterns in this codebase. Revisit before bumping to v7+.
import reactHooks from "eslint-plugin-react-hooks";

export default [
  { ignores: ["dist/**", "demo-dist/**", "node_modules/**", "coverage/**"] },

  js.configs.recommended,

  // React UI + extension source
  {
    files: ["src/**/*.{js,jsx}", "demo/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.serviceworker,
        chrome: "readonly",
      },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, "react-hooks": reactHooks },
    settings: { react: { version: "detect" } },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/no-unescaped-entities": "off",
      "react-hooks/exhaustive-deps": "warn",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },

  // Node-context config + tooling files
  {
    files: ["*.config.js", "vite.demo.config.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.node },
    },
  },

  // Tests (Vitest globals)
  {
    files: ["test/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.node, ...globals.vitest },
    },
  },
];
