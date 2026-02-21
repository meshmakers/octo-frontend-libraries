import {inject, Injectable} from '@angular/core';
import {CommandItem} from '../models/commandItem';
import {ActivatedRoute} from '@angular/router';

@Injectable()
export class CommandSettingsService {

  private readonly _activatedRoute: ActivatedRoute;

  constructor() {
    this._activatedRoute = inject(ActivatedRoute);
  }

  public get navigateRelativeToRoute() : ActivatedRoute{
    return this._activatedRoute;
  }

  public get commandItems(): CommandItem[] {
    return [];
  }
}
