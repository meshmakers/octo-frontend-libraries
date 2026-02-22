/**
 * Material Design replacement for legacy mm-breadcrumb from @meshmakers/shared-ui.
 * Uses BreadCrumbService from shared-services.
 */
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { BreadCrumbService, BreadCrumbData } from '@meshmakers/shared-services';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

@Component({
  selector: 'mm-breadcrumb',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (breadcrumbData.length > 0) {
      <nav class="breadcrumb-nav">
        @for (item of breadcrumbData; track item.url; let last = $last) {
          @if (item.url && !last) {
            <a [routerLink]="item.url" class="breadcrumb-link">{{ item.text }}</a>
          } @else {
            <span class="breadcrumb-current">{{ item.text }}</span>
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
}
