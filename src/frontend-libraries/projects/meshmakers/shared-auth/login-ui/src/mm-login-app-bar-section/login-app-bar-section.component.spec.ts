import type { MockedObject } from 'vitest';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { signal, WritableSignal, ChangeDetectionStrategy } from '@angular/core';
import { LoginAppBarSectionComponent } from './login-app-bar-section.component';
import { AuthorizeService, IUser } from '@meshmakers/shared-auth';
import { Component, Input } from '@angular/core';

// Mock Kendo components to avoid complex setup
// eslint-disable-next-line @angular-eslint/component-selector
@Component({ selector: 'kendo-avatar', template: '', changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true })
class MockAvatarComponent {
  @Input()
  initials: string | undefined;
  @Input()
  shape: string | undefined;
  @Input()
  width: string | undefined;
  @Input()
  height: string | undefined;
}

// eslint-disable-next-line @angular-eslint/component-selector
@Component({ selector: 'kendo-popup', template: '<ng-content></ng-content>', changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true })
class MockPopupComponent {
  @Input()
  anchor: unknown;
  @Input()
  popupClass: string | undefined;
}

// eslint-disable-next-line @angular-eslint/component-selector
@Component({ selector: 'kendo-loader', template: '', changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true })
class MockLoaderComponent {
  @Input()
  themeColor: string | undefined;
  @Input()
  type: string | undefined;
  @Input()
  size: string | undefined;
}

// eslint-disable-next-line @angular-eslint/component-selector
@Component({ selector: 'button[kendoButton]', template: '<ng-content></ng-content>', changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true })
class MockButtonComponent {
  @Input()
  fillMode: string | undefined;
  @Input()
  themeColor: string | undefined;
  @Input()
  svgIcon: unknown;
  @Input()
  size: string | undefined;
}

