import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  root: here("."),
  base: "./",
  plugins: [react()],
  resolve: {
    alias: { "react-theme-tide": here("../src/index.ts") },
  },
  server: { port: 5179, strictPort: true },
  preview: { port: 5179, strictPort: true },
  build: {
    outDir: here("../demo-dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        demo: here("index.html"),
        fixture: here("fixture/index.html"),
      },
    },
  },
});
