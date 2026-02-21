import { Injectable, inject } from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';
import {MenuItem} from '@progress/kendo-angular-menu';
import {CommandItem} from '../models/commandItem';
import {ActivatedRoute, NavigationEnd, Router} from '@angular/router';
import {filter} from 'rxjs/operators';
import {CommandSettingsService} from './command-settings.service';
import {CommandBaseService} from './command-base.service';

@Injectable()
export class ComponentMenuService extends CommandBaseService {
  private readonly activatedRoute = inject(ActivatedRoute);


  private readonly _menuItems: BehaviorSubject<MenuItem[]> = new BehaviorSubject<MenuItem[]>([]);

  constructor() {
    const commandSettingsService = inject(CommandSettingsService);
    const router = inject(Router);


    super(commandSettingsService, router);

    router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this._menuItems.next(this.createNavigationMenu(this.activatedRoute.root));
      });

    this._menuItems.next(this.createNavigationMenu(this.activatedRoute.root));
  }

  // noinspection JSUnusedGlobalSymbols
  public get menuItems(): Observable<MenuItem[]> {
    return this._menuItems;
  }

  private createNavigationMenu(route: ActivatedRoute, path: MenuItem[] = []): MenuItem[] {
    const children = route.children;

    for (const child of children) {

      const commandItems: CommandItem[] = child.snapshot.data['navigationMenu'];
      if (commandItems) {

        path.push(...this.buildMenuItems(commandItems, child));
      }

      return this.createNavigationMenu(child, path);
    }

    return path;
  }

  // noinspection JSUnusedGlobalSymbols
  public async setSelectedMenuItem(value: MenuItem): Promise<void> {
    console.debug('setSelectedMenuItem', value);

    const commandItem = value.data as CommandItem;
    if (!commandItem) {
      return;
    }
    await this.navigateAsync(commandItem);
  }

  private buildMenuItems(commandItems: CommandItem[], activatedRoute: ActivatedRoute): MenuItem[] {

    const items = new Array<MenuItem>();

    for (const commandItem of commandItems) {

      if (commandItem.type === 'separator') {
        items.push({separator: true});
      } else {

        let childMenuItems: MenuItem[] | undefined = undefined;
        if (commandItem.children) {
          childMenuItems = this.buildMenuItems(commandItem.children, activatedRoute)
        }

        let label = commandItem.text;
        if (label) {
          // We replace the label parameters with the actual values from route (use updateBreadcrumbLabels to update the labels with data)
          // noinspection RegExpDuplicateCharacterInClass
          const labelParams = label.match(/[^{{]+(?=}})/g);
          if (labelParams) {
            for (const labelParam of labelParams) {
              const routerParamID = activatedRoute.snapshot.params[labelParam] as string;
              if (routerParamID) {
                label = label.replace('{{' + labelParam + '}}', routerParamID);
              }
            }
          }
        }

        items.push({
          text: label,
          svgIcon: commandItem.svgIcon,
          data: commandItem,
          items: childMenuItems
        });
      }
    }

    return items;
  }
}
