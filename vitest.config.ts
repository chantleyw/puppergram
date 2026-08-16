import { defineConfig } from 'vitest/config';

/**
 * Separate from vite.config.ts on purpose: the tests cover pure logic only
 * (triage, parsing, the demo seed), so they need no React plugin, no PWA
 * generation and no DOM.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
