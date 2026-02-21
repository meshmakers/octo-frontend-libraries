import {
  Component,
  Input,
  OnInit,
  forwardRef,
  signal,
  computed,
  inject,
  effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';

// Kendo UI imports
import { TabStripModule } from '@progress/kendo-angular-layout';
import { DropDownListModule } from '@progress/kendo-angular-dropdowns';
import { ButtonModule, ButtonGroupModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { LabelModule } from '@progress/kendo-angular-label';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import { copyIcon, clockIcon, checkIcon, xIcon } from '@progress/kendo-svg-icons';

// Local imports
import {
  CronBuilderConfig,
  CronSchedule,
  ScheduleType,
  Weekday,
  DEFAULT_CRON_BUILDER_CONFIG,
  CRON_PRESETS,
  CronPreset,
  SECOND_INTERVALS,
  MINUTE_INTERVALS,
  HOUR_INTERVALS,
  WEEKDAY_ABBREVIATIONS,
  WEEKDAYS,
  RELATIVE_WEEKS,
  DropdownOption,
  generateHourOptions,
  generateMinuteOptions,
  generateDayOfMonthOptions,
  CronFields
} from './cron-builder.models';
import { CronParserService } from './services/cron-parser.service';
import { CronHumanizerService } from './services/cron-humanizer.service';

@Component({
  selector: 'mm-cron-builder',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TabStripModule,
    DropDownListModule,
    ButtonModule,
    ButtonGroupModule,
    InputsModule,
    LabelModule,
    SVGIconModule
  ],
  templateUrl: './cron-builder.component.html',
  styleUrl: './cron-builder.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CronBuilderComponent),
      multi: true
    }
  ]
})
export class CronBuilderComponent implements OnInit, ControlValueAccessor {

  // --- Configuration ---
  @Input() config: CronBuilderConfig = {};

  // --- Services ---
  private readonly cronParser = inject(CronParserService);
  private readonly cronHumanizer = inject(CronHumanizerService);

  // --- Icons ---
  protected readonly copyIcon = copyIcon;
  protected readonly clockIcon = clockIcon;
  protected readonly checkIcon = checkIcon;
  protected readonly xIcon = xIcon;

  // --- ControlValueAccessor state (initialized as noop, set by registerOnChange/registerOnTouched) ---
  private onChange: (value: string) => void = () => { /* noop */ };
  private onTouched: () => void = () => { /* noop */ };
  protected disabled = signal(false);

  // --- Internal state ---
  protected readonly expression = signal<string>('0 * * * * *');
  protected readonly selectedTabIndex = signal<number>(3); // Default to Daily tab
  protected readonly copiedRecently = signal(false);
  private suppressOnChange = true; // Suppress onChange until user interacts

  // Schedule type state
  protected readonly scheduleType = signal<ScheduleType>('daily');

  // Seconds tab
  protected readonly secondInterval = signal<number>(5);

  // Minutes tab
  protected readonly minuteInterval = signal<number>(5);

  // Hourly tab
  protected readonly hourInterval = signal<number>(1);
  protected readonly hourMinute = signal<number>(0);
  protected readonly hourSecond = signal<number>(0);

  // Daily/Weekly tab
  protected readonly timeHour = signal<number>(9);
  protected readonly timeMinute = signal<number>(0);
  protected readonly timeSecond = signal<number>(0);
  protected readonly dailyMode = signal<'every' | 'weekdays' | 'weekends' | 'specific'>('every');
  protected readonly selectedDays = signal<Weekday[]>([]);

  // Monthly tab
  protected readonly monthlyMode = signal<'specific' | 'relative'>('specific');
  protected readonly dayOfMonth = signal<number>(1);
  protected readonly relativeWeek = signal<string>('first');
  protected readonly relativeDay = signal<Weekday>(1);

