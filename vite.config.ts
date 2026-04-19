import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

/**
 * 仅在生产构建且运行在 Vercel 上时用根路径 base。
 * 本地 `vite` 开发时即使误设了环境变量 VERCEL，也必须保持 /hicolor/，否则打开 /hicolor/ 会白屏。
 */
export default defineConfig(({mode, command}) => {
  const env = loadEnv(mode, '.', '');
  const isVercelProductionBuild = command === 'build' && Boolean(process.env.VERCEL);
  const BASE = isVercelProductionBuild ? '/' : '/hicolor/';
  /** 开发服务器：根路径重定向到 /hicolor/ */
  const shouldRedirectRoot = command === 'serve';

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
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    },
    optimizeDeps: {
      exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
    },
  };
});
