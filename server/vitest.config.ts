import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // The package tests pack and install the server; see vitest.package.config.ts.
    exclude: [...configDefaults.exclude, 'test/package/**'],
    setupFiles: ['test/setup.ts'],
    benchmark: {
      include: ['bench/**/*-bench.ts'],
    },
  },
});
