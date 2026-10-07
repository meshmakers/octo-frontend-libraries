import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { NotificationService } from '@progress/kendo-angular-notification';
import { CommandItemExecuteEventArgs } from '@meshmakers/shared-services';
import { ConfirmationService, InputService } from '@meshmakers/shared-ui';
import { SymbolLibraryListComponent } from './symbol-library-list.component';
import { SymbolLibraryService } from '../../services/symbol-library.service';

interface DeleteAccess { onDeleteClick: (e: CommandItemExecuteEventArgs) => Promise<void> }

/** Delete of symbol libraries confirms with the danger dialog naming the target (AB#5580). */
describe('SymbolLibraryListComponent — delete (AB#5578 danger confirmation)', () => {
  let confirmation: { showDangerConfirm: ReturnType<typeof vi.fn>; showYesNoConfirmationDialog: ReturnType<typeof vi.fn> };

  function create(): DeleteAccess {
    confirmation = { showDangerConfirm: vi.fn().mockResolvedValue(false), showYesNoConfirmationDialog: vi.fn() };
    TestBed.configureTestingModule({
      imports: [SymbolLibraryListComponent],
      providers: [
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ActivatedRoute, useValue: {} },
        { provide: ConfirmationService, useValue: confirmation },
        { provide: NotificationService, useValue: { show: vi.fn() } },
        { provide: InputService, useValue: {} },
        { provide: SymbolLibraryService, useValue: {} },
      ],
    });
    TestBed.overrideComponent(SymbolLibraryListComponent, { set: { template: '', imports: [] } });
    return TestBed.createComponent(SymbolLibraryListComponent).componentInstance as unknown as DeleteAccess;
  }

  it('names the library in the danger confirmation', async () => {
    const c = create();
    await c.onDeleteClick({ data: { rtId: 'l1', name: 'Valves', isReadOnly: false } } as unknown as CommandItemExecuteEventArgs);
    expect(confirmation.showDangerConfirm).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Delete symbol library Valves?',
      targetName: 'Valves',
      confirmText: 'Delete symbol library',
    }));
    expect(confirmation.showYesNoConfirmationDialog).not.toHaveBeenCalled();
  });

  it('does not ask for read-only libraries', async () => {
    const c = create();
    await c.onDeleteClick({ data: { rtId: 'l1', name: 'Core', isReadOnly: true } } as unknown as CommandItemExecuteEventArgs);
    expect(confirmation.showDangerConfirm).not.toHaveBeenCalled();
  });
});
