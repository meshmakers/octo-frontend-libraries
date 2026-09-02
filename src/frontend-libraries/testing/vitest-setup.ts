/**
 * Shared Vitest setup for all projects in this workspace.
 * Referenced via the `setupFiles` option of every `@angular/build:unit-test` target.
 * Execution order (enforced by the builder): polyfills.js (zone.js, zone.js/testing)
 * -> Angular TestBed initialisation -> this file -> spec files.
 */

// Wraps Vitest's describe/it/beforeEach/afterEach in zone.js ProxyZone so that
// fakeAsync/tick/flush/waitForAsync keep working. Requires zone.js/testing to be loaded already.
import 'zone.js/plugins/vitest-patch';

// ---- jsdom shims: APIs jsdom does not implement but specs spy on or components call unguarded ----

// navigator.clipboard (copyable-text, entity-id-info specs spy on writeText; process designer reads readText)
if (!('clipboard' in navigator)) {
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText: (): Promise<void> => Promise.resolve(),
      readText: (): Promise<string> => Promise.resolve(''),
    },
    configurable: true,
    writable: true,
  });
}

// window.fetch / Response / Request / Headers: defensive bridge from Node's globals.
// Under Vitest's jsdom environment `window === globalThis`, so these are normally already
// present (authorize.service.spec.ts spies on window.fetch and builds `new Response(...)`).
const w = window as unknown as Record<string, unknown>;
const g = globalThis as unknown as Record<string, unknown>;
for (const name of ['fetch', 'Response', 'Request', 'Headers']) {
  if (typeof w[name] === 'undefined' && typeof g[name] !== 'undefined') {
    w[name] = g[name];
  }
}

// URL.createObjectURL / revokeObjectURL (job-management.service.spec.ts spies on createObjectURL; defensive)
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = (): string => 'blob:vitest';
  URL.revokeObjectURL = (): void => undefined;
}

// ResizeObserver: Kendo and CDK feature-detect it; app code constructs it unguarded in a few components.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe(): void { /* no-op */ }
    unobserve(): void { /* no-op */ }
    disconnect(): void { /* no-op */ }
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
}

// HTMLElement.innerText: jsdom implements none. Kendo's SplitButton reads it in ngDoCheck
// (`this.wrapper?.innerText.split('\n')`) and would throw on undefined, so map it to textContent.
if (!('innerText' in HTMLElement.prototype)) {
  Object.defineProperty(HTMLElement.prototype, 'innerText', {
    get(this: HTMLElement): string {
      return this.textContent ?? '';
    },
    set(this: HTMLElement, value: string) {
      this.textContent = value;
    },
    configurable: true,
  });
}

// ---- Jasmine parity ----

// Jasmine restored every spy after each spec. Vitest does not by itself: vi.spyOn spies (and
// their call history) stay alive across tests unless restored. This hook restores them after
// every test, so specs keep Jasmine's fresh-spy-per-test behaviour without restoring by hand.
afterEach(() => {
  vi.restoreAllMocks();
});
