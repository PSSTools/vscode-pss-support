import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Repo-level tests: packaging metadata, static contributions, and
    // cross-checks against pssparser. Per-package tests live in client/ and
    // server/ and run under their own configs.
    include: ['test/**/*.test.ts'],
  },
});
