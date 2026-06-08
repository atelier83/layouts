import { defineConfig } from "vite";

// The playground lives in ./playground and imports the library source directly
// from ../src. `pnpm run dev` serves it, and it doubles as the live demo
// deployed to GitHub Pages.
export default defineConfig(({ command }) => ({
  root: "playground",
  // GitHub Pages serves the project site under /layouts/; dev stays at root.
  base: command === "build" ? "/layouts/" : "/",
  build: {
    outDir: "../demo-dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
}));
