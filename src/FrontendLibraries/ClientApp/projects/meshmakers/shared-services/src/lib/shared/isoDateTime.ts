import * as moment from 'moment';

export class IsoDateTime {
  public static utcToLocalDateTimeIso(utcDateTime: string) {
    if (!utcDateTime) {
      return null;
    }
    return moment(utcDateTime).local().format("YYYY-MM-DDTHH:mm:ss");
  }

  public static localToUtcDateTimeIso(localDateTime: string) {
    if (!localDateTime) {
      return null;
    }
    return moment(localDateTime).toISOString();
  }

  public static currentUtcDateTimeIso() {
    return moment(Date.now()).toISOString();
  }
}
