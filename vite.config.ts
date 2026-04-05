import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

/** 与仓库名一致，便于 Cursor 简单浏览器打开「项目名」路径；根路径 / 会重定向到此处 */
const BASE = '/hicolor/';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: BASE,
    plugins: [
      {
        name: 'redirect-root-to-base',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const pathOnly = req.url?.split('?')[0] ?? '';
            if (pathOnly === '/' || pathOnly === '') {
              res.statusCode = 302;
              res.setHeader('Location', BASE);
              res.end();
              return;
            }
            if (pathOnly === '/hicolor') {
              res.statusCode = 302;
              res.setHeader('Location', BASE);
              res.end();
              return;
            }
            next();
          });
        },
      },
      react(),
      tailwindcss(),
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
