import { Component, OnInit, inject } from '@angular/core';
import { AuthorizeService } from '../authorize.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'mm-login-menu',
  standalone: false,
  templateUrl: './login-menu.component.html',
  styleUrls: ['./login-menu.component.css']
})
export class LoginMenuComponent implements OnInit {
  private readonly authorizeService = inject(AuthorizeService);

  public isAuthenticated: Observable<boolean>;
  public userName: Observable<string | null>;

  constructor() {
    this.isAuthenticated = this.authorizeService.getIsAuthenticated();
    this.userName = this.authorizeService.getUser().pipe(map((u) => u?.name ?? null));
  }

  ngOnInit(): void {
    const isIFrame = window.self !== window.top;

    console.log('app-login-menu::created');

    this.isAuthenticated.subscribe((x) => {
      console.log(`isAuthenticated changed to ${x} (iframe ${isIFrame})`);
    });
  }

  public login(): void {
    this.authorizeService.login();
  }

  public logout(): void {
    this.authorizeService.logout();
  }

  public register(): void {}
}
