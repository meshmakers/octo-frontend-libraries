import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { KENDO_INPUTS } from '@progress/kendo-angular-inputs';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import { plusIcon, searchIcon } from '@progress/kendo-svg-icons';
import { injectMmT } from '@meshmakers/shared-ui';
import { shortPlaceholderToken, TemplatePlaceholder, TemplatePlaceholderGroup } from './template-placeholders';
import { DEFAULT_TEMPLATE_EDITOR_MESSAGES, TEMPLATE_EDITOR_KEY } from './template-editor.messages';

@Component({
  selector: 'mm-placeholder-catalog',
  standalone: true,
  imports: [KENDO_INPUTS, SVGIconModule],
  template: `
    <section class="panel">
      @if (targetLabel()) {
        <p class="panel-target">
          {{ t(key + '.insertingInto') }} <strong>{{ targetLabel() }}</strong>
        </p>
      }

      <div class="panel-search">
        <kendo-svgicon class="panel-search-icon" [icon]="searchIcon"></kendo-svgicon>
        <kendo-textbox
          [value]="searchTerm()"
          [clearButton]="true"
          [placeholder]="t(key + '.search')"
          (valueChange)="onSearchChange($event ?? '')"
        ></kendo-textbox>
      </div>

      @if (visibleGroups().length > 0) {
        <div class="panel-body" [class.single-group]="groups().length === 1">
          @if (groups().length > 1) {
            <nav class="group-rail">
              @for (group of visibleGroups(); track group.id) {
                <button
                  type="button"
                  class="group-item"
                  [class.is-active]="group.id === activeGroup()?.id"
                  [class.is-unavailable]="!!group.unavailable"
                  [title]="group.unavailable ?? group.label"
                  (click)="selectedGroupId.set(group.id)"
                >
                  <span class="group-name">{{ group.label }}</span>
                  <span class="group-count">{{ group.placeholders.length }}</span>
                </button>
              }
            </nav>
          }

          <ul class="entry-list">
            @if (activeGroup()?.unavailable; as reason) {
              <li class="group-unavailable" role="note">{{ reason }}</li>
            }
            @for (placeholder of activeGroup()?.placeholders ?? []; track placeholder.token) {
              <li>
                <button
                  type="button"
                  class="entry"
                  [class.is-unavailable]="!!activeGroup()?.unavailable"
                  [attr.aria-disabled]="activeGroup()?.unavailable ? true : null"
                  [title]="placeholder.token"
                  (click)="pick(placeholder)"
                >
                  <span class="entry-top">
                    <span class="entry-label">{{ placeholder.label }}</span>
                    @if (usageCount(placeholder); as count) {
                      <span class="entry-usage" [title]="t(key + '.inUse', { count })">{{ count }}&times;</span>
                    }
                    @if (!activeGroup()?.unavailable) {
                      <kendo-svgicon class="entry-insert" [icon]="plusIcon"></kendo-svgicon>
                    }
                  </span>
                  <span class="entry-detail">
                    <code class="entry-token">{{ shortToken(placeholder.token) }}</code>
                    @if (placeholder.sample) {
                      <span class="entry-sample" [title]="placeholder.sample">
                        <span class="entry-sample-tag">{{ t(key + '.example') }}</span>
                        {{ placeholder.sample }}
                      </span>
                    }
                  </span>
                  @if (placeholder.note) {
                    <span class="entry-note">{{ placeholder.note }}</span>
                  }
                </button>
              </li>
            }
          </ul>
        </div>
      } @else {
        <div class="panel-empty">
          <p class="panel-empty-title">{{ t(key + '.noResults', { term: searchTerm() }) }}</p>
          <button type="button" class="panel-empty-action" (click)="onSearchChange('')">
            {{ t(key + '.clearSearch') }}
          </button>
        </div>
      }

      <footer class="panel-foot">
        @if (lastInserted(); as token) {
          <span class="panel-inserted">{{ t(key + '.inserted', { token }) }}</span>
        } @else {
          <span class="panel-hint">{{ t(key + '.hint') }}</span>
        }
      </footer>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host {
      display: block;
      min-width: 0;
      min-height: 0;
    }
    .panel {
      display: flex;
      flex-direction: column;
      gap: 10px;
      height: 100%;
      min-height: 0;
      padding: 10px 12px;
      border-radius: 4px;
      border-left: 3px solid var(--kendo-color-primary, #1976d2);
    }
    .panel-target {
      margin: 0;
      font-size: 0.82rem;
      color: var(--kendo-color-subtle, #666);
    }
    .panel-search {
      flex: 0 0 auto;
      position: relative;
      display: flex;
      align-items: center;
    }
    .panel-search-icon {
      position: absolute;
      left: 11px;
      z-index: 1;
      pointer-events: none;
      color: var(--kendo-color-subtle, #666);
    }
    .panel-search kendo-textbox {
      width: 100%;
    }
    :host ::ng-deep .panel-search .k-input-inner {
      padding-left: 30px;
    }
    .panel-body {
      flex: 1 1 auto;
      min-height: 0;
      display: grid;
      grid-template-columns: 176px minmax(0, 1fr);
      gap: 14px;
    }
    .panel-body.single-group {
      grid-template-columns: minmax(0, 1fr);
    }
    .group-rail {
      display: flex;
      flex-direction: column;
      gap: 2px;
      overflow-y: auto;
      padding-right: 12px;
      border-right: 1px solid var(--kendo-color-border, rgba(0, 0, 0, 0.08));
    }
    .group-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 8px 10px;
      border: none;
      border-radius: 4px;
      background: transparent;
      font: inherit;
      font-size: 0.85rem;
      text-align: left;
      color: var(--kendo-color-on-app-surface, #333);
      cursor: pointer;
      transition: background-color 0.15s ease;
    }
    .group-name,
    .entry-token,
    .entry-label,
    .entry-sample,
    .panel-foot {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .group-name {
      min-width: 0;
    }
    .group-item:hover {
      background-color: rgba(0, 0, 0, 0.05);
    }
    .group-item.is-active {
      background-color: var(--kendo-color-primary, #1976d2);
      color: var(--kendo-color-on-primary, #fff);
      font-weight: 600;
    }
    .group-count,
    .entry-usage {
      flex: 0 0 auto;
      padding: 1px 6px;
      border-radius: 4px;
      background-color: rgba(0, 0, 0, 0.07);
      font-weight: 600;
    }
    .group-count {
      min-width: 20px;
      font-size: 0.72rem;
      text-align: center;
    }
    .group-item.is-active .group-count {
      background-color: rgba(255, 255, 255, 0.25);
    }
    .entry-list {
      min-height: 0;
      overflow-y: auto;
      list-style: none;
      margin: 0;
      padding: 0 4px 0 0;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .entry {
      display: flex;
      flex-direction: column;
      gap: 3px;
      width: 100%;
      padding: 9px 11px;
      border: 1px solid transparent;
      border-radius: 4px;
      background: transparent;
      font: inherit;
      text-align: left;
      cursor: pointer;
      transition: background-color 0.15s ease, border-color 0.15s ease;
    }
    .entry:hover,
    .entry:focus-visible {
      background-color: rgba(0, 0, 0, 0.045);
      border-color: rgba(0, 0, 0, 0.08);
    }
    .entry-top {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .entry-label {
      min-width: 0;
      font-size: 0.86rem;
      font-weight: 500;
      color: var(--kendo-color-on-app-surface, #333);
    }
    .entry-usage {
      font-size: 0.68rem;
      color: var(--kendo-color-subtle, #666);
    }
    .entry-insert {
      flex: 0 0 auto;
      margin-left: auto;
      opacity: 0;
      color: var(--kendo-color-primary, #1976d2);
      transition: opacity 0.15s ease;
    }
    .entry:hover .entry-insert,
    .entry:focus-visible .entry-insert {
      opacity: 1;
    }
    .entry-detail {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 16px;
      min-width: 0;
      font-size: 0.78rem;
    }
    .entry-token {
      flex: 0 1 auto;
      min-width: 0;
      font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
      font-size: 0.76rem;
      color: var(--kendo-color-primary, #1976d2);
      text-align: left;
    }
    .entry-sample {
      flex: 0 1 auto;
      min-width: 0;
      text-align: right;
      color: var(--kendo-color-on-app-surface, #333);
    }
    .entry-note,
    .entry-sample-tag {
      font-size: 0.7rem;
      color: var(--kendo-color-subtle, #666);
    }
    .entry-note {
      display: block;
      margin-top: 2px;
    }
    .entry-sample-tag {
      margin-right: 4px;
    }
    .panel-empty {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 24px 12px;
      text-align: center;
    }
    .panel-empty-title {
      margin: 0;
      font-size: 0.88rem;
      color: var(--kendo-color-subtle, #666);
    }
    .panel-empty-action {
      padding: 4px 8px;
      border: none;
      border-radius: 4px;
      background: transparent;
      font: inherit;
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--kendo-color-primary, #1976d2);
      cursor: pointer;
    }
    .panel-empty-action:hover,
    .panel-empty-action:focus-visible {
      background-color: rgba(0, 0, 0, 0.05);
    }
    .panel-foot {
      flex: 0 0 auto;
      min-height: 1.2rem;
      font-size: 0.78rem;
    }
    .panel-inserted {
      color: var(--kendo-color-success, #2e7d32);
    }
    .panel-hint {
      color: var(--kendo-color-subtle, #888);
    }
    .group-item.is-unavailable:not(.is-active) {
      opacity: 0.55;
    }
    .group-unavailable {
      padding: 8px 11px;
      border-radius: 4px;
      background-color: rgba(0, 0, 0, 0.045);
      font-size: 0.8rem;
      color: var(--kendo-color-subtle, #666);
    }
    .entry.is-unavailable {
      cursor: default;
      opacity: 0.6;
    }
    .entry.is-unavailable:hover {
      background-color: transparent;
      border-color: transparent;
    }
  `]
})
export class PlaceholderCatalogComponent {
  protected readonly t = injectMmT(DEFAULT_TEMPLATE_EDITOR_MESSAGES);
  protected get key(): string {
    return TEMPLATE_EDITOR_KEY;
  }

