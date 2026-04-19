import { wasp } from "wasp/client/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = env.VITE_API_PROXY_TARGET || env.WASP_SERVER_URL || "http://192.168.1.17:3555";

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
