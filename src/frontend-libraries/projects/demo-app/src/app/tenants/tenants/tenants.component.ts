import {Component, ChangeDetectionStrategy} from '@angular/core';
import {ListViewComponent} from '@meshmakers/shared-ui';
import {TenantsDataSourceDirective} from '../data-sources/tenants-data-source.directive';

@Component({
  selector: 'app-tenants',
  imports: [
    ListViewComponent,
    TenantsDataSourceDirective,
  ],
  templateUrl: './tenants.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './tenants.component.scss'
})
export class TenantsComponent {


}
