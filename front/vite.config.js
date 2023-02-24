import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      "/upload": {
        target: "http://192.168.1.76:30001",
        changeOrigin: true,
      },
    },
  },
});
