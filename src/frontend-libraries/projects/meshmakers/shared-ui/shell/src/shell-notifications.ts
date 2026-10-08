import { NotificationDisplayOptions } from '@meshmakers/shared-ui';

/**
 * Toast stacking for a shell host (AB#5516 visual check: six identical "not found" errors
 * covered the top bar): identical messages once; errors leave after 10 s and warnings after
 * 8 s (paused while hovered or focused), except those with details, which wait for the user;
 * at most three toasts, a success/info is dropped before any error. Errors that must stay
 * pass `hideAfter: 0`.
 *
 * Use: `{ provide: NOTIFICATION_DISPLAY_OPTIONS, useValue: SHELL_NOTIFICATION_OPTIONS }`.
 * Placing `.k-notification-group` below the top bar is the host's global style.
 */
export const SHELL_NOTIFICATION_OPTIONS: NotificationDisplayOptions = {
  dedupe: true,
  errorHideAfter: 10_000,
  warningHideAfter: 8_000,
  stickyWithDetails: true,
  maxVisible: 3
};
