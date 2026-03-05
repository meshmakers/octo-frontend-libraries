import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { ErrorDemoComponent } from './error-demo/error-demo.component';
import { TableDemoComponent } from './table-demo/table-demo.component';
import { FileUploadDemoComponent } from './file-upload-demo/file-upload-demo.component';
import { ConfirmationDemoComponent } from './confirmation-demo/confirmation-demo.component';
import { ProgressDemoComponent } from './progress-demo/progress-demo.component';
import { DetailsDemoComponent } from './details-demo/details-demo.component';
import { EntitySelectDemoComponent } from './entity-select-demo/entity-select-demo.component';

const routes: Routes = [
  {
    path: 'home',
    component: HomeComponent,
    data: { breadcrumb: [{ label: 'Home', url: '/home' }] }
  },
  {
    path: 'confirmation-demo',
    component: ConfirmationDemoComponent,
    data: { breadcrumb: [{ label: 'Home', url: '/home' }, { label: 'Confirmation Dialogs', url: '/confirmation-demo' }] }
  },
  {
    path: 'progress-demo',
    component: ProgressDemoComponent,
    data: { breadcrumb: [{ label: 'Home', url: '/home' }, { label: 'Progress Windows', url: '/progress-demo' }] }
  },
  {
    path: 'details-demo',
    component: DetailsDemoComponent,
    data: { breadcrumb: [{ label: 'Home', url: '/home' }, { label: 'Details & Validation', url: '/details-demo' }] }
  },
  {
    path: 'table-demo',
    component: TableDemoComponent,
    data: { breadcrumb: [{ label: 'Home', url: '/home' }, { label: 'Data Table', url: '/table-demo' }] }
  },
  {
    path: 'entity-select-demo',
    component: EntitySelectDemoComponent,
    data: { breadcrumb: [{ label: 'Home', url: '/home' }, { label: 'Entity Select', url: '/entity-select-demo' }] }
  },
  {
    path: 'error-demo',
    component: ErrorDemoComponent,
    data: { breadcrumb: [{ label: 'Home', url: '/home' }, { label: 'Error Notifications', url: '/error-demo' }] }
  },
  {
    path: 'file-upload-demo',
    component: FileUploadDemoComponent,
    data: { breadcrumb: [{ label: 'Home', url: '/home' }, { label: 'File Upload', url: '/file-upload-demo' }] }
  },
  { path: '', redirectTo: '/home', pathMatch: 'full' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
