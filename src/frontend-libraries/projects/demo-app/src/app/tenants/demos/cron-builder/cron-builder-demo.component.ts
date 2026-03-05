import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import {
  CronBuilderComponent,
  CronBuilderConfig,
  CronParserService,
  CronHumanizerService
} from '@meshmakers/shared-ui';

@Component({
  selector: 'app-cron-builder-demo',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonsModule,
    CronBuilderComponent
  ],
  template: `
    <div class="demo-container">
      <h2>Cron Expression Builder Demo</h2>

      <div class="description">
        <p>
          The Cron Expression Builder component allows users to create cron expressions
          through an intuitive UI with tabs for different schedule types. It supports
          6-field cron format: <code>second minute hour day month weekday</code>
        </p>
      </div>

      <!-- Basic Example with ngModel -->
      <div class="section">
        <h3>Basic Usage (ngModel)</h3>
        <mm-cron-builder
          [(ngModel)]="cronExpression"
          [config]="defaultConfig">
        </mm-cron-builder>
        <div class="output-inline">
          <strong>Value:</strong> <code>{{ cronExpression }}</code>
        </div>
      </div>

      <!-- Reactive Forms Example -->
      <div class="section">
        <h3>Reactive Forms Integration</h3>
        <form [formGroup]="form">
          <mm-cron-builder
            formControlName="schedule"
            [config]="reactiveFormConfig">
          </mm-cron-builder>
        </form>
        <div class="form-status">
          <p><strong>Form Value:</strong> <code>{{ form.get('schedule')?.value }}</code></p>
          <p><strong>Valid:</strong> {{ form.valid ? 'Yes' : 'No' }}</p>
          <p><strong>Touched:</strong> {{ form.get('schedule')?.touched ? 'Yes' : 'No' }}</p>
        </div>
      </div>

      <!-- Minimal Config -->
      <div class="section">
        <h3>Minimal Configuration (No Presets, No Next Executions)</h3>
        <mm-cron-builder
          [(ngModel)]="minimalExpression"
          [config]="minimalConfig">
        </mm-cron-builder>
      </div>

      <!-- German Locale -->
      <div class="section">
        <h3>German Locale</h3>
        <mm-cron-builder
          [(ngModel)]="germanExpression"
          [config]="germanConfig">
        </mm-cron-builder>
      </div>

      <!-- Custom Tab Only -->
      <div class="section">
        <h3>Custom/Advanced Only</h3>
        <mm-cron-builder
          [(ngModel)]="customOnlyExpression"
          [config]="customOnlyConfig">
        </mm-cron-builder>
      </div>

      <!-- Preset Examples -->
      <div class="section">
        <h3>Common Cron Expressions</h3>
        <div class="preset-grid">
          @for (preset of commonExpressions; track preset.label) {
            <div class="preset-card">
              <div class="preset-label">{{ preset.label }}</div>
              <code class="preset-expression">{{ preset.expression }}</code>
              <div class="preset-description">{{ getHumanReadable(preset.expression) }}</div>
              <button kendoButton
                      size="small"
                      fillMode="outline"
                      (click)="cronExpression = preset.expression">
                Use This
              </button>
            </div>
          }
        </div>
      </div>

      <!-- Parser Service Demo -->
      <div class="section">
        <h3>Cron Parser Service</h3>
        <div class="service-demo">
          <div class="input-row">
            <label>Test Expression:</label>
            <input type="text"
                   class="test-input"
                   [(ngModel)]="testExpression"
                   placeholder="Enter cron expression">
            <button kendoButton (click)="parseExpression()">Parse</button>
          </div>

          <div class="output-grid">
            <div class="output-card">
              <h4>Validation Result</h4>
              <div class="output" [class.valid]="validationResult()?.isValid" [class.invalid]="!validationResult()?.isValid">
                @if (validationResult()?.isValid) {
                  <span class="success">Valid</span>
                } @else {
                  <span class="error">{{ validationResult()?.error }}</span>
                }
              </div>
            </div>

            <div class="output-card">
              <h4>Human Readable</h4>
              <div class="output">
                {{ humanReadable() }}
              </div>
            </div>

            <div class="output-card">
              <h4>Next 5 Executions</h4>
              <div class="output">
                <ul class="execution-list">
                  @for (exec of nextExecutions(); track $index) {
                    <li>{{ exec | date:'medium' }}</li>
                  }
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Configuration Reference -->
      <div class="instructions">
        <h3>Configuration Options</h3>
        <table class="config-table">
          <thead>
            <tr>
              <th>Option</th>
              <th>Type</th>
              <th>Default</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>showPresets</code></td>
              <td>boolean</td>
              <td>true</td>
              <td>Show quick-select preset buttons</td>
            </tr>
            <tr>
              <td><code>showHumanReadable</code></td>
              <td>boolean</td>
              <td>true</td>
              <td>Show human-readable description</td>
            </tr>
            <tr>
              <td><code>showNextExecutions</code></td>
              <td>boolean</td>
              <td>true</td>
              <td>Show next execution times</td>
            </tr>
            <tr>
              <td><code>maxNextExecutions</code></td>
              <td>number</td>
              <td>3</td>
              <td>Number of next executions to display</td>
            </tr>
            <tr>
              <td><code>showCopyButton</code></td>
              <td>boolean</td>
              <td>true</td>
              <td>Show copy to clipboard button</td>
            </tr>
            <tr>
              <td><code>allowCustom</code></td>
              <td>boolean</td>
              <td>true</td>
              <td>Show the Custom/Advanced tab</td>
            </tr>
            <tr>
              <td><code>defaultScheduleType</code></td>
              <td>ScheduleType</td>
              <td>'daily'</td>
              <td>Initial tab to display</td>
            </tr>
            <tr>
              <td><code>locale</code></td>
              <td>string</td>
              <td>'en'</td>
              <td>Locale for human-readable text ('en' | 'de')</td>
            </tr>
          </tbody>
        </table>

        <h3>Schedule Types</h3>
        <ul>
          <li><strong>Seconds:</strong> Run every N seconds</li>
          <li><strong>Minutes:</strong> Run every N minutes</li>
          <li><strong>Hourly:</strong> Run every N hours at specific minute/second</li>
          <li><strong>Daily:</strong> Run at specific time, every day/weekdays/weekends/specific days</li>
          <li><strong>Weekly:</strong> Run at specific time on selected days</li>
          <li><strong>Monthly:</strong> Run on specific day of month or relative day (first Monday, etc.)</li>
          <li><strong>Custom:</strong> Direct cron field editing with syntax reference</li>
        </ul>

        <h3>Form Integration</h3>
        <p>The component implements <code>ControlValueAccessor</code> for seamless form integration:</p>
        <ul>
          <li>Works with <code>ngModel</code> (template-driven forms)</li>
          <li>Works with <code>formControlName</code> (reactive forms)</li>
          <li>Supports <code>disabled</code> state</li>
          <li>Emits value changes on every schedule modification</li>
        </ul>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

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

    .output-inline {
      margin-top: 15px;
      padding: 10px;
      background: #f0f0f0;
      border-radius: 4px;
    }

    .output-inline code {
      background: #e0e0e0;
      color: #333333;
      padding: 4px 8px;
      border-radius: 4px;
      font-family: 'Consolas', monospace;
    }

    .form-status {
      margin-top: 15px;
      padding: 15px;
      background: #f5f5f5;
      border-radius: 4px;
      border-left: 4px solid #757575;
    }

    .form-status p {
      margin: 5px 0;
    }

    .form-status code {
      background: #e0e0e0;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: monospace;
    }

    .preset-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 15px;
    }

    .preset-card {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 15px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .preset-label {
      font-weight: 600;
      color: #333;
    }

    .preset-expression {
      background: #e0e0e0;
      color: #333333;
      padding: 6px 10px;
      border-radius: 4px;
      font-family: 'Consolas', monospace;
      font-size: 13px;
    }

    .preset-description {
      font-size: 13px;
      color: #666;
      flex: 1;
    }

    .service-demo {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .input-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .input-row label {
      font-weight: 500;
    }

    .test-input {
      flex: 1;
      max-width: 300px;
      padding: 8px 12px;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-family: 'Consolas', monospace;
    }

    .output-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
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
      min-height: 40px;
    }

    .output.valid {
      border-color: #4caf50;
      background: #e8f5e9;
    }

    .output.invalid {
      border-color: #f44336;
      background: #ffebee;
    }

    .output .success {
      color: #2e7d32;
      font-weight: 600;
    }

    .output .error {
      color: #c62828;
    }

    .execution-list {
      margin: 0;
      padding-left: 20px;
    }

    .execution-list li {
      margin-bottom: 5px;
      font-family: 'Consolas', monospace;
      font-size: 13px;
    }

    .instructions {
      background: #f5f5f5;
      padding: 20px;
      border-radius: 8px;
      border-left: 4px solid #757575;
    }

    .instructions h3 {
      margin-top: 0;
      color: #424242;
    }

    .instructions ul {
      padding-left: 20px;
    }

    .instructions li {
      margin-bottom: 8px;
    }

    .instructions code {
      background: #e0e0e0;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: monospace;
      font-size: 12px;
    }

    .config-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      background: white;
      border-radius: 4px;
      overflow: hidden;
    }

    .config-table th,
    .config-table td {
      padding: 10px 12px;
      text-align: left;
      border-bottom: 1px solid #e0e0e0;
    }

    .config-table th {
      background: #616161;
      color: white;
      font-weight: 600;
    }

    .config-table td code {
      background: #e0e0e0;
    }
  `]
})
export class CronBuilderDemoComponent {
  private readonly cronParser = inject(CronParserService);
  private readonly cronHumanizer = inject(CronHumanizerService);
  private readonly fb = inject(FormBuilder);

