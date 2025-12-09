import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => ({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/test/**/*.test.ts'],
    env: loadEnv(mode, process.cwd(), ''),
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/test/**/*.ts', 'src/index.ts'],
    },
    setupFiles: ['./src/test/setup.ts'],
  },
}));
