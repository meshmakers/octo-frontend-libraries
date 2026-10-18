import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { AuthorizeService } from './authorize.service';
import { TenantMismatchComponent } from './tenant-mismatch.component';

describe('TenantMismatchComponent', () => {
  let retried = false;
  const retryTenantSignIn = vi.fn();

  function create(allowed: string[] = ['octosystem', 'other']) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'sbeg' } } } },
        {
          provide: AuthorizeService,
          useValue: {
            tokenTenantId: signal('octosystem'),
            allowedTenants: signal(allowed),
            isTenantSignInRetried: () => retried,
            retryTenantSignIn
          }
        }
      ]
    });
    const fixture = TestBed.createComponent(TenantMismatchComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    retried = false;
    retryTenantSignIn.mockClear();
  });

  it('names both tenants and offers a sign-in that retries once per click', () => {
    const el = create();

    expect(el.textContent).toContain('No access to tenant sbeg');
    expect(el.textContent).toContain('octosystem');
    const button = el.querySelector('button') as HTMLButtonElement;
    expect(button.textContent).toContain('Sign in to sbeg');
    button.click();
    expect(retryTenantSignIn).toHaveBeenCalledTimes(1);
    expect(retryTenantSignIn).toHaveBeenCalledWith('sbeg', expect.stringContaining('/sbeg'));
  });

  it('after a retry shows "not a member" without a sign-in button', () => {
    retried = true;
    const el = create();

    expect(el.querySelector('button')).toBeNull();
    expect(el.textContent).toContain('not a member');
    expect(el.textContent).toContain('Contact your administrator');
  });

  it('offers the way back to the token tenant and the other allowed tenants', () => {
    const el = create(['octosystem', 'other']);

    const links = Array.from(el.querySelectorAll('a')).map(a => a.textContent?.trim());
    expect(links).toContain('Back to octosystem');
    expect(links).toContain('other');
  });
});
