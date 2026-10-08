import { Injectable, signal } from '@angular/core';

/** Badge of one Settings category in the side navigation. */
export interface SettingsSideNavBadge {
  count: number;
  /** Needs attention (open re-entry tasks): rendered as a warning badge. */
  attention?: boolean;
  /** Accessible label of the badge; without one the count is read as is. */
  label?: string;
}

/**
 * Counts and badges of the Settings side navigation, keyed by shell tab id
 * (`settings-<category>`). The Settings home fills them when it has loaded its
 * categories (forms + custom pages) and the secrets inventory; until then, and on a
 * deep link to another Settings page, the categories are shown without counts.
 */
@Injectable({ providedIn: 'root' })
export class SettingsSideNavBadgesService {
  private readonly _badges = signal<Record<string, SettingsSideNavBadge>>({});

  readonly badges = this._badges.asReadonly();

  set(badges: Record<string, SettingsSideNavBadge>): void {
    this._badges.set(badges);
  }
}
