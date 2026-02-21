import { TestBed } from '@angular/core/testing';
import { DialogRef, DialogService } from '@progress/kendo-angular-dialog';
import { Subject } from 'rxjs';

import { MessageDetailsDialogService } from './message-details-dialog.service';
import { MessageDetailsDialogData } from './message-details-dialog.component';

describe('MessageDetailsDialogService', () => {
  let service: MessageDetailsDialogService;
  let dialogServiceMock: jasmine.SpyObj<DialogService>;
  let dialogRefMock: jasmine.SpyObj<DialogRef>;

  beforeEach(() => {
    dialogRefMock = jasmine.createSpyObj('DialogRef', ['close'], {
      result: new Subject().asObservable(),
      content: {
        instance: {
          data: null
        }
      }
    });

    dialogServiceMock = jasmine.createSpyObj('DialogService', ['open']);
    dialogServiceMock.open.and.returnValue(dialogRefMock);

    TestBed.configureTestingModule({
      providers: [
        MessageDetailsDialogService,
        { provide: DialogService, useValue: dialogServiceMock }
      ]
    });
    service = TestBed.inject(MessageDetailsDialogService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('showDetailsDialog', () => {
    it('should open dialog with MessageDetailsDialogComponent', () => {
      const data: MessageDetailsDialogData = {
        title: 'Test Title',
        details: 'Test details',
        level: 'error'
      };

      service.showDetailsDialog(data);

      expect(dialogServiceMock.open).toHaveBeenCalled();
    });

    it('should pass data to component instance', () => {
      const data: MessageDetailsDialogData = {
        title: 'Test Title',
        details: 'Test details',
        level: 'warning'
      };

      service.showDetailsDialog(data);

      const component = dialogRefMock.content.instance;
      expect(component.data).toEqual(data);
    });

    it('should return DialogRef', () => {
      const data: MessageDetailsDialogData = {
        title: 'Test Title',
        details: 'Test details',
        level: 'error'
      };

      const result = service.showDetailsDialog(data);

      expect(result).toBe(dialogRefMock);
    });

    it('should open dialog with appropriate dimensions', () => {
      const data: MessageDetailsDialogData = {
        title: 'Test Title',
        details: 'Test details',
        level: 'error'
      };

      service.showDetailsDialog(data);

      const openCall = dialogServiceMock.open.calls.mostRecent().args[0];
      expect(openCall.minWidth).toBe(700);
      expect(openCall.maxWidth).toBe(900);
      expect(openCall.width).toBe('70%');
    });
  });
});
