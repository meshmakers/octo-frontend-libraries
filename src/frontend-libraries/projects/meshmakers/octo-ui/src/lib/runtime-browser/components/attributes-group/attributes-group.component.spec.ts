import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { Attribute } from '../../models/attribute';
import { AttributeDataService } from '../../services/attribute-data.service';
import { AttributeMetadataResolverService } from '../../services/attribute-metadata-resolver.service';
import { AttributesGroupComponent } from './attributes-group.component';

/** Write-only secrets in the generic edit form (AB#5542). */
describe('AttributesGroupComponent — write-only secrets', () => {
  const definitions: Attribute[] = [
    { id: { ckId: 'T', rtId: null }, attributeName: 'user', attributeValueType: 'STRING', isOptional: false, value: '' },
    { id: { ckId: 'T', rtId: null }, attributeName: 'password', attributeValueType: 'STRING', isOptional: false, value: '', secret: true },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AttributesGroupComponent],
      providers: [
        provideNoopAnimations(),
        { provide: AttributeDataService, useValue: { getAttributesDefinition$: () => of(definitions) } },
        { provide: AttributeMetadataResolverService, useValue: { getRawAttributes$: () => of([]) } },
      ],
    });
  });

  async function render(secretsWriteOnly: boolean): Promise<FormGroup> {
    const form = new FormGroup({});
    const fixture = TestBed.createComponent(AttributesGroupComponent);
    fixture.componentRef.setInput('ckId', 'T');
    fixture.componentRef.setInput('parentFormGroup', form);
    fixture.componentRef.setInput('initialValues', [
      { attributeName: 'user', value: 'alice' },
      // Even if a value reached the form, a write-only secret must not be prefilled.
      { attributeName: 'password', value: 'should-never-show' },
    ]);
    fixture.componentRef.setInput('secretsWriteOnly', secretsWriteOnly);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return form;
  }

  it('starts a write-only secret empty and does not require it', async () => {
    const form = await render(true);

    expect(form.get('user')?.value).toBe('alice');
    expect(form.get('password')?.value).toBeNull();
    expect(form.get('password')?.valid).toBe(true);
  });

  it('keeps the required validator outside write-only mode (create)', async () => {
    const form = await render(false);

    form.get('password')?.setValue('');
    expect(form.get('password')?.valid).toBe(false);
  });
});