  // Basic example value
  cronExpression = '0 0 9 * * 1-5';

  // Reactive form
  form: FormGroup;

  // Minimal config example
  minimalExpression = '0 */15 * * * *';

  // German locale example
  germanExpression = '0 0 8 * * *';

  // Custom only example
  customOnlyExpression = '0 30 */2 * * *';

  // Test expression for parser demo
  testExpression = '0 0 9 * * 1-5';

  // Computed values for parser demo
  validationResult = signal<{ isValid: boolean; error?: string } | null>(null);
  humanReadable = signal<string>('');
  nextExecutions = signal<Date[]>([]);

  // Configurations
  defaultConfig: CronBuilderConfig = {
    showPresets: true,
    showHumanReadable: true,
    showNextExecutions: true,
    maxNextExecutions: 3,
    showCopyButton: true,
    allowCustom: true,
    defaultScheduleType: 'daily',
    locale: 'en'
  };

  reactiveFormConfig: CronBuilderConfig = {
    showPresets: true,
    showHumanReadable: true,
    showNextExecutions: true,
    defaultScheduleType: 'hourly'
  };

  minimalConfig: CronBuilderConfig = {
    showPresets: false,
    showHumanReadable: true,
    showNextExecutions: false,
    showCopyButton: false,
    allowCustom: false,
    defaultScheduleType: 'minutes'
  };

