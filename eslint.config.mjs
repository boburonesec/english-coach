import js from "@eslint/js";
import nextVitals from "eslint-config-next/core-web-vitals";
import globals from "globals";

const webFiles = ["apps/web/**/*.{js,jsx,mjs,ts,tsx,mts,cts}"];
const typescriptConfig = nextVitals.find((entry) => entry.name === "next/typescript");
const webNextConfig = nextVitals
  .filter((entry) => entry.name !== "next/typescript")
  .map((entry) => ("ignores" in entry ? entry : { ...entry, files: webFiles }));

const config = [
  {
    ignores: ["**/.next/**", "**/coverage/**", "**/dist/**", "**/node_modules/**"],
  },
  js.configs.recommended,
  ...webNextConfig,
  {
    ...typescriptConfig,
    name: "repository/typescript",
    files: ["**/*.ts", "**/*.tsx"],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "error",
    },
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    settings: {
      next: {
        rootDir: "apps/web/",
      },
      react: {
        version: "19.3",
      },
    },
  },
];

export default config;
