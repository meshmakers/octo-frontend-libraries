import { Component, OnInit } from '@angular/core';
import { AuthorizeService } from '../authorize.service';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-login-menu',
  templateUrl: './login-menu.component.html',
  styleUrls: ['./login-menu.component.css']
})
export class LoginMenuComponent implements OnInit {
  public isAuthenticated: BehaviorSubject<boolean>;
  public userName: Observable<string | null>;
  public isAdmin: Observable<boolean>;

  constructor(private readonly authorizeService: AuthorizeService) {
    this.isAuthenticated = this.authorizeService.getIsAuthenticated();
    this.userName = this.authorizeService.getUser().pipe(map((u) => u?.name ?? null));
    this.isAdmin = this.authorizeService.getIsAdmin();
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
