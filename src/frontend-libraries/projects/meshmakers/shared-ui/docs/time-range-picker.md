# Time Range Picker - Developer Documentation

## Overview

The Time Range Picker component provides a flexible way to select time ranges. It supports multiple selection modes and outputs both JavaScript Date objects and ISO 8601 formatted strings.

## Features

| Mode | Description |
|------|-------------|
| **Year** | Select a full year (Jan 1 - Dec 31) |
| **Quarter** | Select a year and quarter (Q1-Q4) |
| **Month** | Select a year and month |
| **Relative** | Last N hours/days/weeks/months from now |
| **Custom** | Pick any start and end date (with optional time) |

---

## Installation

The component is part of `@meshmakers/shared-ui`:

```typescript
import {
  TimeRangePickerComponent,
  TimeRange,
  TimeRangeISO,
  TimeRangeSelection,
  TimeRangePickerConfig,
  TimeRangePickerLabels,
  TimeRangeUtils
} from '@meshmakers/shared-ui';
```

---

## Basic Usage

```typescript
@Component({
  imports: [TimeRangePickerComponent],
  template: `
    <mm-time-range-picker
      (rangeChange)="onRangeChange($event)">
    </mm-time-range-picker>
  `
})
export class MyComponent {
  onRangeChange(range: TimeRange): void {
    console.log('From:', range.from);  // Date object
    console.log('To:', range.to);      // Date object
  }
}
```

---

## API Reference

### Inputs

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `config` | `TimeRangePickerConfig` | `{}` | Configuration options |
| `labels` | `TimeRangePickerLabels` | `{}` | Custom labels for UI elements |
| `initialSelection` | `TimeRangeSelection` | - | Initial selection to restore |

### Outputs

| Output | Type | Description |
|--------|------|-------------|
| `rangeChange` | `TimeRange` | Emits `{ from: Date, to: Date }` |
| `rangeChangeISO` | `TimeRangeISO` | Emits `{ from: string, to: string }` (ISO 8601) |
| `selectionChange` | `TimeRangeSelection` | Emits full selection state (for persistence) |

---

## Configuration

### TimeRangePickerConfig

```typescript
interface TimeRangePickerConfig {
  // Limit available range types (default: all)
  availableTypes?: ('year' | 'quarter' | 'month' | 'relative' | 'custom')[];

  // Year dropdown range
  minYear?: number;  // Default: current year - 10
  maxYear?: number;  // Default: current year + 1

  // Relative mode defaults
  defaultRelativeValue?: number;  // Default: 24
  defaultRelativeUnit?: 'hours' | 'days' | 'weeks' | 'months';  // Default: 'hours'

  // Custom mode options
  minDate?: Date;     // Minimum selectable date
  maxDate?: Date;     // Maximum selectable date
  showTime?: boolean; // Show time picker (default: false)
}
```

### TimeRangePickerLabels

```typescript
interface TimeRangePickerLabels {
  // Field labels
  rangeType?: string;      // "Range Type"
  year?: string;           // "Year"
  quarter?: string;        // "Quarter"
  month?: string;          // "Month"
  relativeValue?: string;  // "Last"
  relativeUnit?: string;   // "Unit"
  customFrom?: string;     // "From"
  customTo?: string;       // "To"

  // Type dropdown options
  typeYear?: string;       // "Year"
  typeQuarter?: string;    // "Quarter"
  typeMonth?: string;      // "Month"
  typeRelative?: string;   // "Relative"
  typeCustom?: string;     // "Custom"

  // Relative unit options
  unitHours?: string;      // "Hours"
  unitDays?: string;       // "Days"
  unitWeeks?: string;      // "Weeks"
  unitMonths?: string;     // "Months"

  // Quarter labels
  quarter1?: string;       // "Q1 (Jan-Mar)"
  quarter2?: string;       // "Q2 (Apr-Jun)"
  quarter3?: string;       // "Q3 (Jul-Sep)"
  quarter4?: string;       // "Q4 (Oct-Dec)"
}
```

---

## Examples

### Example 1: Limited Types

Show only Year, Month, and Relative options:

```typescript
@Component({
  template: `
    <mm-time-range-picker
      [config]="config"
      (rangeChange)="onRangeChange($event)">
    </mm-time-range-picker>
  `
})
export class MyComponent {
  config: TimeRangePickerConfig = {
    availableTypes: ['year', 'month', 'relative'],
    defaultRelativeValue: 7,
    defaultRelativeUnit: 'days'
  };
}
```

### Example 2: German Labels

```typescript
@Component({
  template: `
    <mm-time-range-picker
      [config]="config"
      [labels]="labels"
      (rangeChange)="onRangeChange($event)">
    </mm-time-range-picker>
  `
})
export class MyComponent {
  config: TimeRangePickerConfig = {
    availableTypes: ['year', 'quarter', 'month', 'relative']
  };

  labels: TimeRangePickerLabels = {
    rangeType: 'Zeitraum',
    year: 'Jahr',
    quarter: 'Quartal',
    month: 'Monat',
    relativeValue: 'Letzte',
    relativeUnit: 'Einheit',
    customFrom: 'Von',
    customTo: 'Bis',
    typeYear: 'Jahr',
    typeQuarter: 'Quartal',
    typeMonth: 'Monat',
    typeRelative: 'Relativ',
    typeCustom: 'Benutzerdefiniert',
    unitHours: 'Stunden',
    unitDays: 'Tage',
    unitWeeks: 'Wochen',
    unitMonths: 'Monate',
    quarter1: 'Q1 (Jan-Mär)',
    quarter2: 'Q2 (Apr-Jun)',
    quarter3: 'Q3 (Jul-Sep)',
    quarter4: 'Q4 (Okt-Dez)'
  };
}
```

