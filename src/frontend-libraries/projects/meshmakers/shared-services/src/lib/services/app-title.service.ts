import { Injectable } from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';

@Injectable()
export class AppTitleService {
  private readonly _appTitle: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);

  public setTitle(title: string): void {
    this._appTitle.next(title);
  }

  public getTitle(): string | null {
    return this._appTitle.value;
  }

  public get appTitle(): Observable<string | null> {
    return this._appTitle.asObservable();
  }
}
