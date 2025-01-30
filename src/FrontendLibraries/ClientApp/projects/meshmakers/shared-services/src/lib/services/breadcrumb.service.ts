import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {Breadcrumb} from "../models/breadcrumb";

@Injectable({
  providedIn: 'root'
})
export class BreadcrumbService {
  private readonly _breadcrumbLabels: BehaviorSubject<any>;
  private readonly _newBreadcrumb: BehaviorSubject<Breadcrumb[]>;

  constructor() {
    this._breadcrumbLabels = new BehaviorSubject<any>([]);
    this._newBreadcrumb = new BehaviorSubject<Breadcrumb[]>([]);
  }

  public get breadcrumbLabels() : BehaviorSubject<any> {
    return this._breadcrumbLabels;
  }

  public get newBreadcrumb() : BehaviorSubject<Breadcrumb[]> {
    return this._newBreadcrumb;
  }

  public updateBreadcrumbLabels(labels: any): void {
    this.breadcrumbLabels.next(labels);
  }

  public updateBreadcrumb(newBreadcrumb: Breadcrumb[]): void {
    this.newBreadcrumb.next(newBreadcrumb);
  }
}
