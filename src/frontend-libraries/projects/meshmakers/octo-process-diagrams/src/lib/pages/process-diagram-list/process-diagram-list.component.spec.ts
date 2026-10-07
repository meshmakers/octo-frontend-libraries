import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { NotificationService } from '@progress/kendo-angular-notification';
import { CommandItemExecuteEventArgs } from '@meshmakers/shared-services';
import { ConfirmationService, InputService } from '@meshmakers/shared-ui';
import { ProcessDiagramListComponent } from './process-diagram-list.component';
import { ProcessDiagramDataService } from '../../services/process-diagram-data.service';

interface DeleteAccess { onDeleteClick: (e: CommandItemExecuteEventArgs) => Promise<void>; dataSource: { refresh: () => void } }

/** Delete of process diagrams confirms with the danger dialog naming the target (AB#5580). */
describe('ProcessDiagramListComponent — delete (AB#5578 danger confirmation)', () => {
  let confirmation: { showDangerConfirm: ReturnType<typeof vi.fn>; showYesNoConfirmationDialog: ReturnType<typeof vi.fn> };
  let dataService: { deleteDiagram: ReturnType<typeof vi.fn> };

  function create(): DeleteAccess {
    confirmation = { showDangerConfirm: vi.fn().mockResolvedValue(true), showYesNoConfirmationDialog: vi.fn() };
    dataService = { deleteDiagram: vi.fn().mockResolvedValue(true) };
    TestBed.configureTestingModule({
      imports: [ProcessDiagramListComponent],
      providers: [
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ActivatedRoute, useValue: {} },
        { provide: ConfirmationService, useValue: confirmation },
        { provide: NotificationService, useValue: { show: vi.fn() } },
        { provide: InputService, useValue: {} },
        { provide: ProcessDiagramDataService, useValue: dataService },
      ],
    });
    TestBed.overrideComponent(ProcessDiagramListComponent, { set: { template: '', imports: [] } });
    const component = TestBed.createComponent(ProcessDiagramListComponent).componentInstance as unknown as DeleteAccess;
    component.dataSource = { refresh: vi.fn() };
    return component;
  }

  it('names the diagram and deletes after confirming', async () => {
    const c = create();
    await c.onDeleteClick({ data: { rtId: 'd1', name: 'Boiler' } } as unknown as CommandItemExecuteEventArgs);
    expect(confirmation.showDangerConfirm).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Delete process diagram Boiler?',
      targetName: 'Boiler',
      confirmText: 'Delete process diagram',
    }));
    expect(confirmation.showYesNoConfirmationDialog).not.toHaveBeenCalled();
    expect(dataService.deleteDiagram).toHaveBeenCalledWith('d1');
  });

  it('counts several diagrams and keeps them when cancelled', async () => {
    const c = create();
    confirmation.showDangerConfirm.mockResolvedValue(false);
    await c.onDeleteClick({ data: [{ rtId: 'd1', name: 'A' }, { rtId: 'd2', name: 'B' }] } as unknown as CommandItemExecuteEventArgs);
    expect(confirmation.showDangerConfirm).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Delete 2 process diagrams?',
      targetName: '2 process diagrams',
      confirmText: 'Delete process diagrams',
    }));
    expect(dataService.deleteDiagram).not.toHaveBeenCalled();
  });
});
