import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 1951,
    strictPort: true
  },
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
      },
    },
  },
});
