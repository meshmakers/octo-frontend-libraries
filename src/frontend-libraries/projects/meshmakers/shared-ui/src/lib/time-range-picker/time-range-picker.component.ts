import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  SimpleChanges,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DropDownListModule } from '@progress/kendo-angular-dropdowns';
import { DatePickerModule, DateTimePickerModule } from '@progress/kendo-angular-dateinputs';
import { NumericTextBoxModule } from '@progress/kendo-angular-inputs';
import { LabelModule } from '@progress/kendo-angular-label';

import {
  TimeRange,
  TimeRangeISO,
  TimeRangeType,
  TimeRangeSelection,
  TimeRangePickerConfig,
  TimeRangePickerLabels,
  TimeRangeOption,
  TimeRangeUtils,
  RelativeTimeUnit,
  Quarter,
  DEFAULT_TIME_RANGE_LABELS
} from './time-range-picker.models';

/**
 * A flexible time range picker component that supports:
 * - Year selection
 * - Quarter selection (year + quarter)
 * - Month selection (year + month)
 * - Relative time (last N hours/days/weeks/months)
 * - Custom date range
 *
 * @example
 * ```html
 * <mm-time-range-picker
 *   [config]="{ availableTypes: ['year', 'month', 'relative'] }"
 *   (rangeChange)="onRangeChange($event)">
 * </mm-time-range-picker>
 * ```
 */
@Component({
  selector: 'mm-time-range-picker',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DropDownListModule,
    DatePickerModule,
    DateTimePickerModule,
    NumericTextBoxModule,
    LabelModule
  ],
  templateUrl: './time-range-picker.component.html',
  styleUrl: './time-range-picker.component.scss'
})
export class TimeRangePickerComponent implements OnInit, OnChanges {
  /**
   * Configuration for the picker
   */
  @Input() config: TimeRangePickerConfig = {};

  /**
   * Custom labels for the UI
   */
  @Input() labels: TimeRangePickerLabels = {};

  /**
   * Initial selection to set
   */
  @Input() initialSelection?: TimeRangeSelection;

  /**
   * Emits when the time range changes
   */
  @Output() rangeChange = new EventEmitter<TimeRange>();

  /**
   * Emits when the time range changes (ISO format)
   */
  @Output() rangeChangeISO = new EventEmitter<TimeRangeISO>();

  /**
   * Emits the current selection state
   */
  @Output() selectionChange = new EventEmitter<TimeRangeSelection>();

  // Current selection state
  protected selectedType = signal<TimeRangeType>('year');
  protected selectedYear = signal<number>(new Date().getFullYear());
  protected selectedQuarter = signal<Quarter>(TimeRangeUtils.getCurrentQuarter());
  protected selectedMonth = signal<number>(new Date().getMonth());
  protected selectedDay = signal<number>(new Date().getDate());
  protected relativeValue = signal<number>(24);
  protected relativeUnit = signal<RelativeTimeUnit>('hours');
  protected hourFrom = signal<number | null>(null);
  protected hourTo = signal<number | null>(null);
  protected customFrom = signal<Date>(new Date());
  protected customTo = signal<Date>(new Date());

  // Merged labels with defaults
  protected mergedLabels = computed(() => ({
    ...DEFAULT_TIME_RANGE_LABELS,
    ...this.labels
  }));

  // Options for dropdowns
  protected typeOptions = computed<TimeRangeOption<TimeRangeType>[]>(() => {
    const allTypes: TimeRangeOption<TimeRangeType>[] = [
      { value: 'year', label: this.mergedLabels().typeYear || 'Year' },
      { value: 'quarter', label: this.mergedLabels().typeQuarter || 'Quarter' },
      { value: 'month', label: this.mergedLabels().typeMonth || 'Month' },
      { value: 'day', label: this.mergedLabels().typeDay || 'Day' },
      { value: 'relative', label: this.mergedLabels().typeRelative || 'Relative' },
      { value: 'custom', label: this.mergedLabels().typeCustom || 'Custom' }
    ];

    const available = this.config.availableTypes;
    if (available && available.length > 0) {
      return allTypes.filter(opt => available.includes(opt.value));
    }
    return allTypes;
  });

