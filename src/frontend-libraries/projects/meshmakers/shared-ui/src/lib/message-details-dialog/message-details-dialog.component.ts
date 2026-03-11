import { Component, inject, OnInit } from '@angular/core';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { ButtonModule } from '@progress/kendo-angular-buttons';
import { copyIcon, xIcon } from '@progress/kendo-svg-icons';

export interface MessageDetailsDialogData {
  title: string;
  details: string;
  level: 'error' | 'warning';
  copyLabel?: string;
  closeLabel?: string;
}

@Component({
  selector: 'mm-message-details-dialog',
  standalone: true,
  imports: [
    ButtonModule,
  ],
  template: `
    <div class="message-details-content">
      @if (!details) {
        <div class="loading-section">
          <span class="k-icon k-i-loading"></span>
        </div>
      } @else {
        <pre class="details-pre">{{ details }}</pre>
      }

      <div class="dialog-actions">
        <button
          kendoButton
          [svgIcon]="copyIcon"
          themeColor="primary"
          (click)="copyToClipboard()">
          {{ copyLabel }}
        </button>
        <button
          kendoButton
          [svgIcon]="xIcon"
          themeColor="base"
          (click)="onClose()">
          {{ closeLabel }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .message-details-content {
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 16px;
      box-sizing: border-box;
      overflow: hidden;
    }

    .loading-section {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .details-pre {
      flex: 1;
      margin: 0;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      line-height: 1.5;
      border: 1px solid var(--kendo-color-border);
      background: var(--kendo-color-base-subtle);
      border-radius: 4px;
      padding: 12px;
      overflow: scroll;
      white-space: pre;
      min-height: 0;
    }

    .details-pre::-webkit-scrollbar {
      width: 10px;
      height: 10px;
    }

    .details-pre::-webkit-scrollbar-track {
      background: var(--kendo-color-base-subtle, #f5f5f5);
      border-radius: 4px;
    }

    .details-pre::-webkit-scrollbar-thumb {
      background: var(--kendo-color-border, #ccc);
      border-radius: 4px;
    }

    .details-pre::-webkit-scrollbar-thumb:hover {
      background: #999;
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
  `]
})
export class MessageDetailsDialogComponent implements OnInit {
  protected readonly copyIcon = copyIcon;
  protected readonly xIcon = xIcon;

  private readonly windowRef = inject(WindowRef);

  public data!: MessageDetailsDialogData;
  public details = '';
  public copyLabel = 'Copy to Clipboard';
  public closeLabel = 'Close';

  ngOnInit(): void {
    if (this.data) {
      this.details = this.data.details;
      if (this.data.copyLabel) this.copyLabel = this.data.copyLabel;
      if (this.data.closeLabel) this.closeLabel = this.data.closeLabel;
    }
  }

  onClose(): void {
    this.windowRef.close();
  }

  async copyToClipboard(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.details);
    } catch {
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
    } catch {
      // clipboard fallback failed silently
    } finally {
      document.body.removeChild(textarea);
    }
  }
}
