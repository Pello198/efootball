import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        auth: resolve(__dirname, 'auth.html'),
        fixtures: resolve(__dirname, 'fixtures.html'),
        tournament: resolve(__dirname, 'tournament.html'),
      },
    },
  },
});