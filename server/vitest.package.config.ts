import { defineConfig } from 'vitest/config';

// The package tests (`npm run test:package`): pack the server, install the
// tarball outside the repo and test the installed bin. Kept out of the default
// config because packing rebuilds `out/` and installing needs npm's registry
// or cache. See test/package/globalSetup.ts.
export default defineConfig({
  test: {
    include: ['test/package/**/*.test.ts'],
    globalSetup: ['test/package/globalSetup.ts'],
    testTimeout: 30_000,
  },
});
