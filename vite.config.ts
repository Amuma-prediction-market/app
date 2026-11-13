import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // relative paths, so the build works from any folder a static host serves it from
  base: "./",
  // the wallet SDKs were written for Node and read `global`; in a browser that is globalThis
  define: { global: "globalThis" },
  // the production build drops every console call, the dependencies' included: Meteor's SDK logs the new sign-in key,
  // secret and all, to the console. Development keeps them.
  build: {
    rolldownOptions: { output: { minify: { compress: { dropConsole: true }, mangle: true, codegen: true } } },
  },
  test: { environment: "node" },
});
