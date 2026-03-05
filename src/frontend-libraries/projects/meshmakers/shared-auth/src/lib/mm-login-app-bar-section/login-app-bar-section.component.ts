import { Component, computed, ElementRef, EventEmitter, HostListener, Input, OnInit, Output, Signal, ViewChild, inject } from '@angular/core';
import { AuthorizeService } from '../authorize.service';
import { AvatarComponent } from '@progress/kendo-angular-layout';
import { ButtonComponent } from '@progress/kendo-angular-buttons';
import { PopupComponent } from '@progress/kendo-angular-popup';
import { LoaderComponent } from '@progress/kendo-angular-indicators';

@Component({
  selector: 'mm-login-app-bar-section',
  imports: [
    AvatarComponent,
    ButtonComponent,
    PopupComponent,
    LoaderComponent
  ],
  templateUrl: './login-app-bar-section.component.html',
  styleUrl: './login-app-bar-section.component.scss'
})
export class LoginAppBarSectionComponent implements OnInit {
  protected readonly authorizeService = inject(AuthorizeService);

  private readonly _register = new EventEmitter();
  private _showRegister = false;
  private _showPopup = false;

  /**
   * Computed signal for the user's display name.
   */
  protected readonly userName: Signal<string | null> = computed(() =>
    this.authorizeService.user()?.name ?? null
  );

  /**
   * Computed signal for the user's display name.
   * Delegates to AuthorizeService which handles cross-tenant username derivation.
   */
  protected readonly fullName: Signal<string | null> = this.authorizeService.displayName;

  /**
   * Computed signal for the profile management URI.
   * Uses the tenant_id from the access token to build the correct URL.
   */
  protected readonly profileUri: Signal<string | null> = computed(() => {
    const issuerUri = this.authorizeService.issuer();
    const tenantId = this.authorizeService.tokenTenantId();
    if (issuerUri && tenantId) {
      return `${issuerUri}${tenantId}/manage`;
    }
    return null;
  });

  @ViewChild("user", { read: ElementRef })
  private anchor: ElementRef | null = null;

  @ViewChild("popup", { read: ElementRef })
  private popup: ElementRef | null = null;

  constructor() {
    this._showPopup = false;
    this._showRegister = false;
  }

  ngOnInit(): void {
    console.debug('mm-login-app-bar-section::created');
  }

  @Output() get register(): EventEmitter<void> {
    return this._register;
  }

  public get showPopup(): boolean {
    return this._showPopup;
  }

  public set showPopup(value: boolean) {
    this._showPopup = value;
  }

  public get showRegister(): boolean {
    return this._showRegister;
  }

  @Input()
  public set showRegister(value: boolean) {
    this._showRegister = value;
  }

  @HostListener("document:keydown", ["$event"])
  public keydown(event: KeyboardEvent): void {
    if (event.code === "Escape") {
      this.onToggle(false);
    }
  }

  @HostListener("document:click", ["$event"])
  public documentClick(event: MouseEvent): void {
    if (!this.contains(event.target)) {
      this.onToggle(false);
    }
  }

  private contains(target: EventTarget | null): boolean {
    return (
      this.anchor?.nativeElement.contains(target) ||
      (this.popup ? this.popup.nativeElement.contains(target) : false)
    );
  }

  public onToggle(show?: boolean): void {
    this._showPopup = show !== undefined ? show : !this._showPopup;
  }

  protected onLogin(): void {
    this.authorizeService.login();
  }

  protected onLogout(): void {
    this.authorizeService.logout();
  }

  protected onRegister(): void {
    this.register.emit();
  }
}