### Example 3: Relative Time Only (Dashboard Filter)

```typescript
@Component({
  template: `
    <mm-time-range-picker
      [config]="config"
      (rangeChangeISO)="onRangeChange($event)">
    </mm-time-range-picker>
  `
})
export class DashboardComponent {
  config: TimeRangePickerConfig = {
    availableTypes: ['relative'],
    defaultRelativeValue: 24,
    defaultRelativeUnit: 'hours'
  };

  onRangeChange(range: TimeRangeISO): void {
    // Use ISO strings for API calls
    this.loadData(range.from, range.to);
  }
}
```

### Example 4: Custom Date Range with Time

```typescript
@Component({
  template: `
    <mm-time-range-picker
      [config]="config"
      (rangeChange)="onRangeChange($event)">
    </mm-time-range-picker>
  `
})
export class ReportComponent {
  config: TimeRangePickerConfig = {
    availableTypes: ['custom'],
    showTime: true,
    minDate: new Date(2020, 0, 1),
    maxDate: new Date()
  };
}
```

### Example 5: Persisting Selection State

```typescript
@Component({
  template: `
    <mm-time-range-picker
      [initialSelection]="savedSelection"
      (selectionChange)="onSelectionChange($event)"
      (rangeChange)="onRangeChange($event)">
    </mm-time-range-picker>
  `
})
export class MyComponent implements OnInit {
  savedSelection?: TimeRangeSelection;

  ngOnInit(): void {
    // Restore from localStorage or service
    const saved = localStorage.getItem('timeRangeSelection');
    if (saved) {
      this.savedSelection = JSON.parse(saved);
    }
  }

  onSelectionChange(selection: TimeRangeSelection): void {
    // Save selection for later restoration
    localStorage.setItem('timeRangeSelection', JSON.stringify(selection));
  }

  onRangeChange(range: TimeRange): void {
    // Use the computed range
    this.fetchData(range.from, range.to);
  }
}
```

---

## Output Formats

### TimeRange (Date Objects)

```typescript
interface TimeRange {
  from: Date;  // Start of range
  to: Date;    // End of range
}
```

Example output for "Year 2024":
```json
{
  "from": "2024-01-01T00:00:00.000Z",
  "to": "2024-12-31T23:59:59.999Z"
}
```

### TimeRangeISO (ISO 8601 Strings)

```typescript
interface TimeRangeISO {
  from: string;  // ISO 8601 formatted string
  to: string;    // ISO 8601 formatted string
}
```

Example output:
```json
{
  "from": "2024-01-01T00:00:00.000Z",
  "to": "2024-12-31T23:59:59.999Z"
}
```

---

## Utility Functions

The `TimeRangeUtils` class provides helper functions:

```typescript
import { TimeRangeUtils } from '@meshmakers/shared-ui';

// Get range for a specific year
const yearRange = TimeRangeUtils.getYearRange(2024);

// Get range for a specific quarter
const q2Range = TimeRangeUtils.getQuarterRange(2024, 2);

// Get range for a specific month (0-indexed)
const marchRange = TimeRangeUtils.getMonthRange(2024, 2);

// Get relative range from now
const last7Days = TimeRangeUtils.getRelativeRange(7, 'days');
const last24Hours = TimeRangeUtils.getRelativeRange(24, 'hours');

// Convert TimeRange to ISO format
const isoRange = TimeRangeUtils.toISO(range);

// Get current quarter (1-4)
const currentQuarter = TimeRangeUtils.getCurrentQuarter();

// Generate dropdown options
const yearOptions = TimeRangeUtils.generateYearOptions(2020, 2025);
const monthOptions = TimeRangeUtils.generateMonthOptions();
```

---

## Styling

The component uses CSS classes for customization:

```scss
.time-range-picker {
  // Main container (flexbox)
}

.picker-field {
  // Individual field wrapper
}

.type-field { }      // Range type dropdown
.year-field { }      // Year dropdown
.quarter-field { }   // Quarter dropdown
.month-field { }     // Month dropdown
.relative-value-field { }  // Numeric input for relative
.relative-unit-field { }   // Unit dropdown for relative
.custom-from-field { }     // From date picker
.custom-to-field { }       // To date picker
```

Override styles in your component:

```scss
:host ::ng-deep .time-range-picker {
  gap: 2rem;

  .picker-field {
    min-width: 200px;
  }
}
```

---

## Integration with GraphQL

Example using the ISO output for GraphQL queries:

```typescript
@Component({
  template: `
    <mm-time-range-picker
      [config]="{ availableTypes: ['relative', 'custom'] }"
      (rangeChangeISO)="onRangeChange($event)">
    </mm-time-range-picker>
  `
})
export class DataViewComponent {
  private readonly dataService = inject(DataService);

  onRangeChange(range: TimeRangeISO): void {
    this.dataService.fetchData({
      fromDate: range.from,
      toDate: range.to
    }).subscribe(data => {
      this.data = data;
    });
  }
}
```

---

## Demo

A live demo is available in the template-app:

**Route:** `/demos/time-range-picker`

**Menu:** Demos → Time Range Picker
