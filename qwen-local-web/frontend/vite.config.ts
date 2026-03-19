import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

export default defineConfig(() => {
  let backendPort = '8080';
  try {
    const portFile = path.resolve(__dirname, '.env.backend_port');
    if (fs.existsSync(portFile)) {
      backendPort = fs.readFileSync(portFile, 'utf-8').trim();
    }
  } catch (e) {
    console.warn('Could not read backend port file, falling back to 8080');
  }

  return {
    plugins: [react()],
    define: {
      __BACKEND_PORT__: JSON.stringify(backendPort)
    },
    server: {
      proxy: {
        // Query string from request is preserved by http-proxy; final URL: https://www.sogou.com/web?query=...
        '/api/search/sogou': {
          target: 'https://www.sogou.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/search\/sogou/, '/web'),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.removeHeader('origin');
              proxyReq.removeHeader('referer');
              proxyReq.setHeader('user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
            });
          }
        },
        // Query string preserved; final URL: https://html.duckduckgo.com/html?q=...
        '/api/search/duckduckgo': {
          target: 'https://html.duckduckgo.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/search\/duckduckgo/, '/html'),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.removeHeader('origin');
              proxyReq.removeHeader('referer');
              proxyReq.setHeader('user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
            });
          }
        }
      }
    }
  };
});
