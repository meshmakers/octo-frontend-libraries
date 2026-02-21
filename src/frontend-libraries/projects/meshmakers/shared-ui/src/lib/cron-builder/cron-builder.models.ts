/**
 * Cron Expression Builder - Type definitions and models
 * Supports 6-field cron format: second minute hour day month weekday
 */

export type ScheduleType = 'seconds' | 'minutes' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, 6 = Saturday

export interface CronBuilderConfig {
  /** Show preset quick-select buttons */
  showPresets?: boolean;
  /** Show human-readable description of the cron expression */
  showHumanReadable?: boolean;
  /** Show next execution times */
  showNextExecutions?: boolean;
  /** Number of next executions to show (default: 3) */
  maxNextExecutions?: number;
  /** Show copy to clipboard button */
  showCopyButton?: boolean;
  /** Allow custom/advanced tab for direct cron editing */
  allowCustom?: boolean;
  /** Default schedule type to show */
  defaultScheduleType?: ScheduleType;
  /** Locale for human-readable output ('en' | 'de') */
  locale?: string;
}

export const DEFAULT_CRON_BUILDER_CONFIG: CronBuilderConfig = {
  showPresets: true,
  showHumanReadable: true,
  showNextExecutions: true,
  maxNextExecutions: 3,
  showCopyButton: true,
  allowCustom: true,
  defaultScheduleType: 'daily',
  locale: 'en'
};

export interface CronSchedule {
  type: ScheduleType;
  /** For seconds tab: interval in seconds */
  secondInterval?: number;
  /** For minutes tab: interval in minutes */
  minuteInterval?: number;
  /** For hourly tab */
  hourInterval?: number;
  hourMinute?: number;
  hourSecond?: number;
  /** For daily/weekly tab */
  time?: { hour: number; minute: number; second: number };
  /** For daily tab: 'every' | 'weekdays' | 'weekends' | 'specific' */
  dailyMode?: 'every' | 'weekdays' | 'weekends' | 'specific';
  /** For weekly/daily specific: selected days (0-6, 0=Sunday) */
  selectedDays?: Weekday[];
  /** For monthly tab */
  monthlyMode?: 'specific' | 'relative';
  dayOfMonth?: number;
  relativeWeek?: 'first' | 'second' | 'third' | 'fourth' | 'last';
  relativeDay?: Weekday;
  /** For custom tab: raw cron fields */
  customFields?: CronFields;
}

export interface CronFields {
  second: string;
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
}

export interface CronValidationResult {
  isValid: boolean;
  error?: string;
  errorField?: keyof CronFields;
}

export interface CronPreset {
  id: string;
  label: string;
  description: string;
  expression: string;
  category?: 'frequent' | 'hourly' | 'daily' | 'weekly' | 'monthly';
}

