import { TestBed } from '@angular/core/testing';
import { DialogRef, DialogService } from '@progress/kendo-angular-dialog';
import { of } from 'rxjs';
import { OperationProgressWindowService } from './operation-progress-window.service';
import { OperationProgressWindowComponent } from './operation-progress-window.component';

describe('OperationProgressWindowService (AB#8448)', () => {
  it('opens the window with the view stream, the actions and merged messages', () => {
    const instance = {} as Partial<OperationProgressWindowComponent>;
    const dialogRef = { content: { instance } } as unknown as DialogRef;
    const open = vi.fn().mockReturnValue(dialogRef);
    TestBed.configureTestingModule({ providers: [{ provide: DialogService, useValue: { open } }] });
    const service = TestBed.inject(OperationProgressWindowService);
    service.defaultMessages = { close: 'Schließen', download: 'Herunterladen' };

    const view = of({ status: 'running' as const, methodLabel: 'Tenant backup' });
    const onDownload = vi.fn();
    const result = service.open({ title: 'Tenant backup · t1', view, onDownload, messages: { download: 'Download now' } });

    expect(result).toBe(dialogRef);
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ title: 'Tenant backup · t1', content: OperationProgressWindowComponent }));
    expect(instance.viewChanges).toBe(view);
    expect(instance.onDownload).toBe(onDownload);
    expect(instance.messages).toEqual({ close: 'Schließen', download: 'Download now' });
  });
});
