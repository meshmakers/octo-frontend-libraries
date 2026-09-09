import type { MockedObject } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormArray, FormGroup } from '@angular/forms';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { TreeNavigationConfigService } from '@meshmakers/octo-ui';
import { AssetRepoService, CkTypeSelectorService, ImportStrategyDto, JobManagementService, } from '@meshmakers/octo-services';
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

  let configSpy: MockedObject<TreeNavigationConfigService>;
  let messageSpy: MockedObject<MessageService>;
  let ckTypeSpy: MockedObject<CkTypeSelectorService>;
  let assetRepoSpy: MockedObject<AssetRepoService>;
  let jobsSpy: MockedObject<JobManagementService>;
  let importStrategySpy: MockedObject<ImportStrategyDialogService>;

  beforeEach(async () => {
    configSpy = {
      loadConfig: vi.fn().mockName('TreeNavigationConfigService.loadConfig'),
      saveConfig: vi.fn().mockName('TreeNavigationConfigService.saveConfig'),
      getRoleSuggestions: vi.fn().mockName('TreeNavigationConfigService.getRoleSuggestions')
    } as unknown as MockedObject<TreeNavigationConfigService>;
    configSpy.getRoleSuggestions.mockResolvedValue([]);
    messageSpy = {
      showInformation: vi.fn().mockName('MessageService.showInformation'),
      showError: vi.fn().mockName('MessageService.showError')
    } as unknown as MockedObject<MessageService>;
    ckTypeSpy = {
      getCkTypes: vi.fn().mockName('CkTypeSelectorService.getCkTypes')
    } as unknown as MockedObject<CkTypeSelectorService>;
    ckTypeSpy.getCkTypes.mockReturnValue(of({ items: [], totalCount: 0 }));
    assetRepoSpy = {
      exportRtModelDeepGraph: vi.fn().mockName('AssetRepoService.exportRtModelDeepGraph'),
      importRtModel: vi.fn().mockName('AssetRepoService.importRtModel')
    } as unknown as MockedObject<AssetRepoService>;
    jobsSpy = {
      waitForJob: vi.fn().mockName('JobManagementService.waitForJob'),
      downloadJobResult: vi.fn().mockName('JobManagementService.downloadJobResult')
    } as unknown as MockedObject<JobManagementService>;
    jobsSpy.waitForJob.mockResolvedValue(true);
    jobsSpy.downloadJobResult.mockResolvedValue();
    importStrategySpy = {
      showImportStrategyDialog: vi.fn().mockName('ImportStrategyDialogService.showImportStrategyDialog')
    } as unknown as MockedObject<ImportStrategyDialogService>;

    configSpy.loadConfig.mockResolvedValue({
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
      perspectives: [],
    });
    configSpy.saveConfig.mockResolvedValue('cfg-1');

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
    expect(api.typePresent()).toBe(true);
    expect(api.rules.length).toBe(1);
    const row = api.rules.at(0).getRawValue();
    expect(row.roleId).toBe('EnergyIQ/SpaceSensors');
    expect(row.displayName).toBe('Sensoren');
    expect(row.visible).toBe('hide');
  });

  it('flags when the CK type is not installed', async () => {
    configSpy.loadConfig.mockResolvedValue({
      typePresent: false,
      rtId: null,
      roles: [],
      perspectives: [],
    });
    await component.ngOnInit();
    expect(api.typePresent()).toBe(false);
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
    const [rtId, roles] = vi.mocked(configSpy.saveConfig).mock.lastCall!;
    expect(rtId).toBe('cfg-1');
    expect(roles.length).toBe(2);
    const mapsTo = roles.find((r) => r.roleId === 'System.Communication/MapsTo');
    expect(mapsTo?.visible).toBe(false);
    expect(mapsTo?.grouped).toBeUndefined();
    const sensors = roles.find((r) => r.roleId === 'EnergyIQ/SpaceSensors');
    expect(sensors?.visible).toBe(false);
    expect(sensors?.displayName).toBe('Sensoren');
    expect(messageSpy.showInformation).toHaveBeenCalled();
  });

  it('exports the saved singleton via the standard deep-graph job', async () => {
    await component.ngOnInit();
    assetRepoSpy.exportRtModelDeepGraph.mockResolvedValue('job-x');

    await api.export();

    expect(assetRepoSpy.exportRtModelDeepGraph).toHaveBeenCalledWith('energyiq', ['cfg-1'], 'System.UI/TreeNavigationConfiguration');
    expect(jobsSpy.waitForJob).toHaveBeenCalled();
    expect(jobsSpy.downloadJobResult).toHaveBeenCalled();
  });

  it('does not export before the config has been saved', async () => {
    configSpy.loadConfig.mockResolvedValue({
      typePresent: true,
      rtId: null,
      roles: [],
      perspectives: [],
    });
    await component.ngOnInit();

    await api.export();

    expect(assetRepoSpy.exportRtModelDeepGraph).not.toHaveBeenCalled();
    expect(messageSpy.showInformation).toHaveBeenCalled();
  });

  it('imports via the standard import-strategy job and reloads', async () => {
    await component.ngOnInit();
    configSpy.loadConfig.mockClear();
    importStrategySpy.showImportStrategyDialog.mockResolvedValue(ImportStrategyDto.InsertOnly);
    assetRepoSpy.importRtModel.mockResolvedValue('job-imp');

    const file = new File(['zip'], 'config.zip', { type: 'application/zip' });
    const event = {
      target: { files: [file], value: 'config.zip' },
    } as unknown as Event;

    await api.onFileSelected(event);

    expect(importStrategySpy.showImportStrategyDialog).toHaveBeenCalled();
    expect(assetRepoSpy.importRtModel).toHaveBeenCalledWith('energyiq', file, ImportStrategyDto.InsertOnly);
    expect(jobsSpy.waitForJob).toHaveBeenCalled();
    expect(configSpy.loadConfig).toHaveBeenCalled();
    expect(messageSpy.showInformation).toHaveBeenCalled();
  });

  it('aborts import when the strategy dialog is cancelled', async () => {
    await component.ngOnInit();
    importStrategySpy.showImportStrategyDialog.mockResolvedValue(null);

    const file = new File(['zip'], 'config.zip', { type: 'application/zip' });
    const event = {
      target: { files: [file], value: 'config.zip' },
    } as unknown as Event;

    await api.onFileSelected(event);

    expect(assetRepoSpy.importRtModel).not.toHaveBeenCalled();
  });
});
