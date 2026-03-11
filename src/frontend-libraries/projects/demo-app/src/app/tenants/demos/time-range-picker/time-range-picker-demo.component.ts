import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { CheckBoxModule } from '@progress/kendo-angular-inputs';
import {
  TimeRangePickerComponent,
  TimeRange,
  TimeRangeISO,
  TimeRangeSelection,
  TimeRangePickerConfig,
  TimeRangePickerLabels
} from '@meshmakers/shared-ui';

@Component({
  selector: 'app-time-range-picker-demo',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonsModule,
    CheckBoxModule,
    TimeRangePickerComponent
  ],
  template: `
    <div class="demo-container">
      <h2>Time Range Picker Demo</h2>

      <div class="description">
        <p>
          The Time Range Picker component allows users to select a time range in various ways:
          Year, Quarter, Month, Relative (last N hours/days/weeks/months), or Custom date range.
          The output is a TimeRange object with <code>from</code> and <code>to</code> dates.
        </p>
      </div>

      <!-- Basic Example -->
      <div class="section">
        <h3>Basic Usage (All Types)</h3>
        <mm-time-range-picker
          (rangeChange)="onRangeChange($event)"
          (rangeChangeISO)="onRangeChangeISO($event)"
          (selectionChange)="onSelectionChange($event)">
        </mm-time-range-picker>
      </div>

      <!-- Limited Types Example -->
      <div class="section">
        <h3>Limited Types (Year, Month, Relative)</h3>
        <mm-time-range-picker
          [config]="limitedConfig"
          (rangeChange)="onRangeChange($event)">
        </mm-time-range-picker>
      </div>

      <!-- Custom Labels (German) -->
      <div class="section">
        <h3>Custom Labels (German)</h3>
        <mm-time-range-picker
          [config]="germanConfig"
          [labels]="germanLabels"
          (rangeChange)="onRangeChange($event)">
        </mm-time-range-picker>
      </div>

      <!-- With Time Selection -->
      <div class="section">
        <h3>Custom Range with Time</h3>
        <mm-time-range-picker
          [config]="customWithTimeConfig"
          (rangeChange)="onRangeChange($event)">
        </mm-time-range-picker>
      </div>

      <!-- Relative Only -->
      <div class="section">
        <h3>Relative Time Only</h3>
        <mm-time-range-picker
          [config]="relativeOnlyConfig"
          (rangeChange)="onRangeChange($event)">
        </mm-time-range-picker>
      </div>

      <!-- Output Display -->
      <div class="section">
        <h3>Current Output</h3>

        <div class="output-grid">
          <div class="output-card">
            <h4>TimeRange (Date Objects)</h4>
            <div class="output">
              <pre>{{ currentRange() | json }}</pre>
            </div>
            @if (currentRange()) {
              <div class="formatted-dates">
                <p><strong>From:</strong> {{ currentRange()!.from | date:'medium' }}</p>
                <p><strong>To:</strong> {{ currentRange()!.to | date:'medium' }}</p>
              </div>
            }
          </div>

          <div class="output-card">
            <h4>TimeRangeISO (ISO 8601 Strings)</h4>
            <div class="output">
              <pre>{{ currentRangeISO() | json }}</pre>
            </div>
          </div>

          <div class="output-card">
            <h4>Selection State</h4>
            <div class="output">
              <pre>{{ currentSelection() | json }}</pre>
            </div>
          </div>
        </div>
      </div>

      <!-- Instructions -->
      <div class="instructions">
        <h3>Features</h3>
        <ul>
          <li><strong>Year:</strong> Select a full year (Jan 1 - Dec 31)</li>
          <li><strong>Quarter:</strong> Select a year and quarter (Q1-Q4)</li>
          <li><strong>Month:</strong> Select a year and month</li>
          <li><strong>Relative:</strong> Last N hours/days/weeks/months from now</li>
          <li><strong>Custom:</strong> Pick any start and end date</li>
        </ul>

        <h4>Configuration Options</h4>
        <ul>
          <li><code>availableTypes</code>: Limit which range types are shown</li>
          <li><code>minYear / maxYear</code>: Set year range for dropdowns</li>
          <li><code>defaultRelativeValue / defaultRelativeUnit</code>: Default for relative mode</li>
          <li><code>showTime</code>: Show time picker in custom mode</li>
          <li><code>minDate / maxDate</code>: Limits for custom date pickers</li>
        </ul>

        <h4>Outputs</h4>
        <ul>
          <li><code>rangeChange</code>: Emits <code>TimeRange</code> with JavaScript Date objects</li>
          <li><code>rangeChangeISO</code>: Emits <code>TimeRangeISO</code> with ISO 8601 strings</li>
          <li><code>selectionChange</code>: Emits full selection state for persistence</li>
        </ul>
      </div>
    </div>
  `,
  styles: [`
    .demo-container {
      padding: 20px;
      max-width: 1200px;
    }

    .description {
      background: #f5f5f5;
      padding: 15px;
      border-radius: 4px;
      margin-bottom: 20px;
    }

    .description p {
      margin: 0;
    }

    .description code {
      background: #e0e0e0;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: monospace;
    }

    .section {
      margin-bottom: 30px;
      padding: 20px;
      background: #fafafa;
      border-radius: 8px;
      border: 1px solid #e0e0e0;
    }

    .section h3 {
      margin-top: 0;
      margin-bottom: 15px;
      color: #333;
    }

    .output-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
    }

    .output-card {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 15px;
    }

    .output-card h4 {
      margin-top: 0;
      margin-bottom: 10px;
      color: #555;
      font-size: 14px;
    }

    .output {
      background: #f8f9fa;
      border: 1px solid #e9ecef;
      border-radius: 4px;
      padding: 15px;
      overflow-x: auto;
    }

    .output pre {
      margin: 0;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 12px;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .formatted-dates {
      margin-top: 10px;
      padding: 10px;
      background: #e8f5e9;
      border-radius: 4px;
    }

    .formatted-dates p {
      margin: 5px 0;
      font-size: 13px;
    }

    .instructions {
      background: #e7f3ff;
      padding: 20px;
      border-radius: 8px;
      border-left: 4px solid #1976d2;
    }

    .instructions h3 {
      margin-top: 0;
      color: #1976d2;
    }

    .instructions h4 {
      margin-top: 20px;
      margin-bottom: 10px;
      color: #1976d2;
    }

    .instructions ul {
      margin-bottom: 0;
      padding-left: 20px;
    }

    .instructions li {
      margin-bottom: 8px;
    }

    .instructions code {
      background: #bbdefb;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: monospace;
      font-size: 12px;
    }
  `]
})
export class TimeRangePickerDemoComponent {
  // Current values
  currentRange = signal<TimeRange | null>(null);
  currentRangeISO = signal<TimeRangeISO | null>(null);
  currentSelection = signal<TimeRangeSelection | null>(null);

  // Config: Limited types
  limitedConfig: TimeRangePickerConfig = {
    availableTypes: ['year', 'month', 'relative'],
    defaultRelativeValue: 7,
    defaultRelativeUnit: 'days'
  };

  // Config: German labels
  germanConfig: TimeRangePickerConfig = {
    availableTypes: ['year', 'quarter', 'month', 'relative']
  };

  germanLabels: TimeRangePickerLabels = {
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

  // Config: Custom with time
  customWithTimeConfig: TimeRangePickerConfig = {
    availableTypes: ['custom'],
    showTime: true
  };

  // Config: Relative only
  relativeOnlyConfig: TimeRangePickerConfig = {
    availableTypes: ['relative'],
    defaultRelativeValue: 24,
    defaultRelativeUnit: 'hours'
  };

  onRangeChange(range: TimeRange): void {
    this.currentRange.set(range);
    console.log('Range changed:', range);
  }

  onRangeChangeISO(range: TimeRangeISO): void {
    this.currentRangeISO.set(range);
    console.log('Range ISO changed:', range);
  }

  onSelectionChange(selection: TimeRangeSelection): void {
    this.currentSelection.set(selection);
    console.log('Selection changed:', selection);
  }
}
