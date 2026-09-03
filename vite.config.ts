import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: "/",
  build: {
    outDir: "dist",
  },
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/chatwoot-api": {
        target: "https://chat.hotelequip.pt",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/chatwoot-api/, ""),
        secure: false,
      },
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      strategies: "injectManifest",
      srcDir: "public",
      filename: "push-sw.js",
      injectManifest: {
        injectionPoint: undefined,
      },
      manifest: {
        name: "HotelEquip CRM",
        short_name: "HE CRM",
        description: "HotelEquip CRM OS",
        theme_color: "#0d9488",
        background_color: "#0f172a",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      devOptions: { enabled: true },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
