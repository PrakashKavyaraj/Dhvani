import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

const envFilePath = path.resolve(__dirname, '.env.institution');

function readInstitutionEnv() {
  let apiKey = '';
  let endpoint = 'http://127.0.0.1:8000';
  if (fs.existsSync(envFilePath)) {
    const content = fs.readFileSync(envFilePath, 'utf-8');
    content.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [k, ...v] = trimmed.split('=');
        const val = v.join('=').trim();
        if (k.trim() === 'AEGIS_API_KEY') apiKey = val;
        if (k.trim() === 'AEGIS_ENDPOINT') endpoint = val;
      }
    });
  }
  return { apiKey, endpoint };
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'institution-backend-integration',
      configureServer(server) {
        // Dynamic config endpoints to check and read backend configuration live
        server.middlewares.use((req, res, next) => {
          if (req.url === '/api/institution/config') {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'no-store');
            const conf = readInstitutionEnv();
            return res.end(
              JSON.stringify({
                configured: !!conf.apiKey,
                endpoint: conf.endpoint,
                hasKey: !!conf.apiKey,
                maskedKey: conf.apiKey ? '••••••••••••••••' : '',
              })
            );
          }

          if (req.url === '/api/institution/key') {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'no-store');
            const conf = readInstitutionEnv();
            return res.end(
              JSON.stringify({
                apiKey: conf.apiKey,
                endpoint: conf.endpoint,
              })
            );
          }

          if (req.url === '/' || req.url === '/index.html') {
            req.url = '/institution.html';
          }
          next();
        });
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3001,
    host: true,
    open: '/institution.html',
  },
  build: {
    rollupOptions: {
      input: {
        institution: path.resolve(__dirname, 'institution.html'),
      },
    },
  },
});
