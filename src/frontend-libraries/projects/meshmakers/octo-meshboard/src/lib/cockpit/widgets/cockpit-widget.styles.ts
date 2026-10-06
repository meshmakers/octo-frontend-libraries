/**
 * Shared styles of the cockpit widgets (AB#5558). Neutral, theme-agnostic defaults: every colour
 * is a `--mm-cockpit-*` custom property falling back to the Kendo theme colour, so a host maps
 * them to its own tokens (the Refinery Studio maps them to Deep Sea in its `styles.scss`).
 * Status is never colour alone: chips carry a dot and a label.
 */
export const COCKPIT_WIDGET_STYLES = `
  :host {
    display: block;
    width: 100%;
    height: 100%;
    --_cw-text: var(--mm-cockpit-text, var(--kendo-color-on-app-surface, #1f2937));
    --_cw-muted: var(--mm-cockpit-text-muted, var(--kendo-color-subtle, #6b7280));
    --_cw-surface: var(--mm-cockpit-surface, transparent);
    --_cw-border: var(--mm-cockpit-border, var(--kendo-color-border, rgba(0, 0, 0, 0.12)));
    --_cw-border-strong: var(--mm-cockpit-border-strong, var(--kendo-color-subtle, rgba(0, 0, 0, 0.3)));
    --_cw-success: var(--mm-cockpit-success, var(--kendo-color-success, #2e7d32));
    --_cw-warning: var(--mm-cockpit-warning, var(--kendo-color-warning, #b26a00));
    --_cw-error: var(--mm-cockpit-error, var(--kendo-color-error, #c62828));
    --_cw-info: var(--mm-cockpit-info, var(--kendo-color-info, #0277bd));
    --_cw-neutral: var(--mm-cockpit-neutral, var(--kendo-color-subtle, #6b7280));
    --_cw-accent: var(--mm-cockpit-accent, var(--kendo-color-primary, #1976d2));
    --_cw-ai: var(--mm-cockpit-ai, #7c3aed);
    color: var(--_cw-text);
  }

  .cw-status-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 20px;
    padding: 0 7px;
    border-radius: 4px;
    font-size: 0.71875rem;
    font-weight: 500;
    white-space: nowrap;
    color: var(--_cw-chip);
    background: color-mix(in srgb, var(--_cw-chip) 14%, transparent);
  }
  .cw-status-chip::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
  }
  .cw-status-success { --_cw-chip: var(--_cw-success); }
  .cw-status-warning { --_cw-chip: var(--_cw-warning); }
  .cw-status-error { --_cw-chip: var(--_cw-error); }
  .cw-status-info { --_cw-chip: var(--_cw-info); }
  .cw-status-neutral { --_cw-chip: var(--_cw-neutral); }

  .cw-message {
    margin: 0;
    padding: 12px;
    color: var(--_cw-muted);
    font-size: 0.8125rem;
  }

  a:focus-visible, button:focus-visible {
    outline: 2px solid var(--_cw-accent);
    outline-offset: 2px;
  }
`;
