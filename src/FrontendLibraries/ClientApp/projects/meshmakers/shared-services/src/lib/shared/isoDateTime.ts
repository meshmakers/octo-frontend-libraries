import { formatISO, parseISO } from 'date-fns';

export class IsoDateTime {
  public static utcToLocalDateTimeIso(utcDateTime: string): string | null {
    if (!utcDateTime) {
      return null;
    }

    return parseISO(utcDateTime).toISOString();
  }

  public static localToUtcDateTimeIso(localDateTime: string): string | null {
    if (!localDateTime) {
      return null;
    }
    return formatISO(localDateTime);
  }

  public static currentUtcDateTimeIso(): string {
    return formatISO(Date.now());
  }
}
