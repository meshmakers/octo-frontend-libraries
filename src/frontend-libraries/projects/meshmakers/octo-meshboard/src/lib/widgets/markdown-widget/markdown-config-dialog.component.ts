import { Component, Input, Output, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from '@progress/kendo-angular-dialog';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { MarkdownModule } from 'ngx-markdown';
import { Subject } from 'rxjs';
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
    DialogModule,
    ButtonsModule,
    InputsModule,
    MarkdownModule
  ],
  template: `
    <kendo-dialog
      title="Markdown Widget Configuration"
      [minWidth]="600"
      [width]="800"
      [height]="600"
      (close)="onCancel()">

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
            <div class="markdown-preview lcars-prose">
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

      <kendo-dialog-actions>
        <button kendoButton fillMode="flat" (click)="onCancel()">Cancel</button>
        <button kendoButton themeColor="primary" (click)="onSave()">Save</button>
      </kendo-dialog-actions>
    </kendo-dialog>
  `,
  styles: [`
    .config-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
      height: 100%;
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
      border: 1px solid rgba(100, 206, 185, 0.3);
      border-radius: 4px;
      resize: none;
      background: #1f2e40;
      color: #c8d0d8;
    }

    .markdown-editor::placeholder {
      color: #6b7a8c;
    }

    .markdown-preview {
      flex: 1;
      padding: 12px;
      border: 1px solid rgba(100, 206, 185, 0.3);
      border-radius: 4px;
      overflow: auto;
      background: #1f2e40;
    }

    .form-section {
      padding: 12px;
      background: #394555;
      border: 1px solid rgba(100, 206, 185, 0.2);
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
      color: #c8d0d8;
    }

    .field-hint {
      margin: 0;
      font-size: 0.8rem;
      color: #9292a6;
    }

    /* LCARS-themed prose styles for preview */
    .lcars-prose {
      color: #c8d0d8;
      line-height: 1.6;

      h1, h2, h3, h4, h5, h6 {
        color: #64ceb9;
        font-weight: 600;
        margin-top: 1em;
        margin-bottom: 0.5em;
      }

      h1 { font-size: 1.5rem; }
      h2 { font-size: 1.25rem; }
      h3 { font-size: 1.1rem; }

      p { margin-bottom: 0.75em; }

      a { color: #00a8dc; }

      code {
        background: rgba(100, 206, 185, 0.1);
        color: #64ceb9;
        padding: 0.2em 0.4em;
        border-radius: 4px;
      }

      pre {
        background: #394555;
        color: #c8d0d8;
        padding: 1em;
        border-radius: 8px;
        overflow-x: auto;
      }

      pre code {
        background: transparent;
        color: #c8d0d8;
      }

      blockquote {
        border-left: 4px solid #6c4da8;
        background: rgba(108, 77, 168, 0.1);
        padding: 0.75em 1em;
        margin: 1em 0;
        border-radius: 0 8px 8px 0;
      }

      strong, b {
        color: #ffffff;
        font-weight: 600;
      }

      em, i {
        color: #00a8dc;
      }
    }
  `]
})
export class MarkdownConfigDialogComponent implements OnInit {
  @Input() initialContent?: string;
  @Input() initialResolveVariables?: boolean;
  @Input() initialPadding?: string;
  @Input() initialTextAlign?: MarkdownTextAlign;

  @Output() save = new Subject<MarkdownConfigResult>();
  @Output() cancelled = new Subject<void>();

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
    this.save.next({
      ckTypeId: '',  // Not used for static content
      content: this.content,
      resolveVariables: this.resolveVariables,
      padding: this.padding || undefined,
      textAlign: this.textAlign
    });
  }

  onCancel(): void {
    this.cancelled.next();
  }
}
