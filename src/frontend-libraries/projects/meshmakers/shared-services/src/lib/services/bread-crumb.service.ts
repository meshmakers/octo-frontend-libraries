import { Injectable, inject } from '@angular/core';
import {BehaviorSubject, firstValueFrom, Observable} from 'rxjs';
import {ActivatedRoute, NavigationEnd, Router} from '@angular/router';
import {filter} from 'rxjs/operators';
import {BreadCrumbData} from '../models/breadCrumbData';
import {BreadCrumbRouteItem} from '../models/breadCrumbRouteItem';

@Injectable()
export class BreadCrumbService {
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly _breadCrumbItems: BehaviorSubject<BreadCrumbData[]> = new BehaviorSubject<BreadCrumbData[]>([]);

  constructor() {

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this._breadCrumbItems.next(this.createBreadCrumbs(this.activatedRoute.root));
      });
    this._breadCrumbItems.next(this.createBreadCrumbs(this.activatedRoute.root));
  }

  private createBreadCrumbs(route: ActivatedRoute, path: BreadCrumbData[] = [], lastBreadcrumbRef?: BreadCrumbRouteItem[]): BreadCrumbData[] {
    const children = route.children;

    for (const child of children) {

      const breadCrumbRouteItems: BreadCrumbRouteItem[] = child.snapshot.data['breadcrumb'];
      // Skip inherited breadcrumb data (Angular passes parent route data to children by reference)
      if (breadCrumbRouteItems && breadCrumbRouteItems !== lastBreadcrumbRef) {

        for (const breadCrumbRouteItem of breadCrumbRouteItems) {

          if (!breadCrumbRouteItem.label) {
            console.warn(`BreadCrumbService: breadcrumb item is missing a 'label' property on route '${child.snapshot.url.map(s => s.path).join('/')}'. Skipping item.`);
            continue;
          }

          let label = breadCrumbRouteItem.label;
          let url = breadCrumbRouteItem.url ?? '';

          if (breadCrumbRouteItem.url === undefined || breadCrumbRouteItem.url === null) {
            console.warn(`BreadCrumbService: breadcrumb item '${label}' is missing a 'url' property on route '${child.snapshot.url.map(s => s.path).join('/')}'. ` +
              `Add 'url' to the breadcrumb route data, e.g. { label: '${label}', url: '${child.snapshot.url.map(s => s.path).join('/')}' }.`);
          }

          // We replace the route parameters with the actual values
          // Match all :paramName patterns in the URL
          const paramMatches = url.match(/:([a-zA-Z0-9_]+)/g);
          if (paramMatches) {
            for (const match of paramMatches) {
              const paramName = match.substring(1); // Remove leading ':'
              const paramValue = child.snapshot.params[paramName] as string;
              if (paramValue) {
                url = url.replace(match, paramValue);
              }
            }
          }

          // We replace the label parameters with the actual values from route (use updateBreadcrumbLabels to update the labels with data)
          // noinspection RegExpDuplicateCharacterInClass
          const labelParams = label.match(/[^{{]+(?=}})/g);
          if (labelParams) {
            for (const labelParam of labelParams) {
              const routerParamID = child.snapshot.params[labelParam] as string;
              if (routerParamID) {
                label = label.replace('{{' + labelParam + '}}', routerParamID);
              }
            }
          }

          path.push({
            text: label,
            title: label,
            labelTemplate: breadCrumbRouteItem.label,
            svgIcon: breadCrumbRouteItem.svgIcon,
            url: url
          });
        }
      }

      return this.createBreadCrumbs(child, path, breadCrumbRouteItems ?? lastBreadcrumbRef);
    }

    return path;
  }

  /*
    * This method updates the breadcrumb labels with the data passed in the parameter. Parameters are passed in the label as {{paramName}}
   */
  // noinspection JSUnusedGlobalSymbols
  public async updateBreadcrumbLabels(data: Record<string, string>): Promise<void> {

    const list = await firstValueFrom(this._breadCrumbItems);
    for (const breadCrumbDataItem of list) {
      // noinspection RegExpDuplicateCharacterInClass
      const labelParams = breadCrumbDataItem.labelTemplate.match(/[^{{]+(?=}})/g);
      if (labelParams) {
        for (const labelParam of labelParams) {

          const value = data[labelParam];
          if (!value) {
            continue;
          }
          breadCrumbDataItem.title = breadCrumbDataItem.labelTemplate.replace('{{' + labelParam + '}}', data[labelParam]);
          breadCrumbDataItem.text = breadCrumbDataItem.title;
        }
      }
    }
    // Re-emit to notify subscribers (e.g. translated breadcrumb pipes)
    this._breadCrumbItems.next(list);
  }

  // noinspection JSUnusedGlobalSymbols
  public get breadCrumbItems(): Observable<BreadCrumbData[]> {
    return this._breadCrumbItems;
  }

}
