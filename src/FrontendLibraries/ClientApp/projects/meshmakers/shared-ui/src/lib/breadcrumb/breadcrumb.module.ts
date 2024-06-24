import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MmBreadcrumbComponent } from './mat-breadcrumb/mm-breadcrumb.component';
import { MatListModule } from '@angular/material/list';
import { MatToolbarModule } from '@angular/material/toolbar';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';

@NgModule({
  declarations: [MmBreadcrumbComponent],
  imports: [RouterModule, CommonModule, BrowserAnimationsModule, MatToolbarModule, MatListModule],
  exports: [MmBreadcrumbComponent]
})
export class BreadcrumbModule {}
