import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    // Hashed JS/CSS/fonts go to /static (cached forever); photos stay in /assets.
    assetsDir: 'static',
  },
  server: { host: '0.0.0.0', allowedHosts: ['terminal.local'] },
});