  protected yearOptions = computed(() => {
    const currentYear = new Date().getFullYear();
    const minYear = this.config.minYear ?? currentYear - 10;
    const maxYear = this.config.maxYear ?? currentYear + 1;
    return TimeRangeUtils.generateYearOptions(minYear, maxYear);
  });

  protected quarterOptions = computed(() =>
    TimeRangeUtils.generateQuarterOptions(this.mergedLabels())
  );

  protected monthOptions = computed(() =>
    TimeRangeUtils.generateMonthOptions()
  );

  protected dayOptions = computed(() => {
    const year = this.selectedYear();
    const month = this.selectedMonth();
    // Get number of days in the selected month
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const options: TimeRangeOption<number>[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      options.push({ value: d, label: d.toString() });
    }
    return options;
  });

  protected hourFromOptions = computed(() => {
    const options: TimeRangeOption<number>[] = [];
    for (let h = 0; h <= 23; h++) {
      options.push({ value: h, label: h.toString().padStart(2, '0') + ':00' });
    }
    return options;
  });

  protected hourToOptions = computed(() => {
    const fromHour = this.hourFrom();
    const minHour = fromHour !== null ? fromHour + 1 : 1;
    const options: TimeRangeOption<number>[] = [];
    for (let h = minHour; h <= 24; h++) {
      const label = h === 24 ? '24:00' : h.toString().padStart(2, '0') + ':00';
      options.push({ value: h, label });
    }
    return options;
  });

  protected relativeUnitOptions = computed<TimeRangeOption<RelativeTimeUnit>[]>(() => [
    { value: 'hours', label: this.mergedLabels().unitHours || 'Hours' },
    { value: 'days', label: this.mergedLabels().unitDays || 'Days' },
    { value: 'weeks', label: this.mergedLabels().unitWeeks || 'Weeks' },
    { value: 'months', label: this.mergedLabels().unitMonths || 'Months' }
  ]);

  // Computed time range
  protected currentRange = computed<TimeRange | null>(() => {
    const selection: TimeRangeSelection = {
      type: this.selectedType(),
      year: this.selectedYear(),
      quarter: this.selectedQuarter(),
      month: this.selectedMonth(),
      day: this.selectedDay(),
      hourFrom: this.hourFrom() ?? undefined,
      hourTo: this.hourTo() ?? undefined,
      relativeValue: this.relativeValue(),
      relativeUnit: this.relativeUnit(),
      customFrom: this.customFrom(),
      customTo: this.customTo()
    };
    return TimeRangeUtils.getTimeRangeFromSelection(selection, this.config.showTime ?? false);
  });

  // Min/Max dates for custom picker
  protected minDate = computed(() => this.config.minDate ?? new Date(1900, 0, 1));
  protected maxDate = computed(() => this.config.maxDate ?? new Date(2100, 11, 31));
  protected showTime = computed(() => this.config.showTime ?? false);

