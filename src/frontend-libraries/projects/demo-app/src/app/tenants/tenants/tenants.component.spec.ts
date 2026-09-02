import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { TenantsComponent } from './tenants.component';
import { AssetRepoService } from '@meshmakers/octo-services';
import { CommandSettingsService } from '@meshmakers/shared-services';

describe('TenantsComponent', () => {
  let component: TenantsComponent;
  let fixture: ComponentFixture<TenantsComponent>;

  beforeEach(async () => {
    const mockAssetRepoService = {
      getTenants: vi.fn().mockName('AssetRepoService.getTenants')
    };
    mockAssetRepoService.getTenants.mockResolvedValue({ list: [], totalCount: 0 });

    const mockCommandSettingsService = {
      setSelectedDrawerItem: vi.fn().mockName('CommandSettingsService.setSelectedDrawerItem'),
      commandItems: [],
      navigateRelativeToRoute: null
    };

    await TestBed.configureTestingModule({
      imports: [TenantsComponent],
      providers: [
        provideNoopAnimations(),
        { provide: AssetRepoService, useValue: mockAssetRepoService },
        { provide: CommandSettingsService, useValue: mockCommandSettingsService }
      ]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TenantsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
