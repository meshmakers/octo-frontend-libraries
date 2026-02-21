/*
 * Public API Surface of shared-services
 */
import {CommandOptions} from './lib/options/commandOptions';
import {EnvironmentProviders, makeEnvironmentProviders} from '@angular/core';
import {CommandSettingsService} from './lib/services/command-settings.service';
import {CommandService} from './lib/services/command.service';
import {MessageService} from './lib/services/message.service';
import {ComponentMenuService} from './lib/services/component-menu.service';
import {BreadCrumbService} from './lib/services/bread-crumb.service';
import {AppTitleService} from './lib/services/app-title.service';
import {MmHttpErrorInterceptor} from './lib/shared/mm-http-error-interceptor.service';

export * from './lib/services/app-title.service';
export * from './lib/services/message.service';
export * from './lib/services/command.service';
export * from './lib/services/command-base.service';
export * from './lib/services/bread-crumb.service';
export * from './lib/services/command-settings.service';
export * from './lib/services/component-menu.service';
export * from './lib/models/notification-message';
export * from './lib/models/commandItem';
export * from './lib/models/breadCrumbData';
export * from './lib/models/breadCrumbRouteItem';
export * from './lib/models/pagedResultDto';
export * from './lib/models/treeItemData';
export * from './lib/options/commandOptions';
export * from './lib/shared/mm-http-error-interceptor.service';
export * from './lib/data-sources/entity-select-data-source';

// Backward-compatible re-exports for legacy libraries (shared-ui, octo-services)
// that import these from @meshmakers/shared-services
export {BreadCrumbService as BreadcrumbService} from './lib/services/bread-crumb.service';
export * from './lib/compat/data-source-base';
export * from './lib/compat/iso-date-time';
export * from './lib/compat/qr-code-scanner.service';
export * from './lib/compat/error-message';
export * from './lib/compat/auto-complete-data-source';

export function provideMmSharedServices(commandOptions?: CommandOptions): EnvironmentProviders {
  return makeEnvironmentProviders([
    MessageService,
    CommandService,
    CommandSettingsService,
    ComponentMenuService,
    AppTitleService,
    MmHttpErrorInterceptor,
    BreadCrumbService,
    {
      provide: CommandOptions,
      useValue: commandOptions
    }
  ]);
}
