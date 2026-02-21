import { Injectable } from '@angular/core';
import cronstrue from 'cronstrue';
import 'cronstrue/locales/de';
import 'cronstrue/locales/en';

/**
 * Service for converting cron expressions to human-readable text.
 * Supports multiple locales (EN, DE).
 */
@Injectable({
  providedIn: 'root'
})
export class CronHumanizerService {

  /**
   * Convert a cron expression to human-readable text
   * @param expression The cron expression (5 or 6 fields)
   * @param locale The locale for output ('en' | 'de')
   * @returns Human-readable description or error message
   */
  toHumanReadable(expression: string, locale = 'en'): string {
    if (!expression || expression.trim() === '') {
      return 'No schedule configured';
    }

    try {
      return cronstrue.toString(expression, {
        locale: this.normalizeLocale(locale),
        use24HourTimeFormat: true,
        verbose: false
      });
    } catch {
      // Return a friendly error message
      return 'Invalid cron expression';
    }
  }

  /**
   * Get a detailed description with additional context
   */
  toDetailedDescription(expression: string, locale = 'en'): {
    summary: string;
    frequency: string;
    timing: string;
  } {
    const summary = this.toHumanReadable(expression, locale);

    if (summary === 'Invalid cron expression' || summary === 'No schedule configured') {
      return {
        summary,
        frequency: '-',
        timing: '-'
      };
    }

    // Try to extract frequency and timing from the expression
    const parts = expression.trim().split(/\s+/);
    let frequency = 'Custom';
    let timing = '-';

    if (parts.length >= 5) {
      const [second, minute, hour, dayOfMonth, , dayOfWeek] = parts;

      // Determine frequency
      if (second.includes('/')) {
        frequency = 'Every few seconds';
      } else if (minute.includes('/')) {
        frequency = 'Every few minutes';
      } else if (hour.includes('/')) {
        frequency = 'Hourly';
      } else if (dayOfMonth !== '*' && dayOfWeek === '*') {
        frequency = 'Monthly';
      } else if (dayOfWeek !== '*') {
        if (dayOfWeek === '1-5') {
          frequency = 'Weekdays';
        } else if (dayOfWeek === '0,6' || dayOfWeek === '6,0') {
          frequency = 'Weekends';
        } else {
          frequency = 'Weekly';
        }
      } else {
        frequency = 'Daily';
      }

      // Determine timing
      const hourNum = parseInt(hour, 10);
      const minuteNum = parseInt(minute, 10);
      if (!isNaN(hourNum) && !isNaN(minuteNum)) {
        timing = `${hourNum.toString().padStart(2, '0')}:${minuteNum.toString().padStart(2, '0')}`;
      } else if (hour.includes('/')) {
        timing = 'Recurring';
      }
    }

    return { summary, frequency, timing };
  }

  /**
   * Check if a locale is supported
   */
  isLocaleSupported(locale: string): boolean {
    const supported = ['en', 'de'];
    return supported.includes(this.normalizeLocale(locale));
  }

  /**
   * Get list of supported locales
   */
  getSupportedLocales(): { code: string; name: string }[] {
    return [
      { code: 'en', name: 'English' },
      { code: 'de', name: 'German' }
    ];
  }

  private normalizeLocale(locale: string): string {
    const normalized = locale.toLowerCase().split('-')[0];
    // Default to English if locale not supported
    return ['en', 'de'].includes(normalized) ? normalized : 'en';
  }
}
