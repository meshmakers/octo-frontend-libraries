import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { TenantsComponent } from './tenants.component';
import { AssetRepoService } from '@meshmakers/octo-services';
import { CommandSettingsService } from '@meshmakers/shared-services';

describe('TenantsComponent', () => {
  let component: TenantsComponent;
  let fixture: ComponentFixture<TenantsComponent>;

  beforeEach(async () => {
    const mockAssetRepoService = jasmine.createSpyObj('AssetRepoService', ['getTenants']);
    mockAssetRepoService.getTenants.and.returnValue(Promise.resolve({ list: [], totalCount: 0 }));

    const mockCommandSettingsService = jasmine.createSpyObj('CommandSettingsService', ['setSelectedDrawerItem'], {
      commandItems: [],
      navigateRelativeToRoute: null
    });

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
