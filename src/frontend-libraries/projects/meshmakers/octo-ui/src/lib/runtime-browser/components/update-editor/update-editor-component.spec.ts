import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { UpdateRuntimeEntitiesDtoGQL } from '../../../graphQL/updateRuntimeEntities';
import { Attribute } from '../../models/attribute';
import { AttributeDataService } from '../../services/attribute-data.service';
import { AttributeMapperService } from '../../services/attribute-mapper.service';
import { SecretSafeAttributeNamesService } from '../../services/secret-safe-attribute-names.service';
import { SharedEditor } from '../shared-editor/shared-editor';
import { UpdateEditorComponent } from './update-editor-component';

/** Record block of the update editor (AB#5542 review): never write back what was not loaded. */
describe('UpdateEditorComponent — secret-safe save', () => {
  const definitions: Attribute[] = [
    { id: { ckId: 'T', rtId: null }, attributeName: 'name', attributeValueType: 'STRING', isOptional: true },
    { id: { ckId: 'T', rtId: null }, attributeName: 'providers', attributeValueType: 'RECORD_ARRAY', isOptional: true },
  ];
  const mutate = vi.fn();
  const showErrorNotification = vi.fn();

  beforeEach(() => {
    mutate.mockReset().mockReturnValue(of({ data: { runtime: { runtimeEntities: { update: [{ rtId: 'r1' }] } } } }));
    showErrorNotification.mockReset();
    TestBed.configureTestingModule({
      imports: [UpdateEditorComponent],
      providers: [
        provideNoopAnimations(),
        { provide: UpdateRuntimeEntitiesDtoGQL, useValue: { mutate } },
        {
          provide: AttributeDataService,
          useValue: { getAttributesDefinition$: () => of(definitions), getRtEntityValues$: () => of({ initial: [] }) },
        },
        {
          provide: AttributeMapperService,
          useValue: {
            mapFormValueToGraphQLAttributes$: (value: Record<string, unknown>) =>
              of(Object.entries(value).map(([attributeName, v]) => ({ attributeName, value: v }))),
          },
        },
        {
          provide: SecretSafeAttributeNamesService,
          useValue: {
            analyse: () => Promise.resolve({ attributeNames: ['name', 'providers', 'key'], secretNames: ['apiKey'], secretStateNames: [], blockedAttributes: ['providers'] }),
          },
        },
        {
          provide: SharedEditor,
          useValue: { showErrorNotification, prepareUpdateMutationOptions: (entities: unknown) => ({ variables: { entities } }) },
        },
      ],
    });
  });

  function create(formValue: Record<string, unknown>, initial: Record<string, unknown>): UpdateEditorComponent {
    const fixture = TestBed.createComponent(UpdateEditorComponent);
    fixture.componentRef.setInput('updateInput', { name: 'x', rtId: 'r1', rtCkTypeId: 'T-1/T-1', ckTypeId: 'T/T' });
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const group = new FormGroup(Object.fromEntries(Object.entries(formValue).map(([k, v]) => [k, new FormControl(v)])));
    (component as unknown as { form: { set(v: FormGroup): void } }).form.set(group);
    (component as unknown as { initialValue: { set(v: string): void } }).initialValue.set(JSON.stringify(initial));
    return component;
  }

  async function save(component: UpdateEditorComponent): Promise<void> {
    await (component as unknown as { onUpdate(): Promise<void> }).onUpdate();
  }

  it('skips the call and shows ONE message when only a blocked record changed', async () => {
    const component = create({ name: 'a', providers: [{ key: 'k2' }] }, { name: 'a', providers: [{ key: 'k1' }] });

    await save(component);

    expect(mutate).not.toHaveBeenCalled();
    expect(showErrorNotification).toHaveBeenCalledTimes(1);
  });

  it('saves the other changes without the blocked record', async () => {
    const component = create({ name: 'b', providers: [{ key: 'k1' }] }, { name: 'a', providers: [{ key: 'k1' }] });

    await save(component);

    expect(mutate).toHaveBeenCalledTimes(1);
    const item = mutate.mock.lastCall![0].variables.entities[0].item;
    expect(item.attributes).toEqual([{ attributeName: 'name', value: 'b' }]);
    expect(showErrorNotification).not.toHaveBeenCalled();
  });
});
