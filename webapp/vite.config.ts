import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Dev server proxies /api to the Express backend (npm run serve, port 3000) so the SPA
// can be developed with `npm run dev:webapp` without CORS. The production build is static
// files served BY that same Express server at / (see dashboard/server.ts).
export default defineConfig({
  plugins: [react()],
  base: "/",
  server: {
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:3000" },
  },
  build: { outDir: "dist" },
});
