import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EntityFormChipsEditorComponent, EntityFormChipValue } from './entity-form-chips-editor.component';

/** Protected-member view used by the spec. */
interface Testable {
  draft: { set(v: string): void };
  invalidDraft: () => boolean;
  items: () => EntityFormChipValue[];
}

describe('EntityFormChipsEditorComponent', () => {
  let fixture: ComponentFixture<EntityFormChipsEditorComponent>;
  let component: EntityFormChipsEditorComponent;
  let api: Testable;
  let emitted: EntityFormChipValue[][];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [EntityFormChipsEditorComponent], animationsEnabled: false }).compileComponents();
    fixture = TestBed.createComponent(EntityFormChipsEditorComponent);
    component = fixture.componentInstance;
    api = component as unknown as Testable;
    emitted = [];
    component.registerOnChange((v) => emitted.push(v));
    fixture.detectChanges();
  });

  it('adds comma separated strings without duplicates', () => {
    component.writeValue(['a']);
    api.draft.set('a, b ,c');
    expect(component.commitDraft()).toBe(true);
    expect(emitted.at(-1)).toEqual(['a', 'b', 'c']);
  });

  it('parses integers in numeric mode and rejects other input', () => {
    fixture.componentRef.setInput('numeric', true);
    api.draft.set('1,2');
    component.commitDraft();
    expect(emitted.at(-1)).toEqual([1, 2]);
    api.draft.set('x');
    expect(component.commitDraft()).toBe(false);
    expect(api.invalidDraft()).toBe(true);
    expect(api.items()).toEqual([1, 2]);
  });

  it('removes an item', () => {
    component.writeValue(['a', 'b']);
    component.removeAt(0);
    expect(emitted.at(-1)).toEqual(['b']);
  });

  it('treats a non-array value as empty and hides the input when disabled', () => {
    component.writeValue(null);
    expect(api.items()).toEqual([]);
    component.setDisabledState(true);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('kendo-textbox')).toBeNull();
  });
});
