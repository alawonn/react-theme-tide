import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "demo-dist",
      "test-results",
      "playwright-report",
      // Expo and Metro read these as CommonJS.
      "native-demo/*.config.js",
      "native-demo/.expo",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
);
