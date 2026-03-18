import { Component, inject, signal } from '@angular/core';
import {ProductService} from './services/product.service';
import {AsyncPipe} from '@angular/common';
import { VERSION } from '../environments/currentVersion';
import {
  DrawerComponent,
  DrawerContainerComponent,
  DrawerContentComponent, DrawerItemExpandedFn,
  DrawerSelectEvent
} from '@progress/kendo-angular-layout';
import {
  menuIcon
} from '@progress/kendo-svg-icons';
import {ButtonComponent} from '@progress/kendo-angular-buttons';
import {
  AppBarComponent,
  AppBarSectionComponent,
  AppBarSpacerComponent,
  BreadCrumbComponent, BreadCrumbItem
} from '@progress/kendo-angular-navigation';
import {SVGIconComponent} from '@progress/kendo-angular-icons';
import {LoginAppBarSectionComponent} from '@meshmakers/shared-auth/login-ui';
import {AuthorizeService} from '@meshmakers/shared-auth';
import {AppTitleService, BreadCrumbData, BreadCrumbService, CommandService, ComponentMenuService} from '@meshmakers/shared-services';
import {ActivatedRoute, NavigationEnd, Router, RouterOutlet} from '@angular/router';
import {MenuComponent, MenuSelectEvent} from '@progress/kendo-angular-menu';
import {DialogContainerDirective, WindowContainerDirective} from '@progress/kendo-angular-dialog';
import {TenantSwitcherComponent} from '@meshmakers/octo-ui';
import {filter} from 'rxjs/operators';

@Component({
  selector: 'app-root',
  imports: [LoginAppBarSectionComponent, TenantSwitcherComponent, AsyncPipe, DrawerContainerComponent, DrawerContentComponent, DrawerComponent, ButtonComponent, AppBarSpacerComponent, AppBarSectionComponent, SVGIconComponent, AppBarComponent, RouterOutlet, MenuComponent, BreadCrumbComponent, DialogContainerDirective, WindowContainerDirective],
  providers: [ProductService],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  private readonly router = inject(Router);
  private readonly appTitleService = inject(AppTitleService);
  private readonly activatedRoute = inject(ActivatedRoute);
  protected readonly authorizeService = inject(AuthorizeService);
  protected readonly commandService = inject(CommandService);
  protected readonly componentMenuService = inject(ComponentMenuService);
  protected readonly breadCrumbService = inject(BreadCrumbService);

  private readonly defaultTitle : string = 'OctoMesh Template App';
  protected title : string = this.defaultTitle;
  protected readonly tenantId = signal<string | null>(null);
  protected expandedIndices: number[] = [];
  protected readonly menuIcon = menuIcon;
  protected readonly version = VERSION.version;

  protected async onSelect(event: DrawerSelectEvent): Promise<void> {

    if (this.expandedIndices.indexOf(event.item.id) >= 0) {
      this.expandedIndices = this.expandedIndices.filter((id) => id !== event.item.id);
    } else {
      this.expandedIndices.push(event.item.id);
    }

    await this.commandService.setSelectedDrawerItem(event.item);

  }

  constructor() {
    this.appTitleService.appTitle.subscribe((title) => {
      this.title = title ?? this.defaultTitle;
    });

    // Extract tenantId from route changes
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.extractTenantId();
    });
  }

  private extractTenantId(): void {
    let route = this.activatedRoute.root;
    while (route.firstChild) {
      route = route.firstChild;
      if (route.snapshot.params['tenantId']) {
        this.tenantId.set(route.snapshot.params['tenantId']);
        return;
      }
    }
    this.tenantId.set(null);
  }

  protected onTenantSelected(tenantId: string): void {
    this.router.navigate(['/', tenantId]);
  }


  protected async onBreadcrumbItemClick(_event: BreadCrumbItem): Promise<void> {

    const data = _event as BreadCrumbData;
    if (data.url) {
      const segments = data.url.split('/');
      await this.router.navigate(segments, {
        relativeTo: this.activatedRoute.firstChild
      });
    }
  }

  protected async onSelectMenuItem(event: MenuSelectEvent) {
    await this.componentMenuService.setSelectedMenuItem(event.item);
  }

  protected isItemExpanded: DrawerItemExpandedFn = (item): boolean => {
    if (item.id) {
      return this.expandedIndices.indexOf(item.id) >= 0;
    }
    return false;
  };
}