  ngOnInit(): void {
    this.initializeDefaults();
    if (this.initialSelection) {
      this.applySelection(this.initialSelection);
    }
    this.emitChange();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialSelection'] && !changes['initialSelection'].firstChange) {
      if (this.initialSelection) {
        this.applySelection(this.initialSelection);
        this.emitChange();
      }
    }
    if (changes['labels']) {
      // Labels are handled by computed signal
    }
  }

  private initializeDefaults(): void {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();

    this.selectedYear.set(currentYear);
    this.selectedMonth.set(currentMonth);
    this.selectedDay.set(new Date().getDate());
    this.selectedQuarter.set(TimeRangeUtils.getCurrentQuarter());
    this.relativeValue.set(this.config.defaultRelativeValue ?? 24);
    this.relativeUnit.set(this.config.defaultRelativeUnit ?? 'hours');

    // Set initial type to first available
    const types = this.typeOptions();
    if (types.length > 0 && !types.find(t => t.value === this.selectedType())) {
      this.selectedType.set(types[0].value);
    }

    // Initialize custom dates
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    this.customFrom.set(yesterday);
    this.customTo.set(now);
  }

  private applySelection(selection: TimeRangeSelection): void {
    this.selectedType.set(selection.type);

    if (selection.year !== undefined) {
      this.selectedYear.set(selection.year);
    }
    if (selection.quarter !== undefined) {
      this.selectedQuarter.set(selection.quarter);
    }
    if (selection.month !== undefined) {
      this.selectedMonth.set(selection.month);
    }
    if (selection.day !== undefined) {
      this.selectedDay.set(selection.day);
    }
    this.hourFrom.set(selection.hourFrom ?? null);
    this.hourTo.set(selection.hourTo ?? null);
    if (selection.relativeValue !== undefined) {
      this.relativeValue.set(selection.relativeValue);
    }
    if (selection.relativeUnit !== undefined) {
      this.relativeUnit.set(selection.relativeUnit);
    }
    if (selection.customFrom !== undefined) {
      this.customFrom.set(selection.customFrom);
    }
    if (selection.customTo !== undefined) {
      this.customTo.set(selection.customTo);
    }
  }

  // Event handlers
  protected onTypeChange(type: TimeRangeType): void {
    this.selectedType.set(type);
    if (type !== 'day') {
      this.hourFrom.set(null);
      this.hourTo.set(null);
    }
    this.emitChange();
  }

  protected onYearChange(year: number): void {
    this.selectedYear.set(year);
    this.emitChange();
  }

  protected onQuarterChange(quarter: Quarter): void {
    this.selectedQuarter.set(quarter);
    this.emitChange();
  }

  protected onMonthChange(month: number): void {
    this.selectedMonth.set(month);
    // Clamp day to valid range for the new month
    const daysInMonth = new Date(this.selectedYear(), month + 1, 0).getDate();
    if (this.selectedDay() > daysInMonth) {
      this.selectedDay.set(daysInMonth);
    }
    this.emitChange();
  }

  protected onDayChange(day: number): void {
    this.selectedDay.set(day);
    this.emitChange();
  }

  protected onHourFromChange(hour: number | null): void {
    this.hourFrom.set(hour);
    // If hourTo is less than or equal to hourFrom, adjust it
    if (hour !== null && this.hourTo() !== null && this.hourTo()! <= hour) {
      this.hourTo.set(hour + 1);
    }
    // If hourFrom is set but hourTo is not, default hourTo to hourFrom + 1
    if (hour !== null && this.hourTo() === null) {
      this.hourTo.set(hour + 1);
    }
    // If hourFrom is cleared, also clear hourTo
    if (hour === null) {
      this.hourTo.set(null);
    }
    this.emitChange();
  }

  protected onHourToChange(hour: number | null): void {
    this.hourTo.set(hour);
    this.emitChange();
  }

  protected clearHourFilter(): void {
    this.hourFrom.set(null);
    this.hourTo.set(null);
    this.emitChange();
  }

  protected onRelativeValueChange(value: number): void {
    this.relativeValue.set(value || 1);
    this.emitChange();
  }

  protected onRelativeUnitChange(unit: RelativeTimeUnit): void {
    this.relativeUnit.set(unit);
    this.emitChange();
  }

  protected onCustomFromChange(date: Date): void {
    this.customFrom.set(date);
    this.emitChange();
  }

  protected onCustomToChange(date: Date): void {
    this.customTo.set(date);
    this.emitChange();
  }

  private emitChange(): void {
    const range = this.currentRange();
    if (range) {
      this.rangeChange.emit(range);
      this.rangeChangeISO.emit(TimeRangeUtils.toISO(range));
    }

    const selection: TimeRangeSelection = {
      type: this.selectedType(),
      year: this.selectedYear(),
      quarter: this.selectedQuarter(),
      month: this.selectedMonth(),
      day: this.selectedDay(),
      hourFrom: this.hourFrom() ?? undefined,
      hourTo: this.hourTo() ?? undefined,
      relativeValue: this.relativeValue(),
      relativeUnit: this.relativeUnit(),
      customFrom: this.customFrom(),
      customTo: this.customTo()
    };
    this.selectionChange.emit(selection);
  }

  // Helper for template
  protected isType(type: TimeRangeType): boolean {
    return this.selectedType() === type;
  }
}
