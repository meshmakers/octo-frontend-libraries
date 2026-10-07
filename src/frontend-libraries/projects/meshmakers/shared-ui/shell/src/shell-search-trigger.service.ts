import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

/**
 * Hook between the top bar's search button and the command palette (AB#5520).
 *
 * The shell only announces that the person asked for search; it does not
 * know the palette. The host (or the palette) subscribes once and opens it:
 *
 * ```ts
 * inject(ShellSearchTriggerService).requested$
 *   .pipe(takeUntilDestroyed())
 *   .subscribe(() => commandPalette.open());
 * ```
 *
 * Until something subscribes, a click is a no-op. The keyboard shortcut
 * (Cmd/Ctrl+K) is not bound here — it belongs to the palette, which can call
 * {@link request} or open itself directly.
 */
@Injectable({ providedIn: 'root' })
export class ShellSearchTriggerService {
  private readonly requests = new Subject<void>();

  /** Emits every time search was requested from the shell. */
  readonly requested$: Observable<void> = this.requests.asObservable();

  request(): void {
    this.requests.next();
  }
}
