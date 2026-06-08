import { defineConfig } from 'vite';

// The debug page lives in ./debug and imports the library source directly from ../src.
export default defineConfig({
  root: 'debug',
  server: {
    port: 5173,
  },
});
