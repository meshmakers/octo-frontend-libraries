/**
 * Legacy IsoDateTime utility class for backward compatibility.
 * Uses native Date API instead of date-fns.
 */
export class IsoDateTime {
  public static utcToLocalDateTimeIso(utcDateTime: string): string | null {
    if (!utcDateTime) {
      return null;
    }
    return new Date(utcDateTime).toISOString();
  }

  public static localToUtcDateTimeIso(localDateTime: string): string | null {
    if (!localDateTime) {
      return null;
    }
    return new Date(localDateTime).toISOString();
  }

  public static currentUtcDateTimeIso(): string {
    return new Date().toISOString();
  }
}
