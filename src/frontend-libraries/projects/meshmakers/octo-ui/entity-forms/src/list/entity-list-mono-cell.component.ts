import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/** Cell of a list column with `Display: mono` — the raw value in a monospace font. */
@Component({
  selector: 'mm-entity-list-mono-cell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="mm-entity-list-mono" [title]="text">{{ text }}</span>`,
  styles: [`
    .mm-entity-list-mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.9em;
    }
  `],
})
export class EntityListMonoCellComponent {
  @Input() value: unknown;

  protected get text(): string {
    if (this.value === null || this.value === undefined) {
      return '';
    }
    return typeof this.value === 'object' ? JSON.stringify(this.value) : String(this.value);
  }
}
