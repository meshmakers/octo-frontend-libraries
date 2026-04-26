import {CommandOptions} from '../options/commandOptions';
import {BehaviorSubject, Observable} from 'rxjs';
import { Injectable, inject } from '@angular/core';
import {DrawerItem} from '@progress/kendo-angular-layout';
import {CommandItem} from '../models/commandItem';
import {Router} from '@angular/router';
import {CommandSettingsService} from './command-settings.service';
import {CommandBaseService} from './command-base.service';

@Injectable()
export class CommandService extends CommandBaseService {
  private readonly options = inject(CommandOptions);


  private readonly _drawerItems: BehaviorSubject<DrawerItem[]> = new BehaviorSubject<DrawerItem[]>([]);
  private readonly _commandsMap: Map<string, CommandItem> = new Map<string, CommandItem>();

  // noinspection JSUnusedLocalSymbols
  constructor() {
    const router = inject(Router);
    const commandSettingsService = inject(CommandSettingsService);

    super(commandSettingsService, router);
  }

  // noinspection JSUnusedGlobalSymbols
  public async initialize(): Promise<void> {
    const items = new Array<DrawerItem>();

    const commandItems = this.commandSettingsService.commandItems;
    await this.createDrawerItems(commandItems, items, null);

    this._drawerItems.next(items);
  }

  private async createDrawerItems(
    commandItems: CommandItem[],
    items: DrawerItem[],
    parentId: string | null,
    depth = 0,
  ) {
    for (const commandItem of commandItems) {
      const visible = await CommandBaseService.getIsVisible(commandItem);

      if (!visible) {
        continue;
      }

      const hierarchyClass = `mm-drawer-level-${depth}`;

      if (commandItem.type === 'separator') {
        items.push({
          id: commandItem.id,
          parentId: parentId ?? undefined,
          separator: true,
          cssClass: hierarchyClass
        });
      } else {
        items.push({
          id: commandItem.id,
          parentId: parentId ?? undefined,
          text: commandItem.text,
          selected: commandItem.selected,
          svgIcon: commandItem.svgIcon,
          cssClass: hierarchyClass
        });

        if (commandItem.children) {
          await this.createDrawerItems(commandItem.children, items, commandItem.id, depth + 1);
        }
        this._commandsMap.set(commandItem.id, commandItem);
      }
    }
  }



  // noinspection JSUnusedGlobalSymbols
  public get drawerItems(): Observable<DrawerItem[]> {
    return this._drawerItems;
  }

  // noinspection JSUnusedGlobalSymbols
  public async setSelectedDrawerItem(value: DrawerItem): Promise<void> {
    console.debug('setSelectedDrawerItem', value);

    if (typeof value.id !== "string") {
      return;
    }
    const commandItem = this._commandsMap.get(value.id);

    if (commandItem === undefined) {
      return;
    }
    await this.navigateAsync(commandItem);
  }
}


