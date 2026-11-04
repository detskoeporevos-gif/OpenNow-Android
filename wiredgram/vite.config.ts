import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// WiredGram — deliberately boring build config:
// one entry, no runtime helper libraries, no CSS-in-JS, no polyfills.
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    // Preview hosts are proxied (e.g. 5173-<sandbox>.e2b.app) — accept any host.
    allowedHosts: true,
  },
  preview: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    allowedHosts: true,
  },
  build: {
    target: "es2020",
    cssCodeSplit: false,
    reportCompressedSize: true,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
});
