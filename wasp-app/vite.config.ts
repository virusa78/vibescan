import { wasp } from "wasp/client/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import { getBackendBaseUrl } from "./src/server/config/runtime.js";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = getBackendBaseUrl(env);

  return {
    plugins: [wasp(), tailwindcss()],
    server: {
      open: true,
      proxy: {
        "/api/v1": proxyTarget,
        "/operations": proxyTarget,
        "/auth": proxyTarget,
        "/health": proxyTarget,
        "/docs": proxyTarget,
      },
    },
  };
});
