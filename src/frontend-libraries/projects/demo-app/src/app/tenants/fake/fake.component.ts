import { Component, OnInit, inject } from '@angular/core';
import {ActivatedRoute, NavigationEnd, Router} from '@angular/router';
import {filter} from 'rxjs/operators';
import {BreadCrumbService} from '@meshmakers/shared-services';

@Component({
  selector: 'app-fake',
  imports: [],
  templateUrl: './fake.component.html',
  styleUrl: './fake.component.scss'
})
export class FakeComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly breadCrumbService = inject(BreadCrumbService);


  protected uri: string;

  constructor() {
    this.uri = '';
  }

  async ngOnInit() : Promise<void> {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.uri = this.createRouteString(this.activatedRoute.root);
      });

    this.uri = this.createRouteString(this.activatedRoute.root);

    await this.breadCrumbService.updateBreadcrumbLabels({ queryName: "demo" });
  }

  private createRouteString(route: ActivatedRoute, path = ''): string {
    const children = route.children;

    for (const child of children) {

      const routeURL: string = child.snapshot.url.map(segment => segment.path).join('/');
      if (routeURL) {
        path += `/${routeURL}`;
      }

      return this.createRouteString(child, path);
    }

    return path;
  }

}
