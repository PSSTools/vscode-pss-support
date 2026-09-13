/**
 * Global test hooks. Wired in through `vitest.config.ts` `setupFiles`.
 */
import { afterEach } from 'vitest';

import { disposeIndexes } from './helpers/Indexes.js';

// Release the WASM parser sessions the test just created. See Indexes.ts.
afterEach(() => {
  disposeIndexes();
});
