import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Pinned to 3000 (Vite's default is 5173) so it matches the backend's
  // default FRONTEND_ORIGIN in .env.example / index.js. If you change one,
  // change the other (or better: set FRONTEND_ORIGIN in your own .env).
  server: { port: 3000 },
});
