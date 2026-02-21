import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LabelModule } from '@progress/kendo-angular-label';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { CopyableTextComponent } from '@meshmakers/shared-ui';

@Component({
  selector: 'app-copyable-text-demo',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LabelModule,
    InputsModule,
    CopyableTextComponent
  ],
  template: `
    <div class="demo-container">
      <h2>Copyable Text Demo</h2>

      <div class="description">
        <p>
          The <code>mm-copyable-text</code> component displays a read-only text value with
          a copy-to-clipboard button. Useful for displaying IDs, keys, or other values
          that users may need to copy.
        </p>
      </div>

      <!-- Basic Example with Label -->
      <div class="section">
        <h3>Basic Usage with Label</h3>
        <mm-copyable-text
          [value]="sampleRtId"
          label="Runtime ID"
          copyLabel="Runtime ID"
          (copied)="onCopied($event)">
        </mm-copyable-text>
      </div>

      <!-- Without Label -->
      <div class="section">
        <h3>Without Label</h3>
        <mm-copyable-text
          [value]="sampleApiKey"
          copyLabel="API Key"
          (copied)="onCopied($event)">
        </mm-copyable-text>
      </div>

      <!-- Custom Copy Label -->
      <div class="section">
        <h3>Custom Copy Label (for notification)</h3>
        <p class="hint">The notification will say "Secret Token copied to clipboard"</p>
        <mm-copyable-text
          [value]="sampleToken"
          label="Access Token"
          copyLabel="Secret Token"
          (copied)="onCopied($event)">
        </mm-copyable-text>
      </div>

      <!-- Empty Value -->
      <div class="section">
        <h3>Empty/Null Value (shows em-dash)</h3>
        <mm-copyable-text
          [value]="null"
          label="Empty Value">
        </mm-copyable-text>
      </div>

      <!-- In a Form Context -->
      <div class="section">
        <h3>In a Form Context (Kendo Form Field)</h3>
        <div class="k-form k-form-lg">
          <div class="k-form-field">
            <kendo-label text="Entity Name"></kendo-label>
            <kendo-textbox [(ngModel)]="entityName" placeholder="Enter name"></kendo-textbox>
          </div>
          <div class="k-form-field">
            <kendo-label text="Entity ID"></kendo-label>
            <mm-copyable-text
              [value]="entityId"
              copyLabel="Entity ID">
            </mm-copyable-text>
          </div>
        </div>
      </div>

      <!-- Interactive Test -->
      <div class="section">
        <h3>Interactive Test</h3>
        <div class="k-form k-form-lg">
          <div class="k-form-field">
            <kendo-label text="Enter a value to copy"></kendo-label>
            <kendo-textbox [(ngModel)]="customValue" placeholder="Type something..."></kendo-textbox>
          </div>
        </div>
        <div class="interactive-result">
          <mm-copyable-text
            [value]="customValue"
            label="Your Value"
            copyLabel="Custom Value"
            (copied)="onCopied($event)">
          </mm-copyable-text>
        </div>
      </div>

      <!-- Copy Events Log -->
      <div class="section">
        <h3>Copy Events Log</h3>
        <div class="events-log">
          @if (copyEvents().length === 0) {
            <p class="no-events">No copy events yet. Click a copy button above.</p>
          } @else {
            @for (event of copyEvents(); track $index) {
              <div class="event-item">
                <span class="event-time">{{ event.time | date:'HH:mm:ss' }}</span>
                <span class="event-value">Copied: "{{ event.value }}"</span>
              </div>
            }
          }
        </div>
      </div>

      <!-- Instructions -->
      <div class="instructions">
        <h3>Usage</h3>
        <pre><code>&lt;mm-copyable-text
  [value]="rtId"
  label="Runtime ID"
  copyLabel="Runtime ID"
  (copied)="onCopied($event)"&gt;
&lt;/mm-copyable-text&gt;</code></pre>

        <h4>Inputs</h4>
        <ul>
          <li><code>value</code> (required): The string value to display and copy</li>
          <li><code>label</code>: Optional label displayed above the value</li>
          <li><code>copyLabel</code>: Label used in the success notification (falls back to label, then "Value")</li>
          <li><code>buttonTitle</code>: Tooltip for the copy button (default: "Copy to clipboard")</li>
        </ul>

        <h4>Outputs</h4>
        <ul>
          <li><code>copied</code>: Emits the copied value on successful copy</li>
        </ul>

        <h4>Behavior</h4>
        <ul>
          <li>Displays an em-dash (—) when value is null, undefined, or empty</li>
          <li>Copy button is hidden when there's no value to copy</li>
          <li>Shows a success notification for 2 seconds after copying</li>
          <li>Shows an error notification if clipboard access fails</li>
        </ul>
      </div>
    </div>
  `,
  styles: [`
    .demo-container {
      padding: 20px;
      max-width: 800px;
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

    .hint {
      font-size: 0.875rem;
      color: #666;
      margin-bottom: 10px;
    }

    .interactive-result {
      margin-top: 15px;
      padding: 15px;
      background: white;
      border-radius: 4px;
      border: 1px solid #e0e0e0;
    }

    .events-log {
      background: #1e1e1e;
      padding: 15px;
      border-radius: 4px;
      min-height: 100px;
      max-height: 200px;
      overflow-y: auto;
    }

    .no-events {
      color: #888;
      font-style: italic;
      margin: 0;
    }

    .event-item {
      display: flex;
      gap: 10px;
      padding: 5px 0;
      border-bottom: 1px solid #333;
      font-family: monospace;
      font-size: 13px;
    }

    .event-item:last-child {
      border-bottom: none;
    }

    .event-time {
      color: #64ceb9;
    }

    .event-value {
      color: #fff;
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

    .instructions pre {
      background: #f5f5f5;
      padding: 15px;
      border-radius: 4px;
      overflow-x: auto;
    }

    .instructions code {
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 13px;
    }

    .instructions ul {
      margin-bottom: 0;
      padding-left: 20px;
    }

    .instructions li {
      margin-bottom: 8px;
    }

    .instructions li code {
      background: #bbdefb;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 12px;
    }
  `]
})
export class CopyableTextDemoComponent {
  // Sample values
  sampleRtId = 'rt_a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  sampleApiKey = 'sk-proj-abc123def456ghi789jkl012mno345pqr678stu901vwx234yz';
  sampleToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N';

  // Form context demo
  entityName = 'My Entity';
  entityId = 'System.Core/Entity:12345';

  // Interactive test
  customValue = '';

  // Copy events log
  copyEvents = signal<{ time: Date; value: string }[]>([]);

  onCopied(value: string): void {
    this.copyEvents.update(events => [
      { time: new Date(), value },
      ...events.slice(0, 9) // Keep last 10 events
    ]);
  }
}
