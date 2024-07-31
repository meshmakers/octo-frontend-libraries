import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {Breadcrumb} from "../models/breadcrumb";

@Injectable({
  providedIn: 'root'
})
export class BreadcrumbService {
  public breadcrumbLabels: BehaviorSubject<any> = new BehaviorSubject<any>([]);

  public newBreadcrumb: BehaviorSubject<Breadcrumb[]> = new BehaviorSubject<Breadcrumb[]>([]);

  updateBreadcrumbLabels(labels: any): void {
    this.breadcrumbLabels.next(labels);
  }

  updateBreadcrumb(newBreadcrumb: Breadcrumb[]): void {
    this.newBreadcrumb.next(newBreadcrumb);
  }
}
