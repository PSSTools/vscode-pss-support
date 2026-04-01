import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'core',
          include: ['test/core/**/*.test.ts'],
          coverage: {
            provider: 'v8',
            include: ['src/core/**/*.ts'],
            thresholds: {
              lines: 90,
              functions: 90,
              branches: 80,
              statements: 90,
            },
          },
        },
      },
      {
        test: {
          name: 'lsp',
          include: ['test/lsp/**/*.test.ts'],
        },
      },
    ],
    benchmark: {
      include: ['bench/**/*.bench.ts'],
    },
  },
});
