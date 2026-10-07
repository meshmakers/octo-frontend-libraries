import { computed, inject, InjectionToken, Signal } from '@angular/core';

/**
 * UI strings of the shell building blocks (`mm-shell-rail`, `mm-space-shell`,
 * `mm-settings-side-nav`, `mm-shell-top-bar`, `mm-shell-user-menu`) and of the
 * pure helpers (greeting, environment chip).
 *
 * Hosts translate them in two ways, which can be combined:
 * - app wide: `{ provide: SHELL_MESSAGES, useValue: { signIn: 'Anmelden', … } }`;
 * - per component: the `messages` input (wins over the token).
 *
 * Missing, `undefined` or `null` members keep the English default of
 * {@link DEFAULT_SHELL_MESSAGES}. Strings with `{name}` placeholders are filled with
 * {@link formatShellMessage}.
 */
export interface ShellMessages {
  // --- Shared ---
  /** Screen-reader text after an external link marker (↗). */
  opensInNewTab: string;

  // --- Rail ---
  /** `aria-label` of the rail navigation. */
  railLabel: string;

  // --- Space shell ---
  /** `aria-label` of the back link on object detail pages; `{target}` = list name. */
  backTo: string;
  /** `aria-label` of the status chip list. */
  statusChips: string;
  /** `aria-label` of the tab strip; `{area}` = area name. */
  areaPages: string;

  // --- Settings side navigation ---
  /** `aria-label` of the side navigation; `{area}` = area name. */
  areaCategories: string;
  /** The "home" entry of the side navigation; `{area}` = area name in lower case. */
  allOfArea: string;

  // --- Top bar ---
  /** `aria-label` of the mode switch group. */
  modeSwitch: string;
  /** `aria-label` of the search trigger. */
  searchAriaLabel: string;
  /** Visible text of the search trigger. */
  search: string;
  /** Visible text of the assistant toggle. */
  assistant: string;

  // --- User menu ---
  signIn: string;
  signOut: string;
  /** Title (`aria-label`) of the account panel. */
  accountAndPreferences: string;
  /** `aria-label` of the avatar button for a known user; `{name}` = display name. */
  accountAndPreferencesOf: string;
  theme: string;
  themeSystem: string;
  themeLight: string;
  themeDark: string;
  density: string;
  language: string;
  manageProfile: string;
  /** Version line; `{version}` = version string. */
  version: string;

  // --- Environment chip ---
  environmentProduction: string;
  environmentProductionShort: string;
  environmentStaging: string;
  environmentStagingShort: string;
  environmentDevelopment: string;
  environmentDevelopmentShort: string;
  environmentTesting: string;
  environmentTestingShort: string;
  environmentUnknown: string;
  environmentUnknownShort: string;

  // --- Home greeting ---
  greetingMorning: string;
  greetingAfternoon: string;
  greetingEvening: string;
  /** Greeting with a name; `{greeting}` = phrase, `{name}` = first name. */
  greetingWithName: string;
  /** Meta line label of the tenant. */
  tenant: string;
}

/** English defaults of {@link ShellMessages}. */
export const DEFAULT_SHELL_MESSAGES: ShellMessages = {
  opensInNewTab: '(opens in a new tab)',
  railLabel: 'Areas',
  backTo: 'Back to {target}',
  statusChips: 'Status',
  areaPages: '{area} pages',
  areaCategories: '{area} categories',
  allOfArea: 'All {area}',
  modeSwitch: 'Mode',
  searchAriaLabel: 'Search or run a command',
  search: 'Search',
  assistant: 'Assistant',
  signIn: 'Sign in',
  signOut: 'Sign out',
  accountAndPreferences: 'Account and preferences',
  accountAndPreferencesOf: 'Account and preferences of {name}',
  theme: 'Theme',
  themeSystem: 'System',
  themeLight: 'Light',
  themeDark: 'Dark',
  density: 'Density',
  language: 'Language',
  manageProfile: 'Manage profile',
  version: 'Version {version}',
  environmentProduction: 'Production',
  environmentProductionShort: 'Prod',
  environmentStaging: 'Staging',
  environmentStagingShort: 'Stage',
  environmentDevelopment: 'Development',
  environmentDevelopmentShort: 'Dev',
  environmentTesting: 'Testing',
  environmentTestingShort: 'Test',
  environmentUnknown: 'Environment unknown',
  environmentUnknownShort: 'Env?',
  greetingMorning: 'Good morning',
  greetingAfternoon: 'Good afternoon',
  greetingEvening: 'Good evening',
  greetingWithName: '{greeting}, {name}',
  tenant: 'Tenant',
};

/**
 * App-wide translations of the shell. Partial: members left out keep their English default.
 */
export const SHELL_MESSAGES = new InjectionToken<Partial<ShellMessages>>('SHELL_MESSAGES');

/**
 * Merges message overrides over {@link DEFAULT_SHELL_MESSAGES}, later sources winning.
 * Members that are missing, `undefined` or `null` keep the earlier value, so a host compiled
 * against an older `ShellMessages` shape never renders an empty label.
 */
export function resolveShellMessages(...overrides: (Partial<ShellMessages> | null | undefined)[]): ShellMessages {
  const resolved: ShellMessages = { ...DEFAULT_SHELL_MESSAGES };
  for (const messages of overrides) {
    if (!messages) {
      continue;
    }
    for (const key of Object.keys(messages) as (keyof ShellMessages)[]) {
      const value = messages[key];
      if (value !== undefined && value !== null) {
        resolved[key] = value;
      }
    }
  }
  return resolved;
}

/** Replaces `{name}` placeholders; unknown placeholders stay as they are. */
export function formatShellMessage(message: string, values: Record<string, string | number>): string {
  return message.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match);
}

/**
 * The resolved messages of a shell component: {@link SHELL_MESSAGES} merged with the
 * component's `messages` input (the input wins). Call it in an injection context.
 * @internal
 */
export function shellMessages(input: Signal<Partial<ShellMessages> | null | undefined>): Signal<ShellMessages> {
  const injected = inject(SHELL_MESSAGES, { optional: true });
  return computed(() => resolveShellMessages(injected, input()));
}
