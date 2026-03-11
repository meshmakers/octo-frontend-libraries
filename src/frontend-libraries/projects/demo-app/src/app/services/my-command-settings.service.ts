import { Injectable, inject } from '@angular/core';
import {CommandItem, CommandSettingsService} from '@meshmakers/shared-services';
import {
  account_tree,
  article,
  category,
  chat,
  checklist,
  dashboard, event_list, graphic_eq, more_time, page_info,
  person_search,
  playlist_add_check,
  query_builder,
  schedule_send,
  settings,
  sort,
  storage,
  tenancy, text_snippet, travel_explore
} from '../custom-svg-icons';
import {ActivatedRoute} from '@angular/router';
import {CONFIGURATION_SERVICE} from '@meshmakers/octo-services';
import {firstValueFrom} from 'rxjs';
import {AuthorizeService, Roles} from '@meshmakers/shared-auth';
import {TenantService} from './tenant.service';

@Injectable({
  providedIn: 'root'
})
export class MyCommandSettingsService extends CommandSettingsService {
  private readonly configurationService = inject(CONFIGURATION_SERVICE);
  private readonly tenantService = inject(TenantService);
  private readonly authorizeService = inject(AuthorizeService);
  private readonly activatedRoute: ActivatedRoute;
  private readonly _commandItems: CommandItem[];

  constructor() {

    super();
    this.activatedRoute = inject(ActivatedRoute);

    this._commandItems = [
      {
        id: "cockpit",
        type: "link",
        text: "Cockpit",
        svgIcon: dashboard,
        link: async () => `/${await this.getCurrentTenantId()}`
      },
      {
        id: "tenants",
        type: "link",
        text: "Tenants",
        svgIcon: tenancy,
        isVisible: async () => await this.isSystemTenant() && await this.isSystemTenant(),
        link: async () => `/${await this.getCurrentTenantId()}/tenants`
      },
      {
        id: "list-view",
        type: "section",
        text: "List View",
        svgIcon: event_list,
        link: async () => `/${await this.getCurrentTenantId()}/list-view`
      },
      {
        id: "meshboard",
        type: "section",
        text: "MeshBoard",
        svgIcon: graphic_eq,
        link: async () => `/${await this.getCurrentTenantId()}/meshboard`
      },
      {
        id: "process-designer",
        type: "link",
        text: "Process Designer",
        svgIcon: settings,
        link: async () => `/${await this.getCurrentTenantId()}/process-designer`
      },
      {
        id: "symbol-library",
        type: "link",
        text: "Symbol Library",
        svgIcon: category,
        link: async () => `/${await this.getCurrentTenantId()}/symbol-library`
      },
      {
        id: "demos",
        type: "section",
        text: "Demos",
        svgIcon: storage,
        children: [
          {
            id: "repository-dialogs",
            type: "link",
            svgIcon: account_tree,
            link: "demos/dialogs",
            text: "Dialogs"
          },
          {
            id: "demos-tree",
            type: "link",
            svgIcon: travel_explore,
            link: "demos/tree",
            text: "Tree"
          },
          {
            id: "demos-property-grid",
            type: "link",
            svgIcon: page_info,
            link: "demos/property-grid",
            text: "Property Grid"
          },
          {
            id: "demos-attribute-selector",
            type: "link",
            svgIcon: checklist,
            link: "demos/attribute-selector",
            text: "Attribute Selector"
          },
          {
            id: "demos-attribute-sort-selector",
            type: "link",
            svgIcon: sort,
            link: "demos/attribute-sort-selector",
            text: "Attribute Sort Selector"
          },
          {
            id: "demos-entity-select",
            type: "link",
            svgIcon: person_search,
            link: "demos/entity-select",
            text: "Entity Selector"
          },
          {
            id: "demos-ck-type-selector",
            type: "link",
            svgIcon: category,
            link: "demos/ck-type-selector",
            text: "CkType Selector"
          },
          {
            id: "demos-messages",
            type: "link",
            svgIcon: chat,
            link: "demos/message",
            text: "Messages"
          },
          {
            id: "demos-multiselect",
            type: "link",
            svgIcon: playlist_add_check,
            link: "demos/multiselect",
            text: "MultiSelect"
          },
          {
            id: "demos-form",
            type: "link",
            svgIcon: article,
            link: "demos/form",
            text: "Form"
          },
          {
            id: "demos-field-filter-editor",
            type: "link",
            svgIcon: query_builder,
            link: "demos/field-filter-editor",
            text: "Field Filter Editor"
          },
          {
            id: "demos-time-range-picker",
            type: "link",
            svgIcon: more_time,
            link: "demos/time-range-picker",
            text: "Time Range Picker"
          },
          {
            id: "demos-cron-builder",
            type: "link",
            svgIcon: schedule_send,
            link: "demos/cron-builder",
            text: "Cron Builder"
          },
          {
            id: "demos-copyable-text",
            type: "link",
            svgIcon: text_snippet,
            link: "demos/copyable-text",
            text: "Copyable Text"
          },
          {id: "sep1", type: "separator"},
          {
            id: "demos-graphql-editor",
            type: "link",
            svgIcon: graphic_eq,
            href: async () => `${this.getAssetServicesUri()}tenants/${await this.getCurrentTenantId()}/graphql/playground`,
            target: "_blank",
            text: "GraphQL Editor"
          }
        ]
      },
    ]
  }

  public override get commandItems(): CommandItem[] {
    return this._commandItems;
  }

  public override get navigateRelativeToRoute(): ActivatedRoute {
    return this.activatedRoute.firstChild ?? this.activatedRoute;
  }

  private async getCurrentTenantId(): Promise<string> {
    if (this.activatedRoute.firstChild) {
      const params = await firstValueFrom(this.activatedRoute.firstChild.params);
      const tenantId = params['tenantId'] as string;

      if (tenantId) {
        return tenantId;
      }
    }
    return this.configurationService.config.systemTenantId;
  }

  private getIssuerUri(): string {
    return this.configurationService.config.issuer;
  }

  private getBotServicesUri(): string {
    return this.configurationService.config.botServices;
  }

  private getAssetServicesUri(): string {
    return this.configurationService.config.assetServices;
  }

  private getCommunicationServicesUri(): string {
    return this.configurationService.config.communicationServices;
  }

  private getGraphqlUri(): string {
    return this.configurationService.config.grafanaUrl;
  }

  private getCrateDbAdminUrl(): string {
    return this.configurationService.config.crateDbAdminUrl;
  }

  private async isSystemTenant(): Promise<boolean> {
    const tenantId = await this.getCurrentTenantId();
    return tenantId === this.configurationService.config.systemTenantId;
  }

  private isInRole(role: Roles): boolean {
    return this.authorizeService.isInRole(role);
  }

  private async isModelAvailable(modelName: string): Promise<boolean> {
    return await this.tenantService.isModelAvailable(modelName);
  }

}
