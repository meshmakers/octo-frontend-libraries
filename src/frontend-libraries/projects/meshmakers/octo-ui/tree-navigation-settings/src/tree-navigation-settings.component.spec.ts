import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormArray, FormGroup } from '@angular/forms';
import { TreeNavigationConfigService } from '@meshmakers/octo-ui';
import { CkTypeSelectorService } from '@meshmakers/octo-services';
import { MessageService } from '@meshmakers/shared-services';
import { of } from 'rxjs';
import { TreeNavigationSettingsComponent } from './tree-navigation-settings.component';

/** Protected-member view used by the spec. */
interface Testable {
  rules: FormArray<FormGroup>;
  typePresent: () => boolean;
  onSave(): Promise<void>;
  addRule(): void;
  onImport(event: Event): Promise<void>;
}

describe('TreeNavigationSettingsComponent', () => {
  let fixture: ComponentFixture<TreeNavigationSettingsComponent>;
  let component: TreeNavigationSettingsComponent;
  let api: Testable;

  let configSpy: jasmine.SpyObj<TreeNavigationConfigService>;
  let messageSpy: jasmine.SpyObj<MessageService>;
  let ckTypeSpy: jasmine.SpyObj<CkTypeSelectorService>;

  beforeEach(async () => {
    configSpy = jasmine.createSpyObj('TreeNavigationConfigService', [
      'loadConfig',
      'saveConfig',
      'getRoleSuggestions',
    ]);
    configSpy.getRoleSuggestions.and.resolveTo([]);
    messageSpy = jasmine.createSpyObj('MessageService', [
      'showInformation',
      'showError',
    ]);
    ckTypeSpy = jasmine.createSpyObj('CkTypeSelectorService', ['getCkTypes']);
    ckTypeSpy.getCkTypes.and.returnValue(of({ items: [], totalCount: 0 }));

    configSpy.loadConfig.and.resolveTo({
      typePresent: true,
      rtId: 'cfg-1',
      roles: [
        {
          sourceCkTypeId: 'EnergyIQ/Space',
          roleId: 'EnergyIQ/SpaceSensors',
          displayName: 'Sensoren',
          sortIndex: 1,
          visible: false,
        },
      ],
    });
    configSpy.saveConfig.and.resolveTo('cfg-1');

    await TestBed.configureTestingModule({
      imports: [TreeNavigationSettingsComponent],
      providers: [
        { provide: TreeNavigationConfigService, useValue: configSpy },
        { provide: MessageService, useValue: messageSpy },
        { provide: CkTypeSelectorService, useValue: ckTypeSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TreeNavigationSettingsComponent);
    component = fixture.componentInstance;
    api = component as unknown as Testable;
  });

  it('loads existing rules into the form', async () => {
    await component.ngOnInit();
    expect(configSpy.loadConfig).toHaveBeenCalled();
    expect(api.typePresent()).toBeTrue();
    expect(api.rules.length).toBe(1);
    const row = api.rules.at(0).getRawValue();
    expect(row.roleId).toBe('EnergyIQ/SpaceSensors');
    expect(row.displayName).toBe('Sensoren');
    expect(row.visible).toBe('hide');
  });

  it('flags when the CK type is not installed', async () => {
    configSpy.loadConfig.and.resolveTo({
      typePresent: false,
      rtId: null,
      roles: [],
    });
    await component.ngOnInit();
    expect(api.typePresent()).toBeFalse();
    expect(api.rules.length).toBe(0);
  });

  it('maps rows back to role configs on save (auto -> undefined)', async () => {
    await component.ngOnInit();
    api.addRule();
    api.rules.at(1).patchValue({
      sourceCkTypeId: '*',
      roleId: 'System.Communication/MapsTo',
      visible: 'hide',
      grouped: 'auto',
    });

    await api.onSave();

    expect(configSpy.saveConfig).toHaveBeenCalled();
    const [rtId, roles] = configSpy.saveConfig.calls.mostRecent().args;
    expect(rtId).toBe('cfg-1');
    expect(roles.length).toBe(2);
    const mapsTo = roles.find((r) => r.roleId === 'System.Communication/MapsTo');
    expect(mapsTo?.visible).toBeFalse();
    expect(mapsTo?.grouped).toBeUndefined();
    const sensors = roles.find((r) => r.roleId === 'EnergyIQ/SpaceSensors');
    expect(sensors?.visible).toBeFalse();
    expect(sensors?.displayName).toBe('Sensoren');
    expect(messageSpy.showInformation).toHaveBeenCalled();
  });

  it('imports rules from a JSON file', async () => {
    await component.ngOnInit();
    const json = JSON.stringify({
      roles: [
        { sourceCkTypeId: '*', roleId: 'A/B', visible: false, sortIndex: 3 },
      ],
    });
    const file = new File([json], 'config.json', { type: 'application/json' });
    const event = {
      target: { files: [file], value: 'config.json' },
    } as unknown as Event;

    await api.onImport(event);

    expect(api.rules.length).toBe(1);
    const row = api.rules.at(0).getRawValue();
    expect(row.roleId).toBe('A/B');
    expect(row.sourceCkTypeId).toBe('*');
    expect(row.visible).toBe('hide');
    expect(row.sortIndex).toBe(3);
    expect(messageSpy.showInformation).toHaveBeenCalled();
  });
});
