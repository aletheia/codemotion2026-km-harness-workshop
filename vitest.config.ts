import { defineConfig } from 'vitest/config';

// Several tests start the real CLI tools (tsx cold start), so allow generous time on slow machines.
export default defineConfig({ test: { testTimeout: 120_000, hookTimeout: 120_000, include: ['test/**/*.test.ts'] } });
