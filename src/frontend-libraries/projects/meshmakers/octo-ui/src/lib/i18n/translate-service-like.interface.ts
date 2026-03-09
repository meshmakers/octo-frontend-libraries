export interface TranslateServiceLike {
  instant: (key: string) => string;
  use: (languageCode: string) => unknown;
}
