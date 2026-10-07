import { ShellMessages, resolveShellMessages } from './shell.messages';

/** Status colour of a chip; the label always carries the meaning as well (never colour alone). */
export type ShellStatus = 'success' | 'warning' | 'error' | 'info' | 'neutral';

/** The environment chip next to the tenant switcher in `mm-shell-top-bar`. */
export interface ShellEnvironmentChip {
  label: string;
  /** Shown on narrow screens, so the environment never becomes colour-only. */
  short: string;
  status: ShellStatus;
  /** Marks the whole top bar as production (accent line). */
  production?: boolean;
}

/** Tenant environment modes of the OctoMesh tenant mode configuration. */
export type ShellEnvironmentMode = 'PRODUCTION' | 'STAGING' | 'DEVELOPMENT' | 'TESTING' | 'unknown';

/**
 * The environment chip of a tenant mode, in sentence case with its status colour:
 * Production (error, marks the bar), Staging (warning), Development (success),
 * Testing (info), anything else "Environment unknown" (neutral).
 */
export function shellEnvironmentChip(
  mode: ShellEnvironmentMode | string | null | undefined,
  messages?: Partial<ShellMessages> | null
): ShellEnvironmentChip {
  const m = resolveShellMessages(messages);
  switch (mode) {
    case 'PRODUCTION':
      return { label: m.environmentProduction, short: m.environmentProductionShort, status: 'error', production: true };
    case 'STAGING':
      return { label: m.environmentStaging, short: m.environmentStagingShort, status: 'warning' };
    case 'DEVELOPMENT':
      return { label: m.environmentDevelopment, short: m.environmentDevelopmentShort, status: 'success' };
    case 'TESTING':
      return { label: m.environmentTesting, short: m.environmentTestingShort, status: 'info' };
    default:
      return { label: m.environmentUnknown, short: m.environmentUnknownShort, status: 'neutral' };
  }
}
