/** Two-stop linear gradient; applied at 90deg by the theme application layer. */
export interface ThemeGradient {
  startColor: string;
  endColor: string;
}

/** Palette consumed by the theme layer (Kendo + app CSS variables). */
export interface ThemePalette {
  primaryColor: string;
  secondaryColor: string;
  tertiaryColor: string;
  neutralColor: string;
  backgroundColor: string;
  headerGradient: ThemeGradient;
  footerGradient: ThemeGradient;
}
