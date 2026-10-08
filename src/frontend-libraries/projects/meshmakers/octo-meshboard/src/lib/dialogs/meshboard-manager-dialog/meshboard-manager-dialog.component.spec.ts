import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DialogRef, DialogService } from '@progress/kendo-angular-dialog';
import { AssetRepoService, JobManagementService } from '@meshmakers/octo-services';
import { ConfirmationService, ImportStrategyDialogService } from '@meshmakers/shared-ui';
import { expectIconButtonsAccessible } from '@meshmakers/shared-ui/testing';
import { MeshBoardManagerDialogComponent } from './meshboard-manager-dialog.component';
import { MeshBoardStateService } from '../../services/meshboard-state.service';

/** Row actions and delete confirmation of the MeshBoard manager (AB#5580). */
describe('MeshBoardManagerDialogComponent — actions (AB#5580)', () => {
  let stateService: {
    availableMeshBoards: ReturnType<typeof signal>;
    persistedMeshBoardId: ReturnType<typeof signal>;
    refreshMeshBoardList: ReturnType<typeof vi.fn>;
    deleteMeshBoard: ReturnType<typeof vi.fn>;
  };
  let confirmation: { showDangerConfirm: ReturnType<typeof vi.fn> };

  async function create(): Promise<HTMLElement> {
    stateService = {
      availableMeshBoards: signal([{ rtId: 'b1', name: 'Plant Overview', description: '' }]),
      persistedMeshBoardId: signal<string | null>(null),
      refreshMeshBoardList: vi.fn().mockResolvedValue(undefined),
      deleteMeshBoard: vi.fn().mockResolvedValue(undefined),
    };
    confirmation = { showDangerConfirm: vi.fn().mockResolvedValue(true) };
    TestBed.configureTestingModule({
      imports: [MeshBoardManagerDialogComponent],
      providers: [
        { provide: DialogRef, useValue: { close: vi.fn() } },
        { provide: DialogService, useValue: { open: vi.fn() } },
        { provide: MeshBoardStateService, useValue: stateService },
        { provide: AssetRepoService, useValue: {} },
        { provide: JobManagementService, useValue: {} },
        { provide: ImportStrategyDialogService, useValue: {} },
        { provide: ConfirmationService, useValue: confirmation },
      ],
    });
    const fixture = TestBed.createComponent(MeshBoardManagerDialogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('names every icon-only action (AB#5581 guard)', async () => {
    const el = await create();
    expect(el.querySelector('button[aria-label="Delete MeshBoard Plant Overview"]')).not.toBeNull();
    expectIconButtonsAccessible(el);
  });

  it('deletes only after the danger confirmation naming the board', async () => {
    const el = await create();
    (el.querySelector('button[aria-label="Delete MeshBoard Plant Overview"]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(stateService.deleteMeshBoard).toHaveBeenCalledWith('b1'));
    expect(confirmation.showDangerConfirm).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Delete MeshBoard Plant Overview?',
      targetName: 'Plant Overview',
      confirmText: 'Delete MeshBoard',
    }));
  });

  it('keeps the board when the confirmation is cancelled', async () => {
    const el = await create();
    confirmation.showDangerConfirm.mockResolvedValue(false);
    (el.querySelector('button[aria-label="Delete MeshBoard Plant Overview"]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(confirmation.showDangerConfirm).toHaveBeenCalled());
    await Promise.resolve();
    expect(stateService.deleteMeshBoard).not.toHaveBeenCalled();
  });
});
