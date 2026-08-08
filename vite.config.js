import { defineConfig } from 'vite';
import { resolve } from 'path';

// Custom domain serves at site root: https://passplusmotorcyclehk.com/
export default defineConfig({
  base: '/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        process: resolve(import.meta.dirname, 'process.html'),
      },
    },
  },
});
