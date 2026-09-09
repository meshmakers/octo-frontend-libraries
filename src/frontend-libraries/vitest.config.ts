import { defineConfig } from 'vitest/config';

// Loaded by every `@angular/build:unit-test` target through its `runnerConfig` option.
// The shared CI agents are slow enough for TestBed-heavy hooks and specs to exceed
// Vitest's 5 s / 10 s defaults while three suites run side by side.
export default defineConfig({
  test: {
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