  protected readonly searchIcon = searchIcon;
  protected readonly plusIcon = plusIcon;

  readonly groups = input.required<readonly TemplatePlaceholderGroup[]>();
  readonly targetLabel = input('');
  readonly templateText = input('');
  readonly insertPlaceholder = output<string>();

  protected readonly searchTerm = signal('');
  protected readonly selectedGroupId = signal<string | null>(null);
  protected readonly lastInserted = signal<string | null>(null);

  protected readonly visibleGroups = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) {
      return this.groups();
    }
    return this.groups()
      .map(group => ({ ...group, placeholders: group.placeholders.filter(placeholder => matches(placeholder, term)) }))
      .filter(group => group.placeholders.length > 0);
  });

  protected readonly activeGroup = computed(() => {
    const groups = this.visibleGroups();
    return groups.find(group => group.id === this.selectedGroupId())
      ?? groups.find(group => !group.unavailable)
      ?? groups[0];
  });

  protected shortToken(token: string): string {
    return shortPlaceholderToken(token);
  }

  protected usageCount(placeholder: TemplatePlaceholder): number {
    const text = this.templateText();
    return text ? text.split(placeholder.token).length - 1 : 0;
  }

  protected onSearchChange(term: string): void {
    this.searchTerm.set(term);
  }

  protected pick(placeholder: TemplatePlaceholder): void {
    if (this.activeGroup()?.unavailable) {
      return;
    }
    this.lastInserted.set(placeholder.token);
    this.insertPlaceholder.emit(placeholder.token);
  }
}

function matches(placeholder: TemplatePlaceholder, term: string): boolean {
  return placeholder.token.toLowerCase().includes(term) || placeholder.label.toLowerCase().includes(term);
}
