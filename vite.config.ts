import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Base path only for production build (edendalesports.co.za), not for dev
  base: command === 'build' ? '/EDENDALESPORTSPROJECTNPC/' : '/',
  // Store Vite's cache outside node_modules to avoid EACCES issues
  cacheDir: '.vite',
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'https://www.ndosiautomation.co.za/EDENDALESPORTSPROJECTNPC/api',
        changeOrigin: true,
        secure: true,
        rewrite: (path: string) => path.replace(/^\/api/, ''),
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('Proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Proxying:', req.method, req.url, '→', proxyReq.getHeader('host'));
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Response:', proxyRes.statusCode, req.url);
          });
        }
      }
    }
  }
}))