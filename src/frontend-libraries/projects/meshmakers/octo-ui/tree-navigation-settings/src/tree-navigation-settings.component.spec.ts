import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormArray, FormGroup } from '@angular/forms';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { TreeNavigationConfigService } from '@meshmakers/octo-ui';
import {
  AssetRepoService,
  CkTypeSelectorService,
  ImportStrategyDto,
  JobManagementService,
} from '@meshmakers/octo-services';
import { ImportStrategyDialogService } from '@meshmakers/shared-ui';
import { MessageService } from '@meshmakers/shared-services';
import { of } from 'rxjs';
import { TreeNavigationSettingsComponent } from './tree-navigation-settings.component';

/** Protected-member view used by the spec. */
interface Testable {
  rules: FormArray<FormGroup>;
  typePresent: () => boolean;
  onSave(): Promise<void>;
  addRule(): void;
  export(): Promise<void>;
  onFileSelected(event: Event): Promise<void>;
}

describe('TreeNavigationSettingsComponent', () => {
  let fixture: ComponentFixture<TreeNavigationSettingsComponent>;
  let component: TreeNavigationSettingsComponent;
  let api: Testable;

  let configSpy: jasmine.SpyObj<TreeNavigationConfigService>;
  let messageSpy: jasmine.SpyObj<MessageService>;
  let ckTypeSpy: jasmine.SpyObj<CkTypeSelectorService>;
  let assetRepoSpy: jasmine.SpyObj<AssetRepoService>;
  let jobsSpy: jasmine.SpyObj<JobManagementService>;
  let importStrategySpy: jasmine.SpyObj<ImportStrategyDialogService>;

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
    assetRepoSpy = jasmine.createSpyObj('AssetRepoService', [
      'exportRtModelDeepGraph',
      'importRtModel',
    ]);
    jobsSpy = jasmine.createSpyObj('JobManagementService', [
      'waitForJob',
      'downloadJobResult',
    ]);
    jobsSpy.waitForJob.and.resolveTo(true);
    jobsSpy.downloadJobResult.and.resolveTo();
    importStrategySpy = jasmine.createSpyObj('ImportStrategyDialogService', [
      'showImportStrategyDialog',
    ]);

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
        { provide: AssetRepoService, useValue: assetRepoSpy },
        { provide: JobManagementService, useValue: jobsSpy },
        { provide: ImportStrategyDialogService, useValue: importStrategySpy },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ tenantId: 'energyiq' }) },
            parent: null,
          },
        },
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

  it('exports the saved singleton via the standard deep-graph job', async () => {
    await component.ngOnInit();
    assetRepoSpy.exportRtModelDeepGraph.and.resolveTo('job-x');

    await api.export();

    expect(assetRepoSpy.exportRtModelDeepGraph).toHaveBeenCalledWith(
      'energyiq',
      ['cfg-1'],
      'System.UI/TreeNavigationConfiguration',
    );
    expect(jobsSpy.waitForJob).toHaveBeenCalled();
    expect(jobsSpy.downloadJobResult).toHaveBeenCalled();
  });

  it('does not export before the config has been saved', async () => {
    configSpy.loadConfig.and.resolveTo({
      typePresent: true,
      rtId: null,
      roles: [],
    });
    await component.ngOnInit();

    await api.export();

    expect(assetRepoSpy.exportRtModelDeepGraph).not.toHaveBeenCalled();
    expect(messageSpy.showInformation).toHaveBeenCalled();
  });

  it('imports via the standard import-strategy job and reloads', async () => {
    await component.ngOnInit();
    configSpy.loadConfig.calls.reset();
    importStrategySpy.showImportStrategyDialog.and.resolveTo(
      ImportStrategyDto.InsertOnly,
    );
    assetRepoSpy.importRtModel.and.resolveTo('job-imp');

    const file = new File(['zip'], 'config.zip', { type: 'application/zip' });
    const event = {
      target: { files: [file], value: 'config.zip' },
    } as unknown as Event;

    await api.onFileSelected(event);

    expect(importStrategySpy.showImportStrategyDialog).toHaveBeenCalled();
    expect(assetRepoSpy.importRtModel).toHaveBeenCalledWith(
      'energyiq',
      file,
      ImportStrategyDto.InsertOnly,
    );
    expect(jobsSpy.waitForJob).toHaveBeenCalled();
    expect(configSpy.loadConfig).toHaveBeenCalled();
    expect(messageSpy.showInformation).toHaveBeenCalled();
  });

  it('aborts import when the strategy dialog is cancelled', async () => {
    await component.ngOnInit();
    importStrategySpy.showImportStrategyDialog.and.resolveTo(null);

    const file = new File(['zip'], 'config.zip', { type: 'application/zip' });
    const event = {
      target: { files: [file], value: 'config.zip' },
    } as unknown as Event;

    await api.onFileSelected(event);

    expect(assetRepoSpy.importRtModel).not.toHaveBeenCalled();
  });
});
