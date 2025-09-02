import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { ErrorDemoComponent } from './error-demo/error-demo.component';
import { TableDemoComponent } from './table-demo/table-demo.component';
import { FileUploadDemoComponent } from './file-upload-demo/file-upload-demo.component';
import { NfcDemoComponent } from './nfc-demo/nfc-demo.component';
import { QrDemoComponent } from './qr-demo/qr-demo.component';

const routes: Routes = [
  { path: 'home', component: HomeComponent },
  { path: 'error-demo', component: ErrorDemoComponent },
  { path: 'table-demo', component: TableDemoComponent },
  { path: 'file-upload-demo', component: FileUploadDemoComponent },
  { path: 'nfc-demo', component: NfcDemoComponent },
  { path: 'qr-demo', component: QrDemoComponent },
  { path: '', redirectTo: '/home', pathMatch: 'full' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
