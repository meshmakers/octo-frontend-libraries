import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogRef, DialogModule } from '@progress/kendo-angular-dialog';
import { ButtonModule } from '@progress/kendo-angular-buttons';
import { TextAreaModule } from '@progress/kendo-angular-inputs';
import { FormsModule } from '@angular/forms';
import { copyIcon, xIcon } from '@progress/kendo-svg-icons';

export interface MessageDetailsDialogData {
  title: string;
  details: string;
  level: 'error' | 'warning';
}

@Component({
  selector: 'mm-message-details-dialog',
  standalone: true,
  imports: [
    CommonModule,
    DialogModule,
    ButtonModule,
    TextAreaModule,
    FormsModule
  ],
  template: `
    <div class="message-details-content">
      <div class="dialog-header">
        <h3>{{dialogTitle}}</h3>
      </div>

      <div class="details-section">
        <label class="details-label">Details:</label>
        <textarea
          kendoTextArea
          [(ngModel)]="details"
          [readonly]="true"
          class="details-textarea">
        </textarea>
      </div>

      <div class="dialog-actions">
        <button
          kendoButton
          [svgIcon]="copyIcon"
          themeColor="primary"
          (click)="copyToClipboard()">
          Copy to Clipboard
        </button>
        <button
          kendoButton
          [svgIcon]="xIcon"
          themeColor="base"
          (click)="onClose()">
          Close
        </button>
      </div>
    </div>
  `,
  styles: [`
    .message-details-content {
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 20px;
      box-sizing: border-box;
      overflow: hidden;
    }

    .dialog-header {
      flex-shrink: 0;
      border-bottom: 1px solid var(--kendo-color-border);
      padding-bottom: 12px;
      margin-bottom: 16px;
    }

    .dialog-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    }

    .details-section {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-height: 0; /* Important for flex child with overflow */
      overflow: hidden;
    }

    .details-label {
      flex-shrink: 0;
      font-weight: 600;
      font-size: 14px;
    }

    .details-textarea {
      flex: 1;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      resize: none;
      border: 1px solid var(--kendo-color-border);
      background: var(--kendo-color-base-subtle);
      border-radius: 4px;
      padding: 12px;
      line-height: 1.5;
      width: 100%;
      box-sizing: border-box;
      overflow-y: auto;
      overflow-x: auto;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    .dialog-actions {
      flex-shrink: 0;
      padding-top: 16px;
      margin-top: 16px;
      border-top: 1px solid var(--kendo-color-border);
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      gap: 12px;
    }

    /* Ensure proper scrollbar styling */
    .details-textarea::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    .details-textarea::-webkit-scrollbar-track {
      background: var(--kendo-color-base-subtle);
      border-radius: 4px;
    }

    .details-textarea::-webkit-scrollbar-thumb {
      background: var(--kendo-color-base-subtle);
      border-radius: 4px;
    }

    .details-textarea::-webkit-scrollbar-thumb:hover {
      background: var(--kendo-color-base-subtle);
    }
  `]
})
export class MessageDetailsDialogComponent implements OnInit {
  protected readonly copyIcon = copyIcon;
  protected readonly xIcon = xIcon;

  private readonly dialogRef = inject(DialogRef);

  // These will be injected by the dialog service
  public data!: MessageDetailsDialogData;
  public title = '';
  public details = '';
  public level: 'error' | 'warning' = 'error';

  ngOnInit(): void {
    // Data is injected by the dialog service
    if (this.data) {
      this.title = this.data.title;
      this.details = this.data.details;
      this.level = this.data.level;
    }
  }

  get dialogTitle(): string {
    const levelText = this.level === 'error' ? 'Error' : 'Warning';
    return `${levelText} Details: ${this.title}`;
  }

  onClose(): void {
    this.dialogRef.close();
  }

  async copyToClipboard(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.details);

      // Could show a brief success message here
      console.log('Details copied to clipboard');

      // Optionally show a brief success indication
      // this.showSuccessIndicator();
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);

      // Fallback for older browsers
      this.fallbackCopyToClipboard(this.details);
    }
  }

  private fallbackCopyToClipboard(text: string): void {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
      document.execCommand('copy');
      console.log('Details copied to clipboard (fallback)');
    } catch (error) {
      console.error('Fallback copy failed:', error);
    } finally {
      document.body.removeChild(textarea);
    }
  }
}
