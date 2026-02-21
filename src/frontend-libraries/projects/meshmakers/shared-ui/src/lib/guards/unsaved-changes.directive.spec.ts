import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UnsavedChangesDirective } from './unsaved-changes.directive';
import { HasUnsavedChanges, HAS_UNSAVED_CHANGES } from './unsaved-changes.interface';

@Component({
  selector: 'mm-test-host-with-changes',
  standalone: true,
  template: '<div mmUnsavedChanges>Test</div>',
  providers: [{ provide: HAS_UNSAVED_CHANGES, useExisting: TestHostWithChangesComponent }],
  imports: [UnsavedChangesDirective]
})
class TestHostWithChangesComponent implements HasUnsavedChanges {
  private _hasChanges = false;

  hasUnsavedChanges(): boolean {
    return this._hasChanges;
  }

  setHasChanges(value: boolean): void {
    this._hasChanges = value;
  }
}

@Component({
  selector: 'mm-test-host-without-provider',
  standalone: true,
  template: '<div mmUnsavedChanges>Test</div>',
  imports: [UnsavedChangesDirective]
  // No HAS_UNSAVED_CHANGES provider
})
class TestHostWithoutProviderComponent {}

describe('UnsavedChangesDirective', () => {
  describe('with host implementing HasUnsavedChanges', () => {
    let component: TestHostWithChangesComponent;
    let fixture: ComponentFixture<TestHostWithChangesComponent>;
    let directive: UnsavedChangesDirective;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [TestHostWithChangesComponent]
      }).compileComponents();

      fixture = TestBed.createComponent(TestHostWithChangesComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      // Get the directive instance from the debug element
      const directiveEl = fixture.debugElement.children[0];
      directive = directiveEl.injector.get(UnsavedChangesDirective);
    });

    it('should create', () => {
      expect(component).toBeTruthy();
      expect(directive).toBeTruthy();
    });

    it('should not prevent unload when component has no unsaved changes', () => {
      component.setHasChanges(false);

      // Create a mock event
      const event = {
        preventDefault: jasmine.createSpy('preventDefault'),
        returnValue: true
      } as unknown as BeforeUnloadEvent;

      // Call the handler directly
      directive.onBeforeUnload(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('should prevent unload when component has unsaved changes', () => {
      component.setHasChanges(true);

      // Create a mock event
      const event = {
        preventDefault: jasmine.createSpy('preventDefault'),
        returnValue: true
      } as unknown as BeforeUnloadEvent;

      // Call the handler directly
      directive.onBeforeUnload(event);

      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should set returnValue for legacy browser support', () => {
      component.setHasChanges(true);

      // Create a mock event with writable returnValue
      const event = {
        preventDefault: jasmine.createSpy('preventDefault'),
        returnValue: true
      } as unknown as BeforeUnloadEvent;

      // Call the handler directly
      directive.onBeforeUnload(event);

      expect(event.returnValue).toBe('');
    });
  });

  describe('without HAS_UNSAVED_CHANGES provider', () => {
    let fixture: ComponentFixture<TestHostWithoutProviderComponent>;
    let directive: UnsavedChangesDirective;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [TestHostWithoutProviderComponent]
      }).compileComponents();

      fixture = TestBed.createComponent(TestHostWithoutProviderComponent);
      fixture.detectChanges();

      // Get the directive instance from the debug element
      const directiveEl = fixture.debugElement.children[0];
      directive = directiveEl.injector.get(UnsavedChangesDirective);
    });

    it('should not prevent unload when host is not provided', () => {
      // Create a mock event
      const event = {
        preventDefault: jasmine.createSpy('preventDefault'),
        returnValue: true
      } as unknown as BeforeUnloadEvent;

      // Call the handler directly
      directive.onBeforeUnload(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
    });
  });
});
