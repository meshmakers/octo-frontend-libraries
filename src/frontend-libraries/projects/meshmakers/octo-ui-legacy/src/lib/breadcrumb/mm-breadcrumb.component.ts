/**
 * Material Design replacement for legacy mm-breadcrumb from @meshmakers/shared-ui.
 * Uses BreadCrumbService from shared-services.
 *
 * Supports optional translation via BREADCRUMB_TRANSLATE_FN injection token.
 * If provided, breadcrumb labels are passed through the translate function.
 */
import { Component, inject, InjectionToken, OnDestroy, OnInit } from '@angular/core';
import { BreadCrumbService, BreadCrumbData } from '@meshmakers/shared-services';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

/**
 * Optional injection token for breadcrumb label translation.
 * Provide a function that takes a translation key and returns the translated string.
 * If the key is a dynamic value (e.g. an ID), the function should return it unchanged.
 *
 * Example usage with @ngx-translate:
 * ```
 * providers: [
 *   { provide: BREADCRUMB_TRANSLATE_FN, useFactory: (ts: TranslateService) => (key: string) => ts.instant(key), deps: [TranslateService] }
 * ]
 * ```
 */
export const BREADCRUMB_TRANSLATE_FN = new InjectionToken<(key: string) => string>('BREADCRUMB_TRANSLATE_FN');

@Component({
  selector: 'mm-breadcrumb',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (breadcrumbData.length > 0) {
      <nav class="breadcrumb-nav">
        @for (item of breadcrumbData; track item.url; let last = $last) {
          @if (item.url && !last) {
            <a [routerLink]="item.url" class="breadcrumb-link">{{ translate(item.text) }}</a>
          } @else {
            <span class="breadcrumb-current">{{ translate(item.text) }}</span>
          }
          @if (!last) {
            <span class="breadcrumb-separator"> / </span>
          }
        }
      </nav>
    }
  `,
  styles: [`
    .breadcrumb-nav {
      padding: 8px 16px;
      font-size: 14px;
    }
    .breadcrumb-link {
      color: #0275d8;
      text-decoration: none;
    }
    .breadcrumb-link:hover {
      text-decoration: underline;
    }
    .breadcrumb-current {
      color: #333;
    }
    .breadcrumb-separator {
      color: #999;
      margin: 0 4px;
    }
  `]
})

export class MmBreadcrumbComponent implements OnInit, OnDestroy {
  private readonly breadcrumbService = inject(BreadCrumbService);
  private readonly translateFn = inject(BREADCRUMB_TRANSLATE_FN, { optional: true });
  protected breadcrumbData: BreadCrumbData[] = [];
  private subscription: Subscription | null = null;

  ngOnInit(): void {
    this.subscription = this.breadcrumbService.breadCrumbItems.subscribe(items => {
      this.breadcrumbData = items;
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  protected translate(text: string | undefined): string {
    if (!text) return '';
    return this.translateFn ? this.translateFn(text) : text;
  }
}
