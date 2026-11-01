import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { tryOnApi } from "./server/vitePlugin";
export default defineConfig(({ mode }) => ({
  // Server-only variables (no VITE_ prefix) stay in the Node process, never the bundle.
  plugins: [react(), tailwindcss(), tryOnApi(loadEnv(mode, process.cwd(), ""))],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["src/**/*.test.ts", "server/**/*.test.ts"] },
}));
