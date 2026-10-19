import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnDestroy,
  ViewChild,
  inject
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { Subscription } from 'rxjs';
import { EditorState, Extension, RangeSetBuilder, StateEffect, Transaction } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { splitTemplateSegments } from './template-placeholders';

const refreshMarks = StateEffect.define<null>();

@Component({
  selector: 'mm-template-source-editor',
  standalone: true,
  template: '<div #host class="editor"></div>',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host {
      display: flex;
      flex: 1 1 auto;
      min-height: 0;
    }
    :host(.single-line) {
      flex: 0 0 auto;
    }
    .editor {
      flex: 1 1 auto;
      min-width: 0;
      min-height: 0;
    }
    :host ::ng-deep .cm-editor {
      height: 100%;
      font-family: inherit;
      font-size: 0.875rem;
      line-height: 1.6;
      background: var(--kendo-color-surface, #fff);
      border-bottom: 1px solid var(--kendo-color-border, rgba(0, 0, 0, 0.16));
    }
    :host ::ng-deep .cm-editor.cm-focused {
      outline: none;
      border-bottom-color: var(--kendo-color-primary, #1565c0);
    }
    :host ::ng-deep .cm-scroller {
      font-family: inherit;
      overflow: auto;
    }
    :host ::ng-deep .cm-content {
      padding: 8px 12px;
    }
    :host ::ng-deep .cm-line {
      padding: 0;
    }
    :host ::ng-deep .cm-placeholder-known {
      background-color: var(--mm-template-token-known, rgba(21, 101, 192, 0.16));
      border-radius: 3px;
    }
    :host ::ng-deep .cm-placeholder-unknown {
      background-color: var(--mm-template-token-unknown, rgba(198, 40, 40, 0.16));
      border-radius: 3px;
    }
  `]
})
export class TemplateSourceEditorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('host', { static: true }) private hostDiv!: ElementRef<HTMLElement>;

  @Input({ required: true }) control!: FormControl;

  @Input() singleLine = false;

  @Input() set isKnownToken(isKnown: (token: string) => boolean) {
    this.isKnown = isKnown;
    this.view?.dispatch({ effects: refreshMarks.of(null) });
  }

  private isKnown: (token: string) => boolean = () => true;

  private readonly zone = inject(NgZone);
  private readonly hostRef = inject(ElementRef<HTMLElement>);
  private view?: EditorView;
  private subscription: Subscription | null = null;
  private applyingFromControl = false;

  ngAfterViewInit(): void {
    if (this.singleLine) {
      this.hostRef.nativeElement.classList.add('single-line');
    }

    this.zone.runOutsideAngular(() => {
      this.view = new EditorView({
        parent: this.hostDiv.nativeElement,
        state: EditorState.create({
          doc: (this.control.value as string | null) ?? '',
          extensions: this.extensions()
        })
      });
    });

    this.subscription = this.control.valueChanges
      .subscribe(value => this.applyFromControl((value as string | null) ?? ''));
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;
    this.view?.destroy();
    this.view = undefined;
  }

  insertToken(token: string): void {
    const view = this.view;
    if (!view) {
      return;
    }
    view.dispatch(view.state.replaceSelection(token));
    view.focus();
  }

  focus(): void {
    this.view?.focus();
  }

  private extensions(): Extension[] {
    const decorate = (view: EditorView): DecorationSet => this.decorate(view);
    const marks = ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;
        constructor(view: EditorView) {
          this.decorations = decorate(view);
        }
        update(update: ViewUpdate): void {
          const refreshed = update.transactions.some(tr => tr.effects.some(effect => effect.is(refreshMarks)));
          if (update.docChanged || update.viewportChanged || refreshed) {
            this.decorations = decorate(update.view);
          }
        }
      },
      { decorations: plugin => plugin.decorations }
    );

    const extensions: Extension[] = [
      marks,
      EditorView.updateListener.of(update => {
        if (update.docChanged) {
          this.pushToControl(update.state.doc.toString());
        }
      })
    ];

    if (this.singleLine) {
      extensions.push(
        EditorState.transactionFilter.of(transaction => {
          if (!transaction.docChanged) {
            return transaction;
          }
          let hasNewline = false;
          transaction.changes.iterChanges((_fromA, _toA, _fromB, _toB, inserted) => {
            if (inserted.lines > 1) {
              hasNewline = true;
            }
          });
          if (!hasNewline) {
            return transaction;
          }
          const flattened = transaction.newDoc.toString().replace(/\r?\n/g, '');
          return {
            changes: { from: 0, to: transaction.startState.doc.length, insert: flattened },
            selection: { anchor: Math.min(transaction.newSelection.main.head, flattened.length) }
          };
        })
      );
    } else {
      extensions.push(EditorView.lineWrapping);
    }

    return extensions;
  }

  private decorate(view: EditorView): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    let at = 0;
    for (const segment of splitTemplateSegments(view.state.doc.toString(), this.isKnown)) {
      if (segment.kind !== 'text') {
        builder.add(at, at + segment.text.length,
          Decoration.mark({ class: segment.kind === 'known' ? 'cm-placeholder-known' : 'cm-placeholder-unknown' }));
      }
      at += segment.text.length;
    }
    return builder.finish();
  }

  private pushToControl(value: string): void {
    if (this.applyingFromControl) {
      return;
    }
    this.zone.run(() => {
      this.control.setValue(value);
      this.control.markAsDirty();
    });
  }

  private applyFromControl(value: string): void {
    const view = this.view;
    if (!view || view.state.doc.toString() === value) {
      return;
    }
    this.applyingFromControl = true;
    try {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
        annotations: Transaction.remote.of(true)
      });
    } finally {
      this.applyingFromControl = false;
    }
  }
}
