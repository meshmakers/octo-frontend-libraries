import { Component, Input, OnInit } from '@angular/core';
import { ActivatedRoute, NavigationEnd, PRIMARY_OUTLET, Router } from '@angular/router';
import { Breadcrumb, BreadcrumbService } from '@meshmakers/shared-services';
import { filter, map } from 'rxjs/operators';
import { BreadcrumbData } from "../services/breadcrumbData";

@Component({
  selector: 'mm-breadcrumb',
  templateUrl: './mm-breadcrumb.component.html',
  styleUrl: './mm-breadcrumb.component.css'
})
export class MmBreadcrumbComponent implements OnInit {
  protected breadcrumbData: BreadcrumbData[] = [];
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
        this.breadcrumbData.forEach((breadcrumbData: BreadcrumbData) => {
          const labelParams = breadcrumbData.labelTemplate.match(/[^{{]+(?=}})/g);
          if (labelParams) {
            for (const labelParam of labelParams) {
              if (labelParam === key) {
                breadcrumbData.label = breadcrumbData.labelTemplate.replace('{{' + labelParam + '}}', (value as string));
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
      const breadcrumb = JSON.parse(JSON.stringify(data)) as Breadcrumb[];
      const breadcrumbData = new Array<BreadcrumbData>();
      breadcrumb.forEach((crumb : Breadcrumb) => {
        const breadcrumbDataItem = new BreadcrumbData(crumb.label, crumb.label, crumb.url);
        breadcrumbData.push(breadcrumbDataItem);

        if (breadcrumbDataItem.url) {
          const urlChunks = breadcrumbDataItem.url.split('/');
          for (const chunk of urlChunks) {
            if (chunk.includes(':')) {
              const paramID = chunk.replace(':', '');
              const routerParamID = route.snapshot.params[paramID] as string;
              breadcrumbDataItem.url = crumb.url.replace(`:${paramID}`, routerParamID);
            }
          }
        }

        const labelParams = breadcrumbDataItem.labelTemplate.match(/[^{{]+(?=}})/g);
        if (labelParams) {
          for (const labelParam of labelParams) {
            const routerParamID = decodeURIComponent((route.snapshot.params[labelParam.trim()] as string));
            if (routerParamID) {
              breadcrumbDataItem.label = breadcrumbDataItem.labelTemplate.replace('{{' + labelParam + '}}', routerParamID);
            } else {
              breadcrumbDataItem.label = breadcrumbDataItem.labelTemplate.replace('{{' + labelParam + '}}', '');
            }
          }
        }
      });
      this.breadcrumbData = breadcrumbData;
    } else {
      this.breadcrumbData = [];
    }
  }
}
