import { Injectable, signal, TemplateRef } from '@angular/core';

/** A status chip in the space header: dot + label, never colour alone. */
export interface SpaceStatusChip {
  label: string;
  status: 'success' | 'warning' | 'error' | 'info' | 'neutral';
}

/**
 * Lets the page shown inside a space contribute to the space header: status
 * chips next to the title and a template for the primary actions.
 *
 * A page sets them in its constructor or `ngOnInit` and never cleans up: the
 * shell calls {@link mark} when a navigation starts and
 * {@link clearOlderThan} when it ends with a different page component, which
 * drops only what the previous page contributed. A cancelled navigation or a
 * param-only change (same component) keeps the chips.
 */
@Injectable({ providedIn: 'root' })
export class SpaceHeaderService {
  private readonly _chips = signal<SpaceStatusChip[]>([]);
  private readonly _actions = signal<TemplateRef<unknown> | null>(null);
  private stamp = 0;
  private chipsStamp = 0;
  private actionsStamp = 0;

  readonly chips = this._chips.asReadonly();
  readonly actions = this._actions.asReadonly();

  setChips(chips: SpaceStatusChip[]): void {
    this._chips.set(chips);
    this.chipsStamp = ++this.stamp;
  }

  setActions(actions: TemplateRef<unknown> | null): void {
    this._actions.set(actions);
    this.actionsStamp = ++this.stamp;
  }

  /** A marker for "now"; contributions made after it count as newer. */
  mark(): number {
    return this.stamp;
  }

  /** Drops every contribution made at or before the marker. */
  clearOlderThan(marker: number): void {
    if (this.chipsStamp <= marker) {
      this._chips.set([]);
    }
    if (this.actionsStamp <= marker) {
      this._actions.set(null);
    }
  }
}
