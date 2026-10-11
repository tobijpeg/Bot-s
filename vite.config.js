import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "")
  const backendPort = env.BOTSUITE_PORT || "4174"
  return {
    base: env.VITE_BASE_PATH || "/",
    plugins: [react()],
    envPrefix: ["VITE_", "NEXT_PUBLIC_"],
    server: {
      host: "127.0.0.1",
      proxy: { "/api": `http://127.0.0.1:${backendPort}` },
    },
  }
})
