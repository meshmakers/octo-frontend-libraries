import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { ComboBoxModule } from '@progress/kendo-angular-dropdowns';
import { RtEntityDto } from '../graphQL/globalTypes';
import { AttributeItemLike } from './data-point-picker.utils';
import { DataPointResolverService } from './data-point-resolver.service';

/**
 * Source data-point picker for DataPointMapping `sourceAttributePath`.
 *
 * Renders a Kendo combobox of the data points exposed by a source entity —
 * a Loxone Control's State names (`tempActual`, `co2`, …), an MQTT topic
 * sub-key, an OPC-UA node attribute, etc. — with `currentValue` as the
 * always-available default for single-state sources.
 *
 * Two ways to feed the picker:
 * - `entity` — pass a pre-loaded RtEntityDto; the picker reads the
 *   States/DataPoints RecordArray straight off it (no GraphQL roundtrip).
 *   Used by the runtime-browser detail pane.
 * - `entityRtId` + `entityCkTypeId` — the picker fetches the entity via
 *   `getRuntimeEntityById` and extracts data points itself. Used by the
 *   mapping-edit dialog where only the IDs are known.
 *
 * `allowCustom: true` keeps the picker useful when the user needs to escape
 * the catalogue — e.g. typing a path the entity hasn't published yet, or a
 * field a future state will expose.
 */
@Component({
  selector: 'mm-data-point-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ComboBoxModule],
  template: `
    <kendo-combobox
      [data]="filteredOptions()"
      [value]="value()"
      [valuePrimitive]="true"
      [allowCustom]="true"
      [filterable]="true"
      [disabled]="disabled() || loading()"
      [popupSettings]="{ appendTo: 'root', animate: true }"
      [placeholder]="placeholder()"
      (valueChange)="onValueChange($event)"
      (filterChange)="onFilterChange($event)">
    </kendo-combobox>
    @if (loading()) {
      <span class="dpp-loading">loading…</span>
    }
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      width: 100%;
    }
    kendo-combobox {
      flex: 1;
      min-width: 0;
    }
    .dpp-loading {
      font-size: 0.7rem;
      padding: 1px 6px;
      border-radius: 8px;
      background: color-mix(in srgb, var(--kendo-color-info, #0dcaf0) 18%, transparent);
      color: var(--kendo-color-info, #0dcaf0);
      font-style: italic;
    }
  `],
})
export class DataPointPickerComponent {
  private readonly resolver = inject(DataPointResolverService);

  /** Pre-loaded source entity. When set, no GraphQL call is made. */
  readonly entity = input<RtEntityDto | null | undefined>(null);

  /** Source entity rtId. Required (together with ckTypeId) when `entity` is not provided. */
  readonly entityRtId = input<string | null | undefined>(null);

  /** Source entity CK type id. */
  readonly entityCkTypeId = input<string | null | undefined>(null);

  /** Two-way bound data-point name. */
  readonly value = model<string>('');

  /** Optional placeholder shown when the combobox is empty. */
  readonly placeholder = input<string>('e.g. tempActual, currentValue');

  /** Disables the combobox without hiding it. */
  readonly disabled = input<boolean>(false);

  /** Emits whenever the user enters a custom filter — useful for callers that
   *  want to refine a backing catalogue independently of the value selection. */
  readonly filterChange = output<string>();

  protected readonly options = signal<string[]>([]);
  protected readonly loading = signal<boolean>(false);

  /**
   * Current filter text entered into the combobox. Drives the case-insensitive
   * *contains* match below. Kendo's combobox by default does not filter the
   * `[data]` it is given — when `filterable` is true it just emits
   * `filterChange` events and expects the consumer to refilter. Without this,
   * typing "co2" would show every data point regardless of name.
   */
  protected readonly filter = signal<string>('');

  protected readonly filteredOptions = computed<string[]>(() => {
    const all = this.options();
    const needle = this.filter().trim().toLowerCase();
    if (!needle) return all;
    return all.filter(o => o.toLowerCase().includes(needle));
  });

  constructor() {
    // Re-resolve whenever the entity or its identifying ids change. We use
    // `untracked` around the actual mutation/IO to keep the effect's read
    // dependencies limited to the inputs that should trigger a refetch.
    effect(() => {
      const ent = this.entity();
      const rtId = this.entityRtId();
      const ckTypeId = this.entityCkTypeId();
      untracked(() => {
        if (ent) {
          this.options.set(this.resolver.extractFromEntity(ent as Parameters<DataPointResolverService['extractFromEntity']>[0]));
          this.loading.set(false);
          return;
        }
        if (!rtId || !ckTypeId) {
          this.options.set([]);
          this.loading.set(false);
          return;
        }
        this.loading.set(true);
        void this.resolver.load(rtId, ckTypeId).then(opts => {
          // Only commit if the inputs haven't changed underneath us. We compare
          // against the current input snapshot to avoid stomping a fresher load.
          if (this.entityRtId() === rtId && this.entityCkTypeId() === ckTypeId) {
            this.options.set(opts);
            this.loading.set(false);
          }
        });
      });
    });
  }

  protected onValueChange(v: string | null): void {
    this.value.set(v ?? '');
  }

  protected onFilterChange(filter: string): void {
    this.filter.set(filter);
    this.filterChange.emit(filter);
  }
}

/** Re-export the attribute item shape so consumers don't have to fish it out
 *  of the utils file when forwarding entities to the picker. */
export type { AttributeItemLike };
