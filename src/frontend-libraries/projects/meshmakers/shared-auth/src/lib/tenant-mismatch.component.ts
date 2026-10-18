import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthorizeService } from './authorize.service';

/**
 * Blocking screen shown when the signed-in token belongs to another tenant than the route
 * (AB#6731). Hosts register it on `/:tenantId/tenant-mismatch` ({@link TENANT_MISMATCH_PATH});
 * `authorizeGuard` redirects there when the tenant switch did not complete. It never loads
 * tenant data.
 *
 * - First visit: offers a user-initiated "Sign in to <route tenant>" (one fresh authorization-code
 *   flow, see {@link AuthorizeService.retryTenantSignIn}).
 * - After that retry the mismatch is final: "not a member, contact your administrator" and only
 *   the way back to a usable tenant remains. There is never an automatic redirect.
 */
@Component({
  selector: 'mm-tenant-mismatch',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mm-tenant-mismatch">
      <section class="mm-tenant-mismatch__panel" aria-labelledby="mm-tenant-mismatch-title">
        <h1 id="mm-tenant-mismatch-title">No access to tenant {{ routeTenantId() }}</h1>
        @if (retried()) {
          <p>
            You are signed in to <code>{{ tokenTenantId() ?? 'another tenant' }}</code>. Your account is not a member of
            <code>{{ routeTenantId() }}</code>. Contact your administrator.
          </p>
        } @else {
          <p>
            You are signed in to <code>{{ tokenTenantId() ?? 'another tenant' }}</code>. This session cannot be used for
            <code>{{ routeTenantId() }}</code>. Sign in again to switch, or go back to a tenant you can use.
          </p>
          <button type="button" class="k-button k-button-solid k-button-solid-primary" (click)="signIn()">
            Sign in to {{ routeTenantId() }}
          </button>
        }
        @if (tokenTenantId(); as current) {
          <a class="mm-tenant-mismatch__link" [routerLink]="['/', current]">Back to {{ current }}</a>
        }
        @if (otherTenants().length > 0) {
          <div class="mm-tenant-mismatch__tenants">
            <span>Your tenants:</span>
            @for (tenant of otherTenants(); track tenant) {
              <a class="mm-tenant-mismatch__link" [routerLink]="['/', tenant]">{{ tenant }}</a>
            }
          </div>
        }
      </section>
    </div>
  `,
  styles: `
    :host { display: flex; flex: 1; width: 100%; }
    .mm-tenant-mismatch { display: grid; place-items: center; flex: 1; padding: 2rem 1rem;
      background: var(--kendo-color-app-surface); color: var(--kendo-color-on-app-surface); }
    .mm-tenant-mismatch__panel { display: grid; justify-items: start; gap: 0.75rem; width: min(520px, 100%);
      padding: 1.5rem; background: var(--kendo-color-surface); border: 1px solid var(--kendo-color-border);
      border-radius: var(--kendo-border-radius-md, 4px); }
    h1 { margin: 0; font-size: 1.25rem; font-weight: 600; }
    p { margin: 0; }
    code { font-family: var(--kendo-font-family-monospace, monospace); }
    .mm-tenant-mismatch__tenants { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
    .mm-tenant-mismatch__link { color: var(--kendo-color-primary); }
  `
})
export class TenantMismatchComponent {
  private readonly authorizeService = inject(AuthorizeService);
  private readonly route = inject(ActivatedRoute);

  protected readonly routeTenantId = computed(() => this.route.snapshot.paramMap.get('tenantId') ?? '');
  protected readonly tokenTenantId = this.authorizeService.tokenTenantId;
  protected readonly retried = computed(() => this.authorizeService.isTenantSignInRetried(this.routeTenantId()));
  protected readonly otherTenants = computed(() =>
    this.authorizeService
      .allowedTenants()
      .filter(t => t.toLowerCase() !== (this.tokenTenantId() ?? '').toLowerCase()));

  protected signIn(): void {
    const tenantId = this.routeTenantId();
    this.authorizeService.retryTenantSignIn(tenantId, `${window.location.origin}/${tenantId}`);
  }
}
