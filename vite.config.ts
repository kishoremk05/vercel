import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
  base:process.env.VITE_BASE_PATH || "/vercel",
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      // Firebase web SDK uses VITE_* envs; loadEnv already pulled them in
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      server: {
        // SPA fallback: Vite does this by default for 404s, but we also avoid proxying plain paths
        proxy: {
          '/send-sms': {
            target: 'http://localhost:3002',
            changeOrigin: true,
          },
          '/send-whatsapp': {
            target: 'http://localhost:3002',
            changeOrigin: true,
          },
          '/send-whatsapp-template': {
            target: 'http://localhost:3002',
            changeOrigin: true,
          },
          '/send-twilio-whatsapp': {
            target: 'http://localhost:3002',
            changeOrigin: true,
          },
          '/health': {
            target: 'http://localhost:3002',
            changeOrigin: true,
          },
          '/wa-verify': {
            target: 'http://localhost:3002',
            changeOrigin: true,
          },
          '/wa-list-numbers': {
            target: 'http://localhost:3002',
            changeOrigin: true,
          },
          '/api/feedback': {
            target: 'http://localhost:3002',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, ''),
          },
          '/api/dashboard': {
            target: 'http://localhost:3002',
            changeOrigin: true,
          },
          '/api/negative-comments': {
            target: 'http://localhost:3002',
            changeOrigin: true,
          },
          '/api/company': {
            target: 'http://localhost:3002',
            changeOrigin: true,
          },
          '/api/admin': {
            target: 'http://localhost:3002',
            changeOrigin: true,
          },
          // Proxy only the auth API endpoints. Let Vite serve the /auth SPA route
          // so client-side navigation and direct visits don't hit the backend.
          '/auth/login': {
            target: 'http://localhost:3002',
            changeOrigin: true,
          },
          '/auth/signup': {
            target: 'http://localhost:3002',
            changeOrigin: true,
          },
          '/admin/': {
            target: 'http://localhost:3002',
            changeOrigin: true,
          },
        }
      }
    };
});
