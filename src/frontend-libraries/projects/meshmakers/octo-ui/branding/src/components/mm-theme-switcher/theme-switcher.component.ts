import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import {
  brightnessContrastIcon,
  lightbulbOutlineIcon,
} from '@progress/kendo-svg-icons';
import { BrandingDataSource } from '../../services/branding-data-source.service';
import { ThemeService } from '../../services/theme.service';
import {
  DEFAULT_THEME_SWITCHER_MESSAGES,
  ThemeSwitcherMessages,
} from './theme-switcher.messages';

@Component({
  selector: 'mm-theme-switcher',
  standalone: true,
  imports: [SVGIconModule],
  templateUrl: './theme-switcher.component.html',
  styleUrl: './theme-switcher.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeSwitcherComponent {
  readonly messages = input<ThemeSwitcherMessages>(
    DEFAULT_THEME_SWITCHER_MESSAGES,
  );

  private readonly themeService = inject(ThemeService);
  private readonly branding = inject(BrandingDataSource);

  protected readonly isDark = this.themeService.isDark;
  protected readonly available = computed(
    () => this.branding.branding().darkTheme !== null,
  );
  protected readonly ariaLabel = computed(() => {
    if (!this.available()) return this.messages().unavailable;
    return this.isDark()
      ? this.messages().toggleToLight
      : this.messages().toggleToDark;
  });

  protected readonly lightIcon = lightbulbOutlineIcon;
  protected readonly darkIcon = brightnessContrastIcon;

  protected onToggle(): void {
    if (!this.available()) return;
    this.themeService.setDark(!this.isDark());
  }
}
