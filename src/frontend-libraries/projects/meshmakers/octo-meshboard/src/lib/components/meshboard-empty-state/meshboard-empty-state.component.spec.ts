import { TestBed } from '@angular/core/testing';
import { MeshBoardEmptyStateComponent } from './meshboard-empty-state.component';

describe('MeshBoardEmptyStateComponent', () => {
  function render(readonly?: boolean) {
    const fixture = TestBed.createComponent(MeshBoardEmptyStateComponent);
    if (readonly !== undefined) {
      fixture.componentRef.setInput('readonly', readonly);
    }
    fixture.detectChanges();
    return fixture;
  }

  it('offers "Add Your First Widget" on an editable board and emits on click', () => {
    const fixture = render();
    const emitted = vi.fn();
    fixture.componentInstance.addWidget.subscribe(emitted);
    const button = (fixture.nativeElement as HTMLElement).querySelector('button');
    expect(button?.textContent).toContain('Add Your First Widget');
    button!.click();
    expect(emitted).toHaveBeenCalledTimes(1);
  });

  it('offers no add action on a read-only board', () => {
    const el = render(true).nativeElement as HTMLElement;
    expect(el.querySelector('button')).toBeNull();
    expect(el.textContent).toContain('This MeshBoard has no widgets yet.');
    expect(el.textContent).not.toContain('Add Your First Widget');
  });
});
