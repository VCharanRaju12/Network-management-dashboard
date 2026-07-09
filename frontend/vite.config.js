import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// When running inside Docker Compose, the backend is reachable at
// "http://backend:8000" (the service name). When running `npm run dev`
// directly on your machine (not in Docker), it's "http://localhost:8000".
var proxyTarget = process.env.VITE_API_PROXY_TARGET || "http://localhost:8000";
export default defineConfig({
    plugins: [react()],
    server: {
        host: true,
        port: 5173,
        proxy: {
            "/api": {
                target: proxyTarget,
                changeOrigin: true,
                ws: true,
            },
        },
    },
});
