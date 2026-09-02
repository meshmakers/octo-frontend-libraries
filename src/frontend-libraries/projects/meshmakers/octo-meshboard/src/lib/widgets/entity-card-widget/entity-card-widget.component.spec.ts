import type { MockedObject } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { EntityCardWidgetComponent } from './entity-card-widget.component';
import { DashboardDataService, MeshBoardDataService } from '../../services/meshboard-data.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { EntityCardWidgetConfig, MeshBoardVariable, RuntimeEntityData, EntitySelectorConfig } from '../../models/meshboard.models';

/**
 * Covers the entity-card's resolution of its effective entity reference:
 * literal/variable rtId+ckTypeId and the entity-selector binding.
 */
describe('EntityCardWidgetComponent', () => {
  let component: EntityCardWidgetComponent;
  let dataServiceSpy: MockedObject<MeshBoardDataService>;
  let variables: MeshBoardVariable[];
  let selectors: EntitySelectorConfig[];

  const entity: RuntimeEntityData = {
    rtId: 'rt-123',
    ckTypeId: 'Energy/MeteringPoint',
    rtWellKnownName: 'MP 1',
    attributes: [],
    associations: []
  };

  function baseConfig(dataSource: EntityCardWidgetConfig['dataSource']): EntityCardWidgetConfig {
    return {
      id: 'w1', type: 'entityCard', title: 'Card',
      col: 1, row: 1, colSpan: 2, rowSpan: 2,
      dataSource
    } as EntityCardWidgetConfig;
  }

  beforeEach(() => {
    variables = [];
    selectors = [];
    dataServiceSpy = {
      fetchEntityWithAssociations: vi.fn().mockName('DashboardDataService.fetchEntityWithAssociations')
    } as unknown as MockedObject<MeshBoardDataService>;
    dataServiceSpy.fetchEntityWithAssociations.mockReturnValue(of(entity));

    const stateStub: Partial<MeshBoardStateService> = {
      getVariables: () => variables,
      getEntitySelector: (id: string) => selectors.find(s => s.id === id)
    };

    TestBed.configureTestingModule({
      imports: [EntityCardWidgetComponent],
      providers: [
        MeshBoardVariableService,
        { provide: DashboardDataService, useValue: dataServiceSpy },
        { provide: MeshBoardStateService, useValue: stateStub }
      ]
    });

    component = TestBed.createComponent(EntityCardWidgetComponent).componentInstance;
  });

  it('fetches with literal rtId/ckTypeId', () => {
    component.config = baseConfig({ type: 'runtimeEntity', ckTypeId: 'Energy/MeteringPoint', rtId: 'rt-123' });
    component.ngOnInit();
    expect(dataServiceSpy.fetchEntityWithAssociations).toHaveBeenCalledTimes(1);
    expect(dataServiceSpy.fetchEntityWithAssociations).toHaveBeenCalledWith('rt-123', 'Energy/MeteringPoint');
    expect(component.data()).toBe(entity);
  });

  it('resolves $variables in rtId/ckTypeId before fetching', () => {
    variables = [
      { name: 'mp_rtId', type: 'string', source: 'entitySelector', value: 'rt-123' },
      { name: 'mp_rtCkTypeId', type: 'string', source: 'entitySelector', value: 'Energy/MeteringPoint' }
    ];
    component.config = baseConfig({ type: 'runtimeEntity', ckTypeId: '$mp_rtCkTypeId', rtId: '$mp_rtId' });
    component.ngOnInit();
    expect(dataServiceSpy.fetchEntityWithAssociations).toHaveBeenCalledTimes(1);
    expect(dataServiceSpy.fetchEntityWithAssociations).toHaveBeenCalledWith('rt-123', 'Energy/MeteringPoint');
  });

  it('does not fetch while a variable is unresolved', () => {
    component.config = baseConfig({ type: 'runtimeEntity', ckTypeId: '$mp_rtCkTypeId', rtId: '$mp_rtId' });
    component.ngOnInit();
    expect(dataServiceSpy.fetchEntityWithAssociations).not.toHaveBeenCalled();
    expect(component.data()).toBeNull();
  });

  it('binds to an entity selector: uses selectedRtId and the $<id>_rtCkTypeId variable', () => {
    selectors = [{ id: 'mp', label: 'MP', ckTypeId: 'Energy/MeteringPointBase', attributeMappings: [], selectedRtId: 'rt-123' }];
    variables = [{ name: 'mp_rtCkTypeId', type: 'string', source: 'entitySelector', value: 'Energy/MeteringPoint' }];
    component.config = baseConfig({ type: 'runtimeEntity', entitySelectorId: 'mp' });
    component.ngOnInit();
    expect(dataServiceSpy.fetchEntityWithAssociations).toHaveBeenCalledTimes(1);
    expect(dataServiceSpy.fetchEntityWithAssociations).toHaveBeenCalledWith('rt-123', 'Energy/MeteringPoint');
  });

  it('selector binding falls back to the selector ckTypeId when no rtCkTypeId variable is exposed', () => {
    selectors = [{ id: 'mp', label: 'MP', ckTypeId: 'Energy/MeteringPoint', attributeMappings: [], selectedRtId: 'rt-123' }];
    component.config = baseConfig({ type: 'runtimeEntity', entitySelectorId: 'mp' });
    component.ngOnInit();
    expect(dataServiceSpy.fetchEntityWithAssociations).toHaveBeenCalledTimes(1);
    expect(dataServiceSpy.fetchEntityWithAssociations).toHaveBeenCalledWith('rt-123', 'Energy/MeteringPoint');
  });

  it('does not fetch when a bound selector has no current selection', () => {
    selectors = [{ id: 'mp', label: 'MP', ckTypeId: 'Energy/MeteringPoint', attributeMappings: [] }];
    component.config = baseConfig({ type: 'runtimeEntity', entitySelectorId: 'mp' });
    component.ngOnInit();
    expect(dataServiceSpy.fetchEntityWithAssociations).not.toHaveBeenCalled();
  });

  it('is configured when only an entitySelectorId is set', () => {
    component.config = baseConfig({ type: 'runtimeEntity', entitySelectorId: 'mp' });
    expect(component.isNotConfigured()).toBe(false);
  });

  it('is not configured when runtimeEntity has neither rtId, ckTypeId nor selector', () => {
    component.config = baseConfig({ type: 'runtimeEntity' });
    expect(component.isNotConfigured()).toBe(true);
  });
});