  // Custom tab
  protected readonly customSecond = signal<string>('0');
  protected readonly customMinute = signal<string>('*');
  protected readonly customHour = signal<string>('*');
  protected readonly customDayOfMonth = signal<string>('*');
  protected readonly customMonth = signal<string>('*');
  protected readonly customDayOfWeek = signal<string>('*');

  // --- Computed values ---
  protected readonly mergedConfig = computed(() => ({
    ...DEFAULT_CRON_BUILDER_CONFIG,
    ...this.config
  }));

  protected readonly humanReadable = computed(() => {
    const expr = this.expression();
    const locale = this.mergedConfig().locale || 'en';
    return this.cronHumanizer.toHumanReadable(expr, locale);
  });

  protected readonly validationResult = computed(() => {
    return this.cronParser.validate(this.expression());
  });

  protected readonly nextExecutions = computed(() => {
    const expr = this.expression();
    const maxCount = this.mergedConfig().maxNextExecutions || 3;
    return this.cronParser.getNextExecutions(expr, maxCount);
  });

  protected readonly presets = computed(() => {
    return CRON_PRESETS;
  });

  protected readonly presetsByCategory = computed(() => {
    const presets = this.presets();
    return {
      frequent: presets.filter(p => p.category === 'frequent'),
      hourly: presets.filter(p => p.category === 'hourly'),
      daily: presets.filter(p => p.category === 'daily'),
      weekly: presets.filter(p => p.category === 'weekly'),
      monthly: presets.filter(p => p.category === 'monthly')
    };
  });

  // --- Dropdown options ---
  protected readonly secondIntervalOptions = SECOND_INTERVALS;
  protected readonly minuteIntervalOptions = MINUTE_INTERVALS;
  protected readonly hourIntervalOptions = HOUR_INTERVALS;
  protected readonly weekdayOptions = WEEKDAYS;
  protected readonly weekdayAbbreviations = WEEKDAY_ABBREVIATIONS;
  protected readonly relativeWeekOptions = RELATIVE_WEEKS;
  protected readonly hourOptions = generateHourOptions();
  protected readonly minuteOptions = generateMinuteOptions();
  protected readonly dayOfMonthOptions = generateDayOfMonthOptions();

  // --- Tab mapping ---
  protected readonly tabIndexToType: ScheduleType[] = [
    'seconds', 'minutes', 'hourly', 'daily', 'weekly', 'monthly', 'custom'
  ];

