export interface ThemeSwitcherMessages {
  toggleToDark: string;
  toggleToLight: string;
  /** Aria label when the tenant disabled dark mode (switcher is locked). */
  unavailable: string;
}

export const DEFAULT_THEME_SWITCHER_MESSAGES: ThemeSwitcherMessages = {
  toggleToDark: 'Switch to dark mode',
  toggleToLight: 'Switch to light mode',
  unavailable: 'Theme switching is unavailable for this tenant',
};
