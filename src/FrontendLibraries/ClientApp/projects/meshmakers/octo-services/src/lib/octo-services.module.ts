import { ModuleWithProviders, NgModule } from '@angular/core';
import { OctoServiceOptions } from './options/octo-service-options';
import { OctoErrorLink } from "./shared/octo-error-link";

@NgModule({
  declarations: [],
  imports: [],
  exports: []
})
export class OctoServicesModule {
  static forRoot(octoServiceOptions: OctoServiceOptions): ModuleWithProviders<OctoServicesModule> {
    return {
      ngModule: OctoServicesModule,
      providers: [
        {
          provide: OctoServiceOptions,
          useValue: octoServiceOptions
        },
        OctoErrorLink
      ]
    };
  }
}
