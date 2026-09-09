import { ErrorHandler, Injectable, Provider } from '@angular/core';

/**
 * Recognises errors that indicate the loaded JS bundle no longer matches the
 * server (typical symptoms after a redeploy while the tab was in the
 * background): the browser fails to fetch a lazy chunk whose hash changed,
 * and Angular then falls back to JIT compilation which is not available in
 * AOT builds.
 */
function isStaleChunkError(error: unknown): boolean {
  if (!error) {
    return false;
  }
  const message = typeof error === 'string'
    ? error
    : (error as { message?: string }).message ?? '';
  return (
    message.includes('Loading chunk') ||
    message.includes('JIT compiler unavailable') ||
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed') ||
    message.includes('ChunkLoadError')
  );
}

const RELOAD_FLAG_KEY = 'octo_stale_chunk_reload_at';
// Window during which a second reload is suppressed to avoid infinite loops
// when the chunk error keeps happening even on the fresh bundle.
const RELOAD_GUARD_WINDOW_MS = 30_000;

/**
 * Angular ErrorHandler that recovers from stale-bundle errors by reloading
 * the page once. A guard flag in sessionStorage prevents reload loops if the
 * error keeps re-occurring on the fresh bundle.
 *
 * Non-chunk errors are delegated to the default ErrorHandler implementation.
 */
@Injectable()
export class StaleChunkErrorHandler extends ErrorHandler {
  override handleError(error: unknown): void {
    if (isStaleChunkError(error)) {
      this.attemptReload(error);
      return;
    }
    super.handleError(error);
  }

  private attemptReload(error: unknown): void {
    try {
      const now = Date.now();
      const last = Number(sessionStorage.getItem(RELOAD_FLAG_KEY) ?? '0');
      if (last && now - last < RELOAD_GUARD_WINDOW_MS) {
        console.error(
          'StaleChunkErrorHandler: stale-chunk error after recent reload — not reloading again to avoid a loop',
          error
        );
        super.handleError(error);
        return;
      }
      sessionStorage.setItem(RELOAD_FLAG_KEY, String(now));
      console.warn(
        'StaleChunkErrorHandler: detected stale bundle / lazy-chunk error — reloading page',
        error
      );
      window.location.reload();
    } catch (reloadErr) {
      console.error('StaleChunkErrorHandler: reload attempt failed', reloadErr);
      super.handleError(error);
    }
  }
}

/**
 * Registers {@link StaleChunkErrorHandler} as the application's global
 * ErrorHandler. Add to the root `providers` array.
 */
export function provideStaleChunkRecovery(): Provider {
  return { provide: ErrorHandler, useClass: StaleChunkErrorHandler };
}
