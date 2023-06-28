import * as moment from 'moment';

export class IsoDateTime {
  public static utcToLocalDateTimeIso(utcDateTime: string): string | null {
    if (!utcDateTime) {
      return null;
    }
    return moment(utcDateTime).local().format('YYYY-MM-DDTHH:mm:ss');
  }

  public static localToUtcDateTimeIso(localDateTime: string): string | null {
    if (!localDateTime) {
      return null;
    }
    return moment(localDateTime).toISOString();
  }

  public static currentUtcDateTimeIso(): string {
    return moment(Date.now()).toISOString();
  }
}
