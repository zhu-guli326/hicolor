import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

/**
 * Vercel 部署在根路径；GitHub Pages 部署在 /hicolor/ 子路径。
 * Vercel 会设置 VERCEL=true 环境变量。
 */
const isVercel = process.env.VERCEL === 'true';
const BASE = isVercel ? '/' : '/hicolor/';

/**
 * 本地开发时：若项目路径不是 /hicolor/，重定向到 /hicolor/（与 GitHub Pages 保持一致）。
 * Vercel 部署时跳过此重定向，直接使用根路径。
 */
const shouldRedirectRoot = !isVercel;

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: BASE,
    plugins: [
      {
        name: 'redirect-root-to-base',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (!shouldRedirectRoot) {
              next();
              return;
            }
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