export const CRON_PRESETS: CronPreset[] = [
  // Frequent
  { id: 'every-minute', label: 'Every minute', description: 'Runs every minute', expression: '0 * * * * *', category: 'frequent' },
  { id: 'every-5-minutes', label: 'Every 5 minutes', description: 'Runs every 5 minutes', expression: '0 */5 * * * *', category: 'frequent' },
  { id: 'every-15-minutes', label: 'Every 15 minutes', description: 'Runs every 15 minutes', expression: '0 */15 * * * *', category: 'frequent' },
  { id: 'every-30-minutes', label: 'Every 30 minutes', description: 'Runs every 30 minutes', expression: '0 */30 * * * *', category: 'frequent' },
  // Hourly
  { id: 'every-hour', label: 'Every hour', description: 'Runs at the start of every hour', expression: '0 0 * * * *', category: 'hourly' },
  { id: 'every-2-hours', label: 'Every 2 hours', description: 'Runs every 2 hours', expression: '0 0 */2 * * *', category: 'hourly' },
  { id: 'every-6-hours', label: 'Every 6 hours', description: 'Runs every 6 hours', expression: '0 0 */6 * * *', category: 'hourly' },
  // Daily
  { id: 'daily-midnight', label: 'Daily at midnight', description: 'Runs every day at 00:00', expression: '0 0 0 * * *', category: 'daily' },
  { id: 'daily-9am', label: 'Daily at 9 AM', description: 'Runs every day at 09:00', expression: '0 0 9 * * *', category: 'daily' },
  { id: 'daily-6pm', label: 'Daily at 6 PM', description: 'Runs every day at 18:00', expression: '0 0 18 * * *', category: 'daily' },
  // Weekly
  { id: 'weekdays-9am', label: 'Weekdays at 9 AM', description: 'Runs Monday-Friday at 09:00', expression: '0 0 9 * * 1-5', category: 'weekly' },
  { id: 'weekly-monday', label: 'Weekly on Monday', description: 'Runs every Monday at 09:00', expression: '0 0 9 * * 1', category: 'weekly' },
  { id: 'weekly-friday', label: 'Weekly on Friday', description: 'Runs every Friday at 18:00', expression: '0 0 18 * * 5', category: 'weekly' },
  // Monthly
  { id: 'monthly-1st', label: 'Monthly on 1st', description: 'Runs on the 1st of every month at 00:00', expression: '0 0 0 1 * *', category: 'monthly' },
  { id: 'monthly-15th', label: 'Monthly on 15th', description: 'Runs on the 15th of every month at 00:00', expression: '0 0 0 15 * *', category: 'monthly' },
  { id: 'monthly-last-day', label: 'Last day of month', description: 'Runs on the last day of every month', expression: '0 0 0 L * *', category: 'monthly' }
];

export interface DropdownOption<T = string | number> {
  value: T;
  label: string;
}

export const SECOND_INTERVALS: DropdownOption<number>[] = [
  { value: 1, label: 'Every second' },
  { value: 2, label: 'Every 2 seconds' },
  { value: 5, label: 'Every 5 seconds' },
  { value: 10, label: 'Every 10 seconds' },
  { value: 15, label: 'Every 15 seconds' },
  { value: 20, label: 'Every 20 seconds' },
  { value: 30, label: 'Every 30 seconds' }
];

export const MINUTE_INTERVALS: DropdownOption<number>[] = [
  { value: 1, label: 'Every minute' },
  { value: 2, label: 'Every 2 minutes' },
  { value: 5, label: 'Every 5 minutes' },
  { value: 10, label: 'Every 10 minutes' },
  { value: 15, label: 'Every 15 minutes' },
  { value: 20, label: 'Every 20 minutes' },
  { value: 30, label: 'Every 30 minutes' }
];

export const HOUR_INTERVALS: DropdownOption<number>[] = [
  { value: 1, label: 'Every hour' },
  { value: 2, label: 'Every 2 hours' },
  { value: 3, label: 'Every 3 hours' },
  { value: 4, label: 'Every 4 hours' },
  { value: 6, label: 'Every 6 hours' },
  { value: 8, label: 'Every 8 hours' },
  { value: 12, label: 'Every 12 hours' }
];

export const WEEKDAYS: DropdownOption<Weekday>[] = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' }
];

export const WEEKDAY_ABBREVIATIONS: DropdownOption<Weekday>[] = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' }
];

export const RELATIVE_WEEKS: DropdownOption<string>[] = [
  { value: 'first', label: 'First' },
  { value: 'second', label: 'Second' },
  { value: 'third', label: 'Third' },
  { value: 'fourth', label: 'Fourth' },
  { value: 'last', label: 'Last' }
];

/** Generate options for hours (0-23) */
export function generateHourOptions(): DropdownOption<number>[] {
  return Array.from({ length: 24 }, (_, i) => ({
    value: i,
    label: i.toString().padStart(2, '0')
  }));
}

/** Generate options for minutes/seconds (0-59) */
export function generateMinuteOptions(): DropdownOption<number>[] {
  return Array.from({ length: 60 }, (_, i) => ({
    value: i,
    label: i.toString().padStart(2, '0')
  }));
}

/** Generate options for day of month (1-31) */
export function generateDayOfMonthOptions(): DropdownOption<number>[] {
  return Array.from({ length: 31 }, (_, i) => ({
    value: i + 1,
    label: (i + 1).toString()
  }));
}
