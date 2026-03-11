import { computed, Injectable, signal } from "@angular/core";

/**
 * Coordinates loading state across attributes-group (and nested RECORD/RECORD_ARRAY).
 * Used by create-editor and update-editor to enable Save only when structure is ready and form is valid/dirty.
 * Singleton: call reset() when entering create or edit mode so stale state from the other mode does not affect the Save button.
 */
@Injectable({ providedIn: "root" })
export class AttributeCoordinatorService {
  private loadingCount = signal(0);
  private structureReady = signal(false);

  /** True when all attribute resources have finished loading and the form structure has been built. */
  isFullyLoaded = computed(
    () => this.loadingCount() === 0 && this.structureReady(),
  );

  /** Clears loading state. Call when entering create or edit mode so the coordinator does not keep state from the previous mode. */
  reset(): void {
    this.loadingCount.set(0);
    this.structureReady.set(false);
  }

  startLoading() {
    this.structureReady.set(false);
    this.loadingCount.update((c) => c + 1);
  }

  stopLoading() {
    this.loadingCount.update((c) => Math.max(0, c - 1));
  }

  markStructureAsReady() {
    this.structureReady.set(true);
  }
}
