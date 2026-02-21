import { Injectable } from '@angular/core';
import { CronExpressionParser } from 'cron-parser';
import {
  CronFields,
  CronSchedule,
  CronValidationResult,
  ScheduleType,
  Weekday
} from '../cron-builder.models';

/**
 * Service for parsing, validating, and generating cron expressions.
 * Supports 6-field format: second minute hour dayOfMonth month dayOfWeek
 */
@Injectable({
  providedIn: 'root'
})
export class CronParserService {

  /**
   * Validate a 6-field cron expression
   */
  validate(expression: string): CronValidationResult {
    if (!expression || expression.trim() === '') {
      return { isValid: false, error: 'Cron expression is required' };
    }

    const parts = expression.trim().split(/\s+/);

    // Must have exactly 6 fields for our format
    if (parts.length !== 6) {
      return {
        isValid: false,
        error: `Expected 6 fields (second minute hour day month weekday), got ${parts.length}`
      };
    }

    // Try to parse with cron-parser (it expects 5 or 6 fields)
    try {
      CronExpressionParser.parse(expression, { currentDate: new Date() });
      return { isValid: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Invalid cron expression';
      return { isValid: false, error: errorMessage };
    }
  }

  /**
   * Parse a cron expression into a structured CronSchedule object
   */
  parse(expression: string): CronSchedule | null {
    const validation = this.validate(expression);
    if (!validation.isValid) {
      return null;
    }

    const parts = expression.trim().split(/\s+/);
    const fields: CronFields = {
      second: parts[0],
      minute: parts[1],
      hour: parts[2],
      dayOfMonth: parts[3],
      month: parts[4],
      dayOfWeek: parts[5]
    };

    // Try to detect the schedule type
    const type = this.detectScheduleType(fields);

    const schedule: CronSchedule = {
      type,
      customFields: fields
    };

    // Parse specific fields based on detected type
    switch (type) {
      case 'seconds':
        schedule.secondInterval = this.parseInterval(fields.second) || 1;
        break;

      case 'minutes':
        schedule.minuteInterval = this.parseInterval(fields.minute) || 1;
        break;

      case 'hourly':
        schedule.hourInterval = this.parseInterval(fields.hour) || 1;
        schedule.hourMinute = this.parseSimpleValue(fields.minute) ?? 0;
        schedule.hourSecond = this.parseSimpleValue(fields.second) ?? 0;
        break;

      case 'daily':
      case 'weekly':
        schedule.time = {
          hour: this.parseSimpleValue(fields.hour) ?? 0,
          minute: this.parseSimpleValue(fields.minute) ?? 0,
          second: this.parseSimpleValue(fields.second) ?? 0
        };
        schedule.selectedDays = this.parseDaysOfWeek(fields.dayOfWeek);
        schedule.dailyMode = this.detectDailyMode(fields.dayOfWeek);
        break;

      case 'monthly':
        schedule.time = {
          hour: this.parseSimpleValue(fields.hour) ?? 0,
          minute: this.parseSimpleValue(fields.minute) ?? 0,
          second: this.parseSimpleValue(fields.second) ?? 0
        };
        schedule.monthlyMode = 'specific';
        schedule.dayOfMonth = this.parseSimpleValue(fields.dayOfMonth) ?? 1;
        break;
    }

    return schedule;
  }

  /**
   * Generate a cron expression from a CronSchedule object
   */
  generate(schedule: CronSchedule): string {
    switch (schedule.type) {
      case 'seconds':
        return this.generateSecondsExpression(schedule);
      case 'minutes':
        return this.generateMinutesExpression(schedule);
      case 'hourly':
        return this.generateHourlyExpression(schedule);
      case 'daily':
        return this.generateDailyExpression(schedule);
      case 'weekly':
        return this.generateWeeklyExpression(schedule);
      case 'monthly':
        return this.generateMonthlyExpression(schedule);
      case 'custom':
        return this.generateCustomExpression(schedule);
      default:
        return '0 * * * * *';
    }
  }

  /**
   * Calculate next execution times for a cron expression
   */
  getNextExecutions(expression: string, count = 3): Date[] {
    const validation = this.validate(expression);
    if (!validation.isValid) {
      return [];
    }

    try {
      const interval = CronExpressionParser.parse(expression, { currentDate: new Date() });
      const executions: Date[] = [];

      for (let i = 0; i < count; i++) {
        const next = interval.next();
        executions.push(next.toDate());
      }

      return executions;
    } catch {
      return [];
    }
  }

  // --- Private helper methods ---

  private detectScheduleType(fields: CronFields): ScheduleType {
    const { second, minute, hour, dayOfMonth, dayOfWeek } = fields;

    // Check for seconds interval (*/N in seconds, * in all others)
    if (second.includes('/') && minute === '*' && hour === '*' && dayOfMonth === '*' && dayOfWeek === '*') {
      return 'seconds';
    }

    // Check for minutes interval (0 in seconds, */N in minutes, * in others)
    if ((second === '0' || second === '*') && minute.includes('/') && hour === '*' && dayOfMonth === '*' && dayOfWeek === '*') {
      return 'minutes';
    }

    // Check for hourly (specific or */N in hours)
    if (hour.includes('/') || (this.isSimpleValue(hour) && dayOfMonth === '*' && dayOfWeek === '*' && minute !== '*')) {
      if (hour.includes('/')) {
        return 'hourly';
      }
    }

    // Check for monthly (specific day of month, * in dayOfWeek)
    if (this.isSimpleValue(dayOfMonth) && dayOfMonth !== '*' && dayOfWeek === '*') {
      return 'monthly';
    }

    // Check for weekly/daily (specific days of week or ranges)
    if (dayOfMonth === '*' && (dayOfWeek !== '*' || this.isSimpleValue(hour))) {
      // If specific days of week, it's weekly
      if (dayOfWeek !== '*' && !['0-6', '1-5', '0,6', '6,0'].includes(dayOfWeek)) {
        return 'weekly';
      }
      return 'daily';
    }

    return 'custom';
  }

  private detectDailyMode(dayOfWeek: string): 'every' | 'weekdays' | 'weekends' | 'specific' {
    if (dayOfWeek === '*' || dayOfWeek === '0-6') {
      return 'every';
    }
    if (dayOfWeek === '1-5') {
      return 'weekdays';
    }
    if (dayOfWeek === '0,6' || dayOfWeek === '6,0') {
      return 'weekends';
    }
    return 'specific';
  }

  private parseInterval(field: string): number | null {
    const match = field.match(/^\*\/(\d+)$/);
    return match ? parseInt(match[1], 10) : null;
  }

  private parseSimpleValue(field: string): number | null {
    if (field === '*') return null;
    const num = parseInt(field, 10);
    return isNaN(num) ? null : num;
  }

  private isSimpleValue(field: string): boolean {
    return /^\d+$/.test(field);
  }

  private parseDaysOfWeek(field: string): Weekday[] {
    if (field === '*') {
      return [0, 1, 2, 3, 4, 5, 6];
    }

    const days: Weekday[] = [];

    // Handle ranges like 1-5
    const rangeMatch = field.match(/^(\d)-(\d)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      for (let i = start; i <= end; i++) {
        days.push(i as Weekday);
      }
      return days;
    }

    // Handle comma-separated values
    const parts = field.split(',');
    for (const part of parts) {
      const num = parseInt(part.trim(), 10);
      if (!isNaN(num) && num >= 0 && num <= 6) {
        days.push(num as Weekday);
      }
    }

    return days;
  }

  private generateSecondsExpression(schedule: CronSchedule): string {
    const interval = schedule.secondInterval || 1;
    return `*/${interval} * * * * *`;
  }

  private generateMinutesExpression(schedule: CronSchedule): string {
    const interval = schedule.minuteInterval || 1;
    return `0 */${interval} * * * *`;
  }

  private generateHourlyExpression(schedule: CronSchedule): string {
    const interval = schedule.hourInterval || 1;
    const minute = schedule.hourMinute ?? 0;
    const second = schedule.hourSecond ?? 0;
    return `${second} ${minute} */${interval} * * *`;
  }

  private generateDailyExpression(schedule: CronSchedule): string {
    const time = schedule.time || { hour: 0, minute: 0, second: 0 };
    let dayOfWeek = '*';

    switch (schedule.dailyMode) {
      case 'weekdays':
        dayOfWeek = '1-5';
        break;
      case 'weekends':
        dayOfWeek = '0,6';
        break;
      case 'specific':
        if (schedule.selectedDays && schedule.selectedDays.length > 0) {
          dayOfWeek = schedule.selectedDays.sort((a, b) => a - b).join(',');
        }
        break;
      case 'every':
      default:
        dayOfWeek = '*';
        break;
    }

    return `${time.second} ${time.minute} ${time.hour} * * ${dayOfWeek}`;
  }

  private generateWeeklyExpression(schedule: CronSchedule): string {
    const time = schedule.time || { hour: 9, minute: 0, second: 0 };
    const days = schedule.selectedDays || [1]; // Default to Monday

    const dayOfWeek = days.length > 0
      ? days.sort((a, b) => a - b).join(',')
      : '1';

    return `${time.second} ${time.minute} ${time.hour} * * ${dayOfWeek}`;
  }

  private generateMonthlyExpression(schedule: CronSchedule): string {
    const time = schedule.time || { hour: 0, minute: 0, second: 0 };

    if (schedule.monthlyMode === 'relative' && schedule.relativeWeek && schedule.relativeDay !== undefined) {
      // For relative scheduling, we need to use special syntax
      // cron-parser doesn't fully support this, so we approximate
      const weekNum = this.getWeekNumber(schedule.relativeWeek);
      const day = schedule.relativeDay;

      if (schedule.relativeWeek === 'last') {
        // Last weekday of month - approximate with last week
        return `${time.second} ${time.minute} ${time.hour} * * ${day}`;
      }

      // First X-day, Second X-day, etc. - approximate
      const startDay = (weekNum - 1) * 7 + 1;
      const endDay = weekNum * 7;
      return `${time.second} ${time.minute} ${time.hour} ${startDay}-${endDay} * ${day}`;
    }

    // Specific day of month
    const dayOfMonth = schedule.dayOfMonth || 1;
    return `${time.second} ${time.minute} ${time.hour} ${dayOfMonth} * *`;
  }

  private generateCustomExpression(schedule: CronSchedule): string {
    const fields = schedule.customFields;
    if (!fields) {
      return '0 * * * * *';
    }
    return `${fields.second} ${fields.minute} ${fields.hour} ${fields.dayOfMonth} ${fields.month} ${fields.dayOfWeek}`;
  }

  private getWeekNumber(week: 'first' | 'second' | 'third' | 'fourth' | 'last'): number {
    switch (week) {
      case 'first': return 1;
      case 'second': return 2;
      case 'third': return 3;
      case 'fourth': return 4;
      case 'last': return 5;
      default: return 1;
    }
  }
}
