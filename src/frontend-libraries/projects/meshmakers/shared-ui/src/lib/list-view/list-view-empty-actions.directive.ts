import { Directive, TemplateRef, inject } from '@angular/core';

@Directive({
  selector: '[mmListViewEmptyActions]',
  standalone: true,
})
export class ListViewEmptyActionsDirective {
  public readonly templateRef = inject(TemplateRef<unknown>);
}
