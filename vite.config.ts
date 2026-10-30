import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Pages de staging pasa VITE_BASE_PATH=/proyecto-90/.
// El FTPS de producción no lo define: el sitio vive en la raíz del dominio.
const base = process.env.VITE_BASE_PATH || "/";

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
  build: {
    outDir: "dist/client",
  },
});