  constructor() {
    // Effect to generate expression when schedule values change
    effect(() => {
      const type = this.scheduleType();
      const schedule = this.buildScheduleFromState(type);
      const newExpression = this.cronParser.generate(schedule);
      const currentExpression = this.expression();

      // Only update if the expression actually changed
      if (newExpression !== currentExpression) {
        this.expression.set(newExpression);
      }

      // Only call onChange if not suppressed (user has interacted)
      if (!this.suppressOnChange && newExpression !== currentExpression) {
        this.onChange(newExpression);
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    const defaultType = this.mergedConfig().defaultScheduleType || 'daily';
    this.scheduleType.set(defaultType);
    this.selectedTabIndex.set(this.tabIndexToType.indexOf(defaultType));
  }

  // --- ControlValueAccessor implementation ---

  writeValue(value: string): void {
    if (value) {
      this.expression.set(value);
      this.parseExpressionToState(value);
    }
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  // --- Event handlers ---

  protected onTabSelect(index: number): void {
    this.suppressOnChange = false;
    this.selectedTabIndex.set(index);
    const type = this.tabIndexToType[index];
    if (type) {
      this.scheduleType.set(type);
    }
    this.onTouched();
  }

  protected onPresetSelect(preset: CronPreset): void {
    this.suppressOnChange = false;
    this.expression.set(preset.expression);
    this.parseExpressionToState(preset.expression);
    this.onChange(preset.expression);
    this.onTouched();
  }

  protected async onCopyExpression(): Promise<void> {
    const expr = this.expression();
    try {
      await navigator.clipboard.writeText(expr);
      this.copiedRecently.set(true);
      setTimeout(() => this.copiedRecently.set(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  }

  // --- Seconds tab handlers ---
  protected onSecondIntervalChange(value: number): void {
    this.suppressOnChange = false;
    this.secondInterval.set(value);
    this.onTouched();
  }

  // --- Minutes tab handlers ---
  protected onMinuteIntervalChange(value: number): void {
    this.suppressOnChange = false;
    this.minuteInterval.set(value);
    this.onTouched();
  }

  // --- Hourly tab handlers ---
  protected onHourIntervalChange(value: number): void {
    this.suppressOnChange = false;
    this.hourInterval.set(value);
    this.onTouched();
  }

  protected onHourMinuteChange(value: number): void {
    this.suppressOnChange = false;
    this.hourMinute.set(value);
    this.onTouched();
  }

  protected onHourSecondChange(value: number): void {
    this.suppressOnChange = false;
    this.hourSecond.set(value);
    this.onTouched();
  }

  // --- Daily tab handlers ---
  protected onTimeHourChange(value: number): void {
    this.suppressOnChange = false;
    this.timeHour.set(value);
    this.onTouched();
  }

  protected onTimeMinuteChange(value: number): void {
    this.suppressOnChange = false;
    this.timeMinute.set(value);
    this.onTouched();
  }

  protected onTimeSecondChange(value: number): void {
    this.suppressOnChange = false;
    this.timeSecond.set(value);
    this.onTouched();
  }

  protected onDailyModeChange(mode: 'every' | 'weekdays' | 'weekends' | 'specific'): void {
    this.suppressOnChange = false;
    this.dailyMode.set(mode);
    if (mode !== 'specific') {
      this.selectedDays.set([]);
    }
    this.onTouched();
  }

  protected onDayToggle(day: Weekday): void {
    this.suppressOnChange = false;
    const current = this.selectedDays();
    if (current.includes(day)) {
      this.selectedDays.set(current.filter(d => d !== day));
    } else {
      this.selectedDays.set([...current, day]);
    }
    this.onTouched();
  }

  protected isDaySelected(day: Weekday): boolean {
    return this.selectedDays().includes(day);
  }

  // --- Monthly tab handlers ---
  protected onMonthlyModeChange(mode: 'specific' | 'relative'): void {
    this.suppressOnChange = false;
    this.monthlyMode.set(mode);
    this.onTouched();
  }

  protected onDayOfMonthChange(value: number): void {
    this.suppressOnChange = false;
    this.dayOfMonth.set(value);
    this.onTouched();
  }

  protected onRelativeWeekChange(value: string): void {
    this.suppressOnChange = false;
    this.relativeWeek.set(value);
    this.onTouched();
  }

  protected onRelativeDayChange(value: Weekday): void {
    this.suppressOnChange = false;
    this.relativeDay.set(value);
    this.onTouched();
  }

  // --- Custom tab handlers ---
  protected onCustomFieldChange(field: keyof CronFields, value: string): void {
    this.suppressOnChange = false;
    switch (field) {
      case 'second': this.customSecond.set(value); break;
      case 'minute': this.customMinute.set(value); break;
      case 'hour': this.customHour.set(value); break;
      case 'dayOfMonth': this.customDayOfMonth.set(value); break;
      case 'month': this.customMonth.set(value); break;
      case 'dayOfWeek': this.customDayOfWeek.set(value); break;
    }
    this.onTouched();
  }

  // --- Helper methods ---

  protected formatNextExecution(date: Date): string {
    return date.toLocaleString(this.mergedConfig().locale || 'en', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }

  private buildScheduleFromState(type: ScheduleType): CronSchedule {
    const schedule: CronSchedule = { type };

    switch (type) {
      case 'seconds':
        schedule.secondInterval = this.secondInterval();
        break;

      case 'minutes':
        schedule.minuteInterval = this.minuteInterval();
        break;

      case 'hourly':
        schedule.hourInterval = this.hourInterval();
        schedule.hourMinute = this.hourMinute();
        schedule.hourSecond = this.hourSecond();
        break;

      case 'daily':
        schedule.time = {
          hour: this.timeHour(),
          minute: this.timeMinute(),
          second: this.timeSecond()
        };
        schedule.dailyMode = this.dailyMode();
        schedule.selectedDays = this.selectedDays();
        break;

      case 'weekly':
        schedule.time = {
          hour: this.timeHour(),
          minute: this.timeMinute(),
          second: this.timeSecond()
        };
        schedule.selectedDays = this.selectedDays().length > 0 ? this.selectedDays() : [1];
        break;

      case 'monthly':
        schedule.time = {
          hour: this.timeHour(),
          minute: this.timeMinute(),
          second: this.timeSecond()
        };
        schedule.monthlyMode = this.monthlyMode();
        schedule.dayOfMonth = this.dayOfMonth();
        schedule.relativeWeek = this.relativeWeek() as 'first' | 'second' | 'third' | 'fourth' | 'last';
        schedule.relativeDay = this.relativeDay();
        break;

      case 'custom':
        schedule.customFields = {
          second: this.customSecond(),
          minute: this.customMinute(),
          hour: this.customHour(),
          dayOfMonth: this.customDayOfMonth(),
          month: this.customMonth(),
          dayOfWeek: this.customDayOfWeek()
        };
        break;
    }

    return schedule;
  }

  private parseExpressionToState(expression: string): void {
    const schedule = this.cronParser.parse(expression);
    if (!schedule) return;

    this.scheduleType.set(schedule.type);
    this.selectedTabIndex.set(this.tabIndexToType.indexOf(schedule.type));

    // Parse custom fields first (always available)
    if (schedule.customFields) {
      this.customSecond.set(schedule.customFields.second);
      this.customMinute.set(schedule.customFields.minute);
      this.customHour.set(schedule.customFields.hour);
      this.customDayOfMonth.set(schedule.customFields.dayOfMonth);
      this.customMonth.set(schedule.customFields.month);
      this.customDayOfWeek.set(schedule.customFields.dayOfWeek);
    }

    // Parse type-specific fields
    switch (schedule.type) {
      case 'seconds':
        if (schedule.secondInterval) this.secondInterval.set(schedule.secondInterval);
        break;

      case 'minutes':
        if (schedule.minuteInterval) this.minuteInterval.set(schedule.minuteInterval);
        break;

      case 'hourly':
        if (schedule.hourInterval) this.hourInterval.set(schedule.hourInterval);
        if (schedule.hourMinute !== undefined) this.hourMinute.set(schedule.hourMinute);
        if (schedule.hourSecond !== undefined) this.hourSecond.set(schedule.hourSecond);
        break;

      case 'daily':
      case 'weekly':
        if (schedule.time) {
          this.timeHour.set(schedule.time.hour);
          this.timeMinute.set(schedule.time.minute);
          this.timeSecond.set(schedule.time.second);
        }
        if (schedule.dailyMode) this.dailyMode.set(schedule.dailyMode);
        if (schedule.selectedDays) this.selectedDays.set(schedule.selectedDays);
        break;

      case 'monthly':
        if (schedule.time) {
          this.timeHour.set(schedule.time.hour);
          this.timeMinute.set(schedule.time.minute);
          this.timeSecond.set(schedule.time.second);
        }
        if (schedule.monthlyMode) this.monthlyMode.set(schedule.monthlyMode);
        if (schedule.dayOfMonth) this.dayOfMonth.set(schedule.dayOfMonth);
        if (schedule.relativeWeek) this.relativeWeek.set(schedule.relativeWeek);
        if (schedule.relativeDay !== undefined) this.relativeDay.set(schedule.relativeDay);
        break;
    }
  }

  // Track by functions for ngFor
  protected trackByValue(_index: number, item: DropdownOption): number | string {
    return item.value;
  }

  protected trackByPresetId(_index: number, item: CronPreset): string {
    return item.id;
  }
}
