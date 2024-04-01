import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatBreadcrumbComponent } from './mat-breadcrumb/mat-breadcrumb.component';
import { MatListModule } from '@angular/material/list';
import { MatToolbarModule } from '@angular/material/toolbar';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';

@NgModule({
  declarations: [MatBreadcrumbComponent],
  imports: [RouterModule, CommonModule, BrowserAnimationsModule, MatToolbarModule, MatListModule],
  exports: [MatBreadcrumbComponent]
})
export class BreadcrumbModule {}