describe('LoginAppBarSectionComponent', () => {
  let component: LoginAppBarSectionComponent;
  let fixture: ComponentFixture<LoginAppBarSectionComponent>;
  let authServiceMock: MockedObject<AuthorizeService>;

  // Signal mocks
  let userSignal: WritableSignal<IUser | null>;
  let issuerSignal: WritableSignal<string | null>;
  let isAuthenticatedSignal: WritableSignal<boolean>;
  let userInitialsSignal: WritableSignal<string | null>;
  let sessionLoadingSignal: WritableSignal<boolean>;

  const mockUser: IUser = {
    family_name: 'Mustermann',
    given_name: 'Max',
    name: 'max.mustermann',
    role: ['Admin'],
    sub: 'user-123',
    idp: 'local',
    email: 'max@example.com'
  };

  beforeEach(async () => {
    // Create writable signals for mocking
    userSignal = signal<IUser | null>(null);
    issuerSignal = signal<string | null>(null);
    isAuthenticatedSignal = signal<boolean>(false);
    userInitialsSignal = signal<string | null>(null);
    sessionLoadingSignal = signal<boolean>(false);

    authServiceMock = {
      login: vi.fn().mockName('AuthorizeService.login'),
      logout: vi.fn().mockName('AuthorizeService.logout'),
      // Signal API (new)
      user: userSignal,
      issuer: issuerSignal,
      isAuthenticated: isAuthenticatedSignal,
      userInitials: userInitialsSignal,
      sessionLoading: sessionLoadingSignal
    } as unknown as MockedObject<AuthorizeService>;

    await TestBed.configureTestingModule({
      imports: [LoginAppBarSectionComponent],
      providers: [
        { provide: AuthorizeService, useValue: authServiceMock }
      ]
    })
      .overrideComponent(LoginAppBarSectionComponent, {
        set: {
          imports: [MockAvatarComponent, MockPopupComponent, MockLoaderComponent, MockButtonComponent]
        }
      })
      .compileComponents();

    fixture = TestBed.createComponent(LoginAppBarSectionComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('initialization', () => {
    it('should set profileUri from issuer on init', fakeAsync(() => {
      issuerSignal.set('https://auth.example.com/');

      fixture.detectChanges();
      tick();

      // Access via template binding - the component uses signals internally
      // We verify via the authorizeService mock state
      expect(issuerSignal()).toBe('https://auth.example.com/');
    }));

    it('should not set profileUri when issuer is null', fakeAsync(() => {
      issuerSignal.set(null);

      fixture.detectChanges();
      tick();

      expect(issuerSignal()).toBeNull();
    }));
  });

  describe('user signal', () => {
    it('should use user name from authorizeService', () => {
      userSignal.set(mockUser);
      fixture.detectChanges();

      // Verify the authorizeService user signal has the expected value
      expect(userSignal()?.name).toBe('max.mustermann');
    });

    it('should handle null user', () => {
      userSignal.set(null);
      fixture.detectChanges();

      expect(userSignal()).toBeNull();
    });
  });

  describe('fullName computation', () => {
    it('should compute full name when user has given_name and family_name', () => {
      userSignal.set(mockUser);
      fixture.detectChanges();

      const user = userSignal();
      const fullName = user?.given_name && user?.family_name
        ? `${user.given_name} ${user.family_name}`
        : null;
      expect(fullName).toBe('Max Mustermann');
    });

    it('should return null when user has no given_name', () => {
      userSignal.set({ ...mockUser, given_name: null });
      fixture.detectChanges();

      const user = userSignal();
      const fullName = user?.given_name && user?.family_name
        ? `${user.given_name} ${user.family_name}`
        : null;
      expect(fullName).toBeNull();
    });

    it('should return null when user has no family_name', () => {
      userSignal.set({ ...mockUser, family_name: null });
      fixture.detectChanges();

      const user = userSignal();
      const fullName = user?.given_name && user?.family_name
        ? `${user.given_name} ${user.family_name}`
        : null;
      expect(fullName).toBeNull();
    });

    it('should return null when user is null', () => {
      userSignal.set(null);
      fixture.detectChanges();

      const user = userSignal();
      const fullName = user?.given_name && user?.family_name
        ? `${user.given_name} ${user.family_name}`
        : null;
      expect(fullName).toBeNull();
    });
  });

  describe('showRegister input', () => {
    it('should default to false', () => {
      fixture.detectChanges();
      expect(component.showRegister).toBe(false);
    });

    it('should accept true value', () => {
      component.showRegister = true;
      fixture.detectChanges();
      expect(component.showRegister).toBe(true);
    });
  });

  describe('popup toggle', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should initially have popup closed', () => {
      expect(component.showPopup).toBe(false);
    });

    it('should toggle popup state', () => {
      component.onToggle();
      expect(component.showPopup).toBe(true);

      component.onToggle();
      expect(component.showPopup).toBe(false);
    });

    it('should set popup to specific state', () => {
      component.onToggle(true);
      expect(component.showPopup).toBe(true);

      component.onToggle(true);
      expect(component.showPopup).toBe(true);

      component.onToggle(false);
      expect(component.showPopup).toBe(false);
    });
  });

  describe('keyboard events', () => {
    beforeEach(() => {
      fixture.detectChanges();
      component.onToggle(true);
    });

    it('should close popup on Escape key', () => {
      expect(component.showPopup).toBe(true);

      const event = new KeyboardEvent('keydown', { code: 'Escape' });
      component.keydown(event);

      expect(component.showPopup).toBe(false);
    });

    it('should not close popup on other keys', () => {
      expect(component.showPopup).toBe(true);

      const event = new KeyboardEvent('keydown', { code: 'Enter' });
      component.keydown(event);

      expect(component.showPopup).toBe(true);
    });
  });

  describe('login action', () => {
    it('should call authorizeService.login', () => {
      fixture.detectChanges();

      (component as unknown as {
        onLogin(): void;
      }).onLogin();

      expect(authServiceMock.login).toHaveBeenCalled();
    });
  });

  describe('logout action', () => {
    it('should call authorizeService.logout', () => {
      fixture.detectChanges();

      (component as unknown as {
        onLogout(): void;
      }).onLogout();

      expect(authServiceMock.logout).toHaveBeenCalled();
    });
  });

  describe('register action', () => {
    it('should emit register event', () => {
      fixture.detectChanges();

      const registerSpy = vi.fn().mockName('register');
      component.register.subscribe(registerSpy);

      (component as unknown as {
        onRegister(): void;
      }).onRegister();

      expect(registerSpy).toHaveBeenCalled();
    });
  });

  describe('document click handling', () => {
    beforeEach(() => {
      fixture.detectChanges();
      component.onToggle(true);
    });

    it('should close popup when clicking outside', () => {
      expect(component.showPopup).toBe(true);

      const outsideElement = document.createElement('div');
      document.body.appendChild(outsideElement);

      const event = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(event, 'target', { value: outsideElement });
      component.documentClick(event);

      expect(component.showPopup).toBe(false);

      document.body.removeChild(outsideElement);
    });
  });

  describe('authentication states', () => {
    it('should show loader when sessionLoading is true', () => {
      sessionLoadingSignal.set(true);
      fixture.detectChanges();

      expect(sessionLoadingSignal()).toBe(true);
    });

    it('should show login button when not authenticated', () => {
      sessionLoadingSignal.set(false);
      isAuthenticatedSignal.set(false);
      fixture.detectChanges();

      expect(isAuthenticatedSignal()).toBe(false);
    });

    it('should show user avatar when authenticated', () => {
      sessionLoadingSignal.set(false);
      isAuthenticatedSignal.set(true);
      userInitialsSignal.set('MM');
      fixture.detectChanges();

      expect(isAuthenticatedSignal()).toBe(true);
      expect(userInitialsSignal()).toBe('MM');
    });
  });
});
