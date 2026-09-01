import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ButtonModule } from '@progress/kendo-angular-buttons';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import { brightnessContrastIcon, lightbulbOutlineIcon } from '@progress/kendo-svg-icons';
import { ThemeModeService } from './theme-mode.service';

/**
 * App-bar button that cycles the light/dark mode (system → light → dark).
 * Drop it into a `<kendo-appbar-section>`; it carries no layout of its own.
 */
@Component({
  selector: 'mm-theme-mode-toggle',
  standalone: true,
  imports: [ButtonModule, SVGIconModule],
  template: `
    <button
      kendoButton
      fillMode="flat"
      themeColor="base"
      [svgIcon]="icon()"
      (click)="theme.cycle()"
      [title]="tooltip()"
      [attr.aria-label]="tooltip()">
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    :host { display: inline-flex; align-items: center; }
    button { color: var(--theme-text-secondary); }
    button:hover { color: var(--theme-text-accent); }
  `],
})
export class ThemeModeToggleComponent {
  protected readonly theme = inject(ThemeModeService);

  protected readonly icon = computed(() =>
    this.theme.resolved() === 'light' ? lightbulbOutlineIcon : brightnessContrastIcon
  );

  protected readonly tooltip = computed(() => {
    const pref = this.theme.preference();
    const resolved = this.theme.resolved();
    if (pref === 'system') {
      return `Theme: System (${resolved}) — click to force light`;
    }
    if (pref === 'light') {
      return 'Theme: Light — click to force dark';
    }
    return 'Theme: Dark — click to follow system';
  });
}
