import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
  server: {
    host: "::",
    // Use 5173 only; fail if port is in use instead of trying another
    port: 5173,
    strictPort: true,
    // Proxy API, WebSocket, and health to backend so dev uses same-origin (no cross-origin WS errors)
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        ws: true,
      },
      '/health': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@features": path.resolve(__dirname, "./src/features"),
      "@hooks": path.resolve(__dirname, "./src/hooks"),
      "@stores": path.resolve(__dirname, "./src/stores"),
      "@services": path.resolve(__dirname, "./src/services"),
      "@types": path.resolve(__dirname, "./src/types"),
      "@utils": path.resolve(__dirname, "./src/utils"),
      "@lib": path.resolve(__dirname, "./src/lib"),
      "@i18n": path.resolve(__dirname, "./src/i18n"),
    },
  },
  build: {
    target: "esnext",
    minify: "esbuild",
    sourcemap: mode !== "production",
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-graph": ["cytoscape", "cytoscape-dagre", "cytoscape-cola", "cytoscape-elk", "elkjs"],
          "vendor-ui": ["@radix-ui/react-dialog", "@radix-ui/react-tabs"],
        },
      },
    },
  },
}));
