import { defineConfig } from 'vite';
import { resolve } from 'path';

// Custom domain serves at site root: https://passplusmotorcyclehk.com/
export default defineConfig({
  base: '/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        process: resolve(__dirname, 'process.html'),
      },
    },
  },
});
