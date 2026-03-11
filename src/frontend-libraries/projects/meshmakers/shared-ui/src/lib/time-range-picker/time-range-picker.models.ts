/**
 * The type of time range selection
 */
export type TimeRangeType = 'year' | 'quarter' | 'month' | 'day' | 'relative' | 'custom';

/**
 * The unit for relative time calculations
 */
export type RelativeTimeUnit = 'hours' | 'days' | 'weeks' | 'months';

/**
 * Represents a time range with start and end dates
 */
export interface TimeRange {
  /** Start of the time range */
  from: Date;
  /** End of the time range */
  to: Date;
}

/**
 * Represents a time range as ISO 8601 strings
 */
export interface TimeRangeISO {
  /** Start of the time range in ISO 8601 format */
  from: string;
  /** End of the time range in ISO 8601 format */
  to: string;
}

/**
 * Quarter number (1-4)
 */
export type Quarter = 1 | 2 | 3 | 4;

/**
 * Configuration for the time range picker
 */
export interface TimeRangePickerConfig {
  /** Available range types to show. Defaults to all. */
  availableTypes?: TimeRangeType[];
  /** Minimum selectable year. Defaults to current year - 10. */
  minYear?: number;
  /** Maximum selectable year. Defaults to current year + 1. */
  maxYear?: number;
  /** Default relative time value. Defaults to 24. */
  defaultRelativeValue?: number;
  /** Default relative time unit. Defaults to 'hours'. */
  defaultRelativeUnit?: RelativeTimeUnit;
  /** Minimum date for custom range. */
  minDate?: Date;
  /** Maximum date for custom range. */
  maxDate?: Date;
  /** Show time in custom date pickers. Defaults to false. */
  showTime?: boolean;
}

/**
 * The current selection state of the time range picker
 */
export interface TimeRangeSelection {
  type: TimeRangeType;
  year?: number;
  quarter?: Quarter;
  month?: number;
  /** Day of month (1-31), used with 'day' type */
  day?: number;
  relativeValue?: number;
  relativeUnit?: RelativeTimeUnit;
  customFrom?: Date;
  customTo?: Date;
}

/**
 * Option for dropdown selections
 */
export interface TimeRangeOption<T = string | number> {
  value: T;
  label: string;
}

/**
 * Labels for the time range picker UI
 */
export interface TimeRangePickerLabels {
  rangeType?: string;
  year?: string;
  quarter?: string;
  month?: string;
  day?: string;
  relativeValue?: string;
  relativeUnit?: string;
  customFrom?: string;
  customTo?: string;
  // Type labels
  typeYear?: string;
  typeQuarter?: string;
  typeMonth?: string;
  typeDay?: string;
  typeRelative?: string;
  typeCustom?: string;
  // Relative unit labels
  unitHours?: string;
  unitDays?: string;
  unitWeeks?: string;
  unitMonths?: string;
  // Quarter labels
  quarter1?: string;
  quarter2?: string;
  quarter3?: string;
  quarter4?: string;
}

/**
 * Default labels for the time range picker
 */
export const DEFAULT_TIME_RANGE_LABELS: TimeRangePickerLabels = {
  rangeType: 'Range Type',
  year: 'Year',
  quarter: 'Quarter',
  month: 'Month',
  day: 'Day',
  relativeValue: 'Last',
  relativeUnit: 'Unit',
  customFrom: 'From',
  customTo: 'To',
  typeYear: 'Year',
  typeQuarter: 'Quarter',
  typeMonth: 'Month',
  typeDay: 'Day',
  typeRelative: 'Relative',
  typeCustom: 'Custom',
  unitHours: 'Hours',
  unitDays: 'Days',
  unitWeeks: 'Weeks',
  unitMonths: 'Months',
  quarter1: 'Q1 (Jan-Mar)',
  quarter2: 'Q2 (Apr-Jun)',
  quarter3: 'Q3 (Jul-Sep)',
  quarter4: 'Q4 (Oct-Dec)'
};

/**
 * Utility functions for time range calculations
 */
export class TimeRangeUtils {
  /**
   * Calculate time range for a specific year.
   * Uses exclusive end boundary (start of next year) for correct LESS_THAN filtering.
   */
  static getYearRange(year: number): TimeRange {
    return {
      from: new Date(year, 0, 1, 0, 0, 0, 0),
      to: new Date(year + 1, 0, 1, 0, 0, 0, 0)
    };
  }

  /**
   * Calculate time range for a specific quarter.
   * Uses exclusive end boundary (start of next quarter) for correct LESS_THAN filtering.
   */
  static getQuarterRange(year: number, quarter: Quarter): TimeRange {
    const startMonth = (quarter - 1) * 3;
    return {
      from: new Date(year, startMonth, 1, 0, 0, 0, 0),
      to: new Date(year, startMonth + 3, 1, 0, 0, 0, 0)
    };
  }

