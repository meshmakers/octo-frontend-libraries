import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TenantSwitcherComponent } from './tenant-switcher.component';

describe('TenantSwitcherComponent', () => {
  let fixture: ComponentFixture<TenantSwitcherComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TenantSwitcherComponent] });
    fixture = TestBed.createComponent(TenantSwitcherComponent);
    fixture.componentInstance.currentTenantId = 'a-rather-long-tenant-name';
    fixture.detectChanges();
  });

  it('shows the tenant name and carries the full name as tooltip, for when a narrow top bar truncates it', () => {
    const badge = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.tenant-badge');
    expect(badge?.querySelector('.tenant-name')?.textContent?.trim()).toBe('a-rather-long-tenant-name');
    expect(badge?.getAttribute('title')).toBe('a-rather-long-tenant-name');
  });
});
