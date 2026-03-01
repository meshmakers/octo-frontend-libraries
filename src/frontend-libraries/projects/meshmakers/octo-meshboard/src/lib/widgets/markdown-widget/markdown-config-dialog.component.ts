import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { MarkdownModule } from 'ngx-markdown';
import { WidgetConfigResult } from '../../services/widget-registry.service';
import { MarkdownTextAlign } from '../../models/meshboard.models';

/**
 * Result from the Markdown config dialog.
 */
export interface MarkdownConfigResult extends WidgetConfigResult {
  content: string;
  resolveVariables: boolean;
  padding?: string;
  textAlign?: MarkdownTextAlign;
}

@Component({
  selector: 'mm-markdown-config-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonsModule,
    InputsModule,
    MarkdownModule
  ],
  template: `
    <div class="config-container">

      <div class="config-form">
        <!-- Preview Toggle -->
        <div class="mode-toggle">
          <button kendoButton
            [fillMode]="showPreview() ? 'outline' : 'solid'"
            [themeColor]="showPreview() ? 'base' : 'primary'"
            (click)="showPreview.set(false)">
            Edit
          </button>
          <button kendoButton
            [fillMode]="showPreview() ? 'solid' : 'outline'"
            [themeColor]="showPreview() ? 'primary' : 'base'"
            (click)="showPreview.set(true)">
            Preview
          </button>
        </div>

        <!-- Editor / Preview Area -->
        <div class="editor-area">
          @if (!showPreview()) {
            <textarea
              class="markdown-editor"
              [(ngModel)]="content"
              placeholder="Enter markdown content here...

# Heading 1
## Heading 2

**Bold text** and *italic text*

- List item 1
- List item 2

[Link text](https://example.com)

> Blockquote

\`\`\`
Code block
\`\`\`

Variables: $variableName or \${variableName}">
            </textarea>
          } @else {
            <div class="markdown-preview mm-prose">
              <markdown [data]="content"></markdown>
            </div>
          }
        </div>

        <!-- Options -->
        <div class="form-section">
          <div class="form-row">
            <div class="form-field">
              <label>
                <input type="checkbox" kendoCheckBox [(ngModel)]="resolveVariables" />
                Resolve MeshBoard Variables
              </label>
              <p class="field-hint">
                Replace $variableName with MeshBoard variable values.
              </p>
            </div>
          </div>

          <div class="form-row">
            <div class="form-field">
              <label>Text Alignment</label>
              <kendo-buttongroup selection="single">
                <button kendoButton
                  [selected]="textAlign === 'left'"
                  (click)="textAlign = 'left'">Left</button>
                <button kendoButton
                  [selected]="textAlign === 'center'"
                  (click)="textAlign = 'center'">Center</button>
                <button kendoButton
                  [selected]="textAlign === 'right'"
                  (click)="textAlign = 'right'">Right</button>
              </kendo-buttongroup>
            </div>

            <div class="form-field">
              <label>Padding</label>
              <kendo-textbox
                [(ngModel)]="padding"
                placeholder="16px">
              </kendo-textbox>
            </div>
          </div>
        </div>
      </div>

      <div class="action-bar">
        <button kendoButton fillMode="flat" (click)="onCancel()">Cancel</button>
        <button kendoButton themeColor="primary" (click)="onSave()">Save</button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
      --mm-prose-editor-bg: #f5f5f5;
      --mm-prose-editor-text: #333333;
      --mm-prose-editor-placeholder: #999999;
      --mm-prose-editor-border: #e0e0e0;
      --mm-prose-preview-border: #e0e0e0;
      --mm-prose-form-bg: #f5f5f5;
      --mm-prose-form-border: #e0e0e0;
      --mm-prose-label-text: #333333;
      --mm-prose-hint-text: #666666;
    }

    .config-container {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .action-bar {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 8px 16px;
      border-top: 1px solid var(--kendo-color-border, #dee2e6);
    }

    .config-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
      height: 100%;
      flex: 1;
      overflow-y: auto;
    }

    .mode-toggle {
      display: flex;
      gap: 8px;
    }

    .editor-area {
      flex: 1;
      min-height: 300px;
      display: flex;
      flex-direction: column;
    }

    .markdown-editor {
      flex: 1;
      width: 100%;
      font-family: 'Roboto Mono', monospace;
      font-size: 0.9rem;
      padding: 12px;
      border: 1px solid var(--mm-prose-editor-border);
      border-radius: 4px;
      resize: none;
      background: var(--mm-prose-editor-bg);
      color: var(--mm-prose-editor-text);
    }

    .markdown-editor::placeholder {
      color: var(--mm-prose-editor-placeholder);
    }

    .markdown-preview {
      flex: 1;
      padding: 12px;
      border: 1px solid var(--mm-prose-preview-border);
      border-radius: 4px;
      overflow: auto;
      background: var(--mm-prose-editor-bg);
    }

    .form-section {
      padding: 12px;
      background: var(--mm-prose-form-bg);
      border: 1px solid var(--mm-prose-form-border);
      border-radius: 4px;
    }

    .form-row {
      display: flex;
      gap: 16px;
      align-items: flex-start;
    }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .form-field label {
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--mm-prose-label-text);
    }

    .field-hint {
      margin: 0;
      font-size: 0.8rem;
      color: var(--mm-prose-hint-text);
    }

    /* Prose styles for preview - uses same CSS variables as the widget */
    .mm-prose {
      color: var(--mm-prose-text, #333333);
      line-height: 1.6;

      h1, h2, h3, h4, h5, h6 {
        color: var(--mm-prose-heading, #1976d2);
        font-weight: 600;
        margin-top: 1em;
        margin-bottom: 0.5em;
      }

      h1 { font-size: 1.5rem; }
      h2 { font-size: 1.25rem; }
      h3 { font-size: 1.1rem; }

      p { margin-bottom: 0.75em; }

      a { color: var(--mm-prose-link, #1565c0); }

      code {
        background: var(--mm-prose-code-bg, #f5f5f5);
        color: var(--mm-prose-code-text, #d32f2f);
        padding: 0.2em 0.4em;
        border-radius: 4px;
      }

      pre {
        background: var(--mm-prose-pre-bg, #f5f5f5);
        color: var(--mm-prose-text, #333333);
        padding: 1em;
        border-radius: 8px;
        overflow-x: auto;
      }

      pre code {
        background: transparent;
        color: var(--mm-prose-text, #333333);
      }

      blockquote {
        border-left: 4px solid var(--mm-prose-blockquote-border, #6c4da8);
        background: var(--mm-prose-blockquote-bg, rgba(108, 77, 168, 0.05));
        padding: 0.75em 1em;
        margin: 1em 0;
        border-radius: 0 8px 8px 0;
      }

      strong, b {
        color: var(--mm-prose-strong, #111111);
        font-weight: 600;
      }

      em, i {
        color: var(--mm-prose-em, #1565c0);
      }
    }
  `]
})
export class MarkdownConfigDialogComponent implements OnInit {
  private readonly windowRef = inject(WindowRef);

  @Input() initialContent?: string;
  @Input() initialResolveVariables?: boolean;
  @Input() initialPadding?: string;
  @Input() initialTextAlign?: MarkdownTextAlign;

  readonly showPreview = signal(false);

  content = '';
  resolveVariables = true;
  padding = '16px';
  textAlign: MarkdownTextAlign = 'left';

  ngOnInit(): void {
    this.content = this.initialContent ?? '';
    this.resolveVariables = this.initialResolveVariables ?? true;
    this.padding = this.initialPadding ?? '16px';
    this.textAlign = this.initialTextAlign ?? 'left';
  }

  onSave(): void {
    this.windowRef.close({
      ckTypeId: '',  // Not used for static content
      content: this.content,
      resolveVariables: this.resolveVariables,
      padding: this.padding || undefined,
      textAlign: this.textAlign
    });
  }

  onCancel(): void {
    this.windowRef.close();
  }
}