  /**
   * Calculate time range for a specific month.
   * Uses exclusive end boundary (start of next month) for correct LESS_THAN filtering.
   */
  static getMonthRange(year: number, month: number): TimeRange {
    return {
      from: new Date(year, month, 1, 0, 0, 0, 0),
      to: new Date(year, month + 1, 1, 0, 0, 0, 0)
    };
  }

  /**
   * Calculate time range for a specific day.
   * Uses exclusive end boundary (start of next day) for correct LESS_THAN filtering.
   */
  static getDayRange(year: number, month: number, day: number): TimeRange {
    return {
      from: new Date(Date.UTC(year, month, day, 0, 0, 0, 0)),
      to: new Date(Date.UTC(year, month, day + 1, 0, 0, 0, 0))
    };
  }

  /**
   * Calculate time range relative to now
   */
  static getRelativeRange(value: number, unit: RelativeTimeUnit): TimeRange {
    const now = new Date();
    const from = new Date(now);

    switch (unit) {
      case 'hours':
        from.setHours(from.getHours() - value);
        break;
      case 'days':
        from.setDate(from.getDate() - value);
        break;
      case 'weeks':
        from.setDate(from.getDate() - (value * 7));
        break;
      case 'months':
        from.setMonth(from.getMonth() - value);
        break;
    }

    return { from, to: now };
  }

  /**
   * Calculate time range from selection.
   * @param selection The current selection state
   * @param showTime If false (default), custom date ranges are normalized to full-day boundaries
   *                 with exclusive end (from: 00:00:00 UTC, to: start of next day 00:00:00 UTC)
   */
  static getTimeRangeFromSelection(selection: TimeRangeSelection, showTime = false): TimeRange | null {
    switch (selection.type) {
      case 'year':
        if (selection.year) {
          return this.getYearRange(selection.year);
        }
        break;
      case 'quarter':
        if (selection.year && selection.quarter) {
          return this.getQuarterRange(selection.year, selection.quarter);
        }
        break;
      case 'month':
        if (selection.year && selection.month !== undefined) {
          return this.getMonthRange(selection.year, selection.month);
        }
        break;
      case 'day':
        if (selection.year && selection.month !== undefined && selection.day !== undefined) {
          return this.getDayRange(selection.year, selection.month, selection.day);
        }
        break;
      case 'relative':
        if (selection.relativeValue && selection.relativeUnit) {
          return this.getRelativeRange(selection.relativeValue, selection.relativeUnit);
        }
        break;
      case 'custom':
        if (selection.customFrom && selection.customTo) {
          if (showTime) {
            // Keep the user-selected time as-is
            return {
              from: selection.customFrom,
              to: selection.customTo
            };
          }
          // Normalize to full-day boundaries in UTC (exclusive end, like year/quarter/month)
          const from = new Date(selection.customFrom);
          from.setUTCHours(0, 0, 0, 0);
          const to = new Date(selection.customTo);
          to.setUTCHours(0, 0, 0, 0);
          to.setUTCDate(to.getUTCDate() + 1);
          return { from, to };
        }
        break;
    }
    return null;
  }

  /**
   * Convert TimeRange to ISO 8601 format
   */
  static toISO(range: TimeRange): TimeRangeISO {
    return {
      from: range.from.toISOString(),
      to: range.to.toISOString()
    };
  }

  /**
   * Get current quarter (1-4)
   */
  static getCurrentQuarter(): Quarter {
    return (Math.floor(new Date().getMonth() / 3) + 1) as Quarter;
  }

  /**
   * Generate year options
   */
  static generateYearOptions(minYear: number, maxYear: number): TimeRangeOption<number>[] {
    const options: TimeRangeOption<number>[] = [];
    for (let year = maxYear; year >= minYear; year--) {
      options.push({ value: year, label: year.toString() });
    }
    return options;
  }

  /**
   * Generate month options
   */
  static generateMonthOptions(): TimeRangeOption<number>[] {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months.map((label, index) => ({ value: index, label }));
  }

  /**
   * Generate quarter options with custom labels
   */
  static generateQuarterOptions(labels: TimeRangePickerLabels): TimeRangeOption<Quarter>[] {
    return [
      { value: 1, label: labels.quarter1 || 'Q1' },
      { value: 2, label: labels.quarter2 || 'Q2' },
      { value: 3, label: labels.quarter3 || 'Q3' },
      { value: 4, label: labels.quarter4 || 'Q4' }
    ];
  }
}
