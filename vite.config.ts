import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "ModernNav - 现代导航",
        short_name: "ModernNav",
        description: "发现精彩网站，探索无限可能",
        theme_color: "#6280a3",
        background_color: "#ffffff",
        display: "standalone",
        icons: [
          {
            src: "favicon.svg",
            sizes: "192x192",
            type: "image/svg+xml",
          },
          {
            src: "favicon.svg",
            sizes: "512x512",
            type: "image/svg+xml",
          },
        ],
      },
    }),
  ],
  css: {
    postcss: {
      plugins: [tailwindcss(), autoprefixer()],
    },
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false,
    minify: "terser",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("lucide-react")) {
              return "ui-vendor";
            }
            if (
              id.includes("/react/") ||
              id.includes("/react-dom/") ||
              id.includes("/react-is/") ||
              id.includes("/scheduler/") ||
              id.includes("/prop-types/")
            ) {
              return "react-vendor";
            }
            return "vendor";
          }
        },
      },
    },
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
  server: {
    host: true,
    port: 3000,
  },
  preview: {
    port: 4173,
    host: true,
  },
});
