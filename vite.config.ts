import { defineConfig } from "vite";

// The playground lives in ./playground and imports the library source directly
// from ../src. `pnpm dev` serves it; `pnpm build:demo` bundles it for hosting
// the demo on any static host.
export default defineConfig({
  root: "playground",
  build: {
    outDir: "../demo-dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});
