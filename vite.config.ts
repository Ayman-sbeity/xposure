import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react()],
  build: {
    outDir: 'dist',
    // Hashed JS/CSS/fonts go to /static (cached forever); photos stay in /assets.
    assetsDir: 'static',
    // The server bundle does not need its own copy of the photos.
    copyPublicDir: !isSsrBuild,
    rollupOptions: {
      // The website and the admin panel are built together.
      input: { main: 'index.html', admin: 'admin.html' },
    },
  },
}));
