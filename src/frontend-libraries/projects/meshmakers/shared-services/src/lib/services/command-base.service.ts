import {CommandSettingsService} from './command-settings.service';
import {CommandItem} from '../models/commandItem';
import {Router} from '@angular/router';

export abstract class CommandBaseService {

  protected constructor(protected readonly commandSettingsService: CommandSettingsService, private readonly router: Router) {
  }

  protected async navigateAsync(commandItem: CommandItem, data?: unknown): Promise<void> {

    console.debug('navigateAsync', commandItem);
    const hrefUri = await CommandBaseService.getHref(commandItem, data);
    const link = await CommandBaseService.getLink(commandItem, data);
    if (hrefUri) {
      window.open(hrefUri, commandItem.target ?? "_blank");
    } else if (link) {

      await this.router.navigate([link], {
        relativeTo: this.commandSettingsService.navigateRelativeToRoute
      });
    } else if (commandItem.onClick) {
      await CommandBaseService.executeClickEvent(commandItem, data);
    } else {
      console.debug('navigateAsync', 'no href or link');
    }
  }

  static getIsVisibleSync(commandItem: CommandItem, data?: unknown): boolean {
    if (commandItem.isVisible !== undefined) {
      if (typeof commandItem.isVisible === 'boolean') {
        return commandItem.isVisible;
      } else if (typeof commandItem.isVisible === 'function') {
        const result = commandItem.isVisible(data);
        if (result instanceof Promise) {
          return true;
        }
        return result;
      }
    }
    return true;
  }

  protected static async getIsVisible(commandItem: CommandItem): Promise<boolean> {
    if (commandItem.isVisible !== undefined) {
      if (typeof commandItem.isVisible === 'boolean') {
        return commandItem.isVisible;
      } else if (typeof commandItem.isVisible === 'function') {
        return await commandItem.isVisible();
      }
    }
    return true;
  }

  protected static getIsDisabled(commandItem: CommandItem, data?: unknown): boolean {
    if (commandItem.isDisabled !== undefined) {
      if (typeof commandItem.isDisabled === 'boolean') {
        return commandItem.isDisabled;
      } else if (typeof commandItem.isDisabled === 'function') {
        return commandItem.isDisabled(data);
      }
    }
    return false;
  }

  private static async getLink(commandItem: CommandItem, data?: unknown): Promise<string | null> {
    if (commandItem.link !== undefined) {
      if (typeof commandItem.link === 'string') {
        return CommandBaseService.interpolateString(commandItem.link, data);
      } else if (typeof commandItem.link === 'function') {
        return CommandBaseService.interpolateString(await commandItem.link({commandItem, data}), data);
      }
    }
    return null;
  }

  private static async getHref(commandItem: CommandItem, data?: unknown): Promise<string | null> {
    if (commandItem.href !== undefined) {
      if (typeof commandItem.href === 'string') {
        return CommandBaseService.interpolateString(commandItem.href, data);
      } else if (typeof commandItem.href === 'function') {
        return CommandBaseService.interpolateString(await commandItem.href({commandItem, data}), data);
      }
    }
    return null;
  }


  private static async executeClickEvent(commandItem: CommandItem, data?: unknown): Promise<void> {
    if (commandItem.onClick !== undefined) {
      return await commandItem.onClick({commandItem, data});
    }
  }

  private static interpolateString(template: string | null, data?: unknown): string | null {
    return template?.replace(/{{\s*(\w+)\s*}}/g, (match, propName: string) => {
      if (data && typeof data === 'object' && propName in data) {
        return String((data as Record<string, unknown>)[propName]);
      }
      return match;
    }) ?? null;
  }
}