  germanConfig: CronBuilderConfig = {
    showPresets: true,
    showHumanReadable: true,
    showNextExecutions: true,
    locale: 'de',
    defaultScheduleType: 'daily'
  };

  customOnlyConfig: CronBuilderConfig = {
    showPresets: false,
    showHumanReadable: true,
    showNextExecutions: true,
    allowCustom: true,
    defaultScheduleType: 'custom'
  };

  // Common expressions for reference
  commonExpressions = [
    { label: 'Every minute', expression: '0 * * * * *' },
    { label: 'Every 5 minutes', expression: '0 */5 * * * *' },
    { label: 'Every hour', expression: '0 0 * * * *' },
    { label: 'Daily at midnight', expression: '0 0 0 * * *' },
    { label: 'Daily at 9 AM', expression: '0 0 9 * * *' },
    { label: 'Weekdays at 9 AM', expression: '0 0 9 * * 1-5' },
    { label: 'Every Monday', expression: '0 0 9 * * 1' },
    { label: 'First of month', expression: '0 0 0 1 * *' },
    { label: 'Every 30 seconds', expression: '*/30 * * * * *' }
  ];

  constructor() {
    this.form = this.fb.group({
      schedule: ['0 0 */2 * * *', Validators.required]
    });

    // Initial parse
    this.parseExpression();
  }

  getHumanReadable(expression: string): string {
    return this.cronHumanizer.toHumanReadable(expression, 'en');
  }

  parseExpression(): void {
    const result = this.cronParser.validate(this.testExpression);
    this.validationResult.set(result);

    if (result.isValid) {
      this.humanReadable.set(this.cronHumanizer.toHumanReadable(this.testExpression, 'en'));
      this.nextExecutions.set(this.cronParser.getNextExecutions(this.testExpression, 5));
    } else {
      this.humanReadable.set('Invalid expression');
      this.nextExecutions.set([]);
    }
  }
}
