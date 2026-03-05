import { TestBed } from '@angular/core/testing';
import { WindowService, WindowRef } from '@progress/kendo-angular-dialog';
import { Subject } from 'rxjs';

import { MessageDetailsDialogService } from './message-details-dialog.service';
import { MessageDetailsDialogData } from './message-details-dialog.component';

describe('MessageDetailsDialogService', () => {
  let service: MessageDetailsDialogService;
  let windowServiceMock: jasmine.SpyObj<WindowService>;
  let windowRefMock: jasmine.SpyObj<WindowRef>;

  beforeEach(() => {
    windowRefMock = jasmine.createSpyObj('WindowRef', ['close'], {
      result: new Subject().asObservable(),
      content: {
        instance: {
          data: null
        }
      }
    });

    windowServiceMock = jasmine.createSpyObj('WindowService', ['open']);
    windowServiceMock.open.and.returnValue(windowRefMock);

    TestBed.configureTestingModule({
      providers: [
        MessageDetailsDialogService,
        { provide: WindowService, useValue: windowServiceMock }
      ]
    });
    service = TestBed.inject(MessageDetailsDialogService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('showDetailsDialog', () => {
    it('should open window with MessageDetailsDialogComponent', () => {
      const data: MessageDetailsDialogData = {
        title: 'Test Title',
        details: 'Test details',
        level: 'error'
      };

      service.showDetailsDialog(data);

      expect(windowServiceMock.open).toHaveBeenCalled();
    });

    it('should pass data to component instance', () => {
      const data: MessageDetailsDialogData = {
        title: 'Test Title',
        details: 'Test details',
        level: 'warning'
      };

      service.showDetailsDialog(data);

      const component = windowRefMock.content.instance;
      expect(component.data).toEqual(data);
    });

    it('should return WindowRef', () => {
      const data: MessageDetailsDialogData = {
        title: 'Test Title',
        details: 'Test details',
        level: 'error'
      };

      const result = service.showDetailsDialog(data);

      expect(result).toBe(windowRefMock);
    });

    it('should open window with resizable enabled and correct dimensions', () => {
      const data: MessageDetailsDialogData = {
        title: 'Test Title',
        details: 'Test details',
        level: 'error'
      };

      service.showDetailsDialog(data);

      const openCall = windowServiceMock.open.calls.mostRecent().args[0];
      expect(openCall.minWidth).toBe(500);
      expect(openCall.width).toBe(900);
      expect(openCall.resizable).toBe(true);
    });

    it('should set title from data directly', () => {
      const data: MessageDetailsDialogData = {
        title: 'Test Title',
        details: 'Test details',
        level: 'error'
      };

      service.showDetailsDialog(data);

      const openCall = windowServiceMock.open.calls.mostRecent().args[0];
      expect(openCall.title).toBe('Test Title');
    });
  });
});
