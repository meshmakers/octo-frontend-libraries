import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';

import { LoginMenuComponent } from './login-menu.component';
import { AuthorizeService } from '../authorize.service';

describe('LoginMenuComponent', () => {
  let component: LoginMenuComponent;
  let fixture: ComponentFixture<LoginMenuComponent>;

  const mockAuthorizeService = {
    isAuthenticated: of(false),
    user: of(null),
    login: jasmine.createSpy('login'),
    logout: jasmine.createSpy('logout')
  };

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [LoginMenuComponent],
      providers: [
        { provide: AuthorizeService, useValue: mockAuthorizeService }
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(LoginMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
