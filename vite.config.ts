import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // relative paths, so the build works from any folder a static host serves it from
  base: "./",
  // the wallet SDKs were written for Node and read `global`; in a browser that is globalThis
  define: { global: "globalThis" },
  test: { environment: "node" },
});
