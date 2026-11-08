import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    hookTimeout: 60_000,
    testTimeout: 60_000,
    // Database tests share one scratch schema; run files sequentially.
    fileParallelism: false,
    setupFiles: ['test/setup.ts'],
  },
});
