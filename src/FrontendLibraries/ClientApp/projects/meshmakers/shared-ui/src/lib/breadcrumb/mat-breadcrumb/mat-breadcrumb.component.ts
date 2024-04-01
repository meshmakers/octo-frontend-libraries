import { Component, Input, OnInit } from '@angular/core';
import { Breadcrumb } from '../model/breadcrumb';
import { ActivatedRoute, NavigationEnd, PRIMARY_OUTLET, Router } from '@angular/router';
import { BreadcrumbService } from '../services/breadcrumb.service';
import { filter, map } from 'rxjs/operators';

@Component({
  selector: 'ia-mat-breadcrumb',
  templateUrl: './mat-breadcrumb.component.html',
  styleUrl: './mat-breadcrumb.component.css'
})
export class MatBreadcrumbComponent implements OnInit {
  breadcrumb: Breadcrumb[] = [];
  @Input() fontSize = '18px';
  @Input() fontColor = '#0275d8';
  @Input() lastLinkColor = '#000';
  @Input() symbol = ' / ';

  constructor(
    private readonly activatedRoute: ActivatedRoute,
    private readonly router: Router,
    private readonly breadcrumbService: BreadcrumbService
  ) {
    this.breadCrumbData();
  }

  ngOnInit(): void {
    this.breadcrumbService.breadcrumbLabels.subscribe((labelData: object) => {
      Object.entries(labelData).forEach(([key, value]) => {
        this.breadcrumb.forEach((crumb) => {
          const labelParams = crumb.label.match(/[^{{]+(?=}})/g);
          if (labelParams) {
            for (const labelParam of labelParams) {
              if (labelParam === key) {
                crumb.label = crumb.label.replace('{{' + labelParam + '}}', <string>value);
              }
            }
          }
        });
      });
    });

    this.breadcrumbService.newBreadcrumb.subscribe((breadcrumb: Breadcrumb[]) => {
      if (breadcrumb.length > 0) {
        this.updateData(this.activatedRoute, breadcrumb);
      }
    });
  }

  breadCrumbData(): void {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .pipe(map(() => this.activatedRoute))
      .pipe(
        map((route) => {
          while (route.firstChild) {
            route = route.firstChild;
          }
          return route;
        })
      )
      .pipe(filter((route) => route.outlet === PRIMARY_OUTLET))
      .subscribe((route) => {
        this.updateData(route, null);
      });
  }

  private updateData(route: ActivatedRoute, newBreadcrumb: Breadcrumb[] | null): void {
    if (route.snapshot.data['breadcrumb'] || newBreadcrumb) {
      const data = route.snapshot.data['breadcrumb'] ? route.snapshot.data['breadcrumb'] : newBreadcrumb;
      const breadcrumb = <Breadcrumb[]>JSON.parse(JSON.stringify(data));
      breadcrumb.forEach((crumb) => {
        if (crumb.url) {
          const urlChunks = crumb.url.split('/');
          for (const chunk of urlChunks) {
            if (chunk.includes(':')) {
              const paramID = chunk.replace(':', '');
              const routerParamID = <string>route.snapshot.params[paramID];
              crumb.url = crumb.url.replace(`:${paramID}`, routerParamID);
            }
          }
        }

        const labelParams = crumb.label.match(/[^{{]+(?=}})/g);
        if (labelParams) {
          for (const labelParam of labelParams) {
            const routerParamID = <string>route.snapshot.params[labelParam.trim()];
            if (routerParamID) {
              crumb.label = crumb.label.replace('{{' + labelParam + '}}', routerParamID);
            } else {
              // crumb.label = crumb.label.replace('{{' + labelParam + '}}', '');
            }
          }
        }
      });
      this.breadcrumb = breadcrumb;
    } else {
      this.breadcrumb = [];
    }
  }
}
