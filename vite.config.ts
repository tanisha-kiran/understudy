import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// The Node server (server/index.mjs) owns /api and /sandbox. Vite proxies to it in dev.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const serverUrl = process.env.UNDERSTUDY_SERVER_URL || env.UNDERSTUDY_SERVER_URL || "http://localhost:8787";
  const webPort = Number(process.env.VITE_PORT || env.VITE_PORT || 5173);
  return {
    plugins: [react()],
    // Some managed Windows workspaces deny Rollup's extra realpath probe even
    // though the file is readable. Keeping workspace paths as-is avoids it.
    resolve: { preserveSymlinks: true },
    server: {
      port: webPort,
      proxy: {
        "/api": serverUrl,
        "/sandbox": serverUrl,
      },
    },
  };
});
