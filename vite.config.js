import { defineConfig } from 'vite';
import { resolve } from 'path';

// GitHub Pages project site: https://passplusmotorcycle.github.io/passplus-website-build/
const base = process.env.GITHUB_PAGES === 'true' ? '/passplus-website-build/' : '/';

export default defineConfig({
  base,
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        process: resolve(__dirname, 'process.html'),
      },
    },
  },
});
