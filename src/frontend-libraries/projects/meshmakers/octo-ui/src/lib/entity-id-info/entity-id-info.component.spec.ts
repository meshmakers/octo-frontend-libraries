import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import { SVGIcon } from '@progress/kendo-svg-icons';
import { NotificationDisplayService } from '@meshmakers/shared-ui';
import { EntityIdInfoComponent } from './entity-id-info.component';

/** Mirrors the CopyOption interface from the component for test access */
interface CopyOption {
  label: string;
  value: string;
  displayText: string;
}

/** Interface exposing protected/private members of EntityIdInfoComponent for testing */
interface EntityIdInfoTestAccess {
  copyIcon: SVGIcon;
  copyOptions: CopyOption[];
  truncateValue(value: string, maxLength: number): string;
  copyToClipboard(option: CopyOption): Promise<void>;
}

describe('EntityIdInfoComponent', () => {
  let component: EntityIdInfoComponent;
  let testAccess: EntityIdInfoTestAccess;
  let fixture: ComponentFixture<EntityIdInfoComponent>;
  let notificationServiceMock: jasmine.SpyObj<NotificationDisplayService>;

  const mockRtId = '65d5c447b420da3fb12381bc';
  const mockRtCkTypeId = 'System.Communication/EdgeAdapter';
  const mockCkTypeId = 'System.Communication~2.0.3/EdgeAdapter~1';

  beforeEach(async () => {
    notificationServiceMock = jasmine.createSpyObj('NotificationDisplayService', ['showSuccess', 'showError']);

    await TestBed.configureTestingModule({
      imports: [
        EntityIdInfoComponent,
        ButtonsModule,
        SVGIconModule
      ],
      providers: [
        provideNoopAnimations(),
        { provide: NotificationDisplayService, useValue: notificationServiceMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(EntityIdInfoComponent);
    component = fixture.componentInstance;
    testAccess = component as unknown as EntityIdInfoTestAccess;
  });

  describe('Component creation', () => {
    it('should create the component', () => {
      component.rtId = mockRtId;
      component.rtCkTypeId = mockRtCkTypeId;
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('should have copyIcon defined', () => {
      component.rtId = mockRtId;
      component.rtCkTypeId = mockRtCkTypeId;
      fixture.detectChanges();
      expect(testAccess.copyIcon).toBeDefined();
    });
  });

  describe('Input properties', () => {
    beforeEach(() => {
      component.rtId = mockRtId;
      component.rtCkTypeId = mockRtCkTypeId;
      fixture.detectChanges();
    });

    it('should accept rtId input', () => {
      expect(component.rtId).toBe(mockRtId);
    });

    it('should accept rtCkTypeId input', () => {
      expect(component.rtCkTypeId).toBe(mockRtCkTypeId);
    });

    it('should accept optional ckTypeId input', () => {
      component.ckTypeId = mockCkTypeId;
      expect(component.ckTypeId).toBe(mockCkTypeId);
    });
  });

  describe('Copy options generation', () => {
    beforeEach(() => {
      component.rtId = mockRtId;
      component.rtCkTypeId = mockRtCkTypeId;
      fixture.detectChanges();
    });

    it('should generate 4 copy options', () => {
      const options = testAccess.copyOptions;
      expect(options.length).toBe(4);
    });

    it('should have RtId option as first', () => {
      const options = testAccess.copyOptions;
      expect(options[0].label).toBe('RtId');
      expect(options[0].value).toBe(mockRtId);
    });

    it('should have CkTypeId option as second', () => {
      const options = testAccess.copyOptions;
      expect(options[1].label).toBe('CkTypeId');
    });

    it('should have RtCkTypeId option as third', () => {
      const options = testAccess.copyOptions;
      expect(options[2].label).toBe('RtCkTypeId');
      expect(options[2].value).toBe(mockRtCkTypeId);
    });

    it('should have RtEntityId option as fourth', () => {
      const options = testAccess.copyOptions;
      expect(options[3].label).toBe('RtEntityId');
      expect(options[3].value).toBe(`${mockRtCkTypeId}@${mockRtId}`);
    });

    it('should use ckTypeId for CkTypeId option when provided', () => {
      component.ckTypeId = mockCkTypeId;
      const options = testAccess.copyOptions;
      expect(options[1].value).toBe(mockCkTypeId);
    });

    it('should fallback to rtCkTypeId for CkTypeId option when ckTypeId not provided', () => {
      component.ckTypeId = undefined;
      const options = testAccess.copyOptions;
      expect(options[1].value).toBe(mockRtCkTypeId);
    });

    it('should generate correct RtEntityId format', () => {
      const options = testAccess.copyOptions;
      const rtEntityId = options[3].value;
      expect(rtEntityId).toBe('System.Communication/EdgeAdapter@65d5c447b420da3fb12381bc');
    });
  });

  describe('Value truncation', () => {
    beforeEach(() => {
      component.rtId = mockRtId;
      component.rtCkTypeId = mockRtCkTypeId;
      fixture.detectChanges();
    });

    it('should not truncate short values', () => {
      const result = testAccess.truncateValue('short', 24);
      expect(result).toBe('short');
    });

    it('should truncate values longer than maxLength', () => {
      const longValue = 'this-is-a-very-long-value-that-should-be-truncated';
      const result = testAccess.truncateValue(longValue, 24);
      expect(result.length).toBe(24);
      expect(result.endsWith('...')).toBeTrue();
    });

    it('should truncate at exactly maxLength including ellipsis', () => {
      const longValue = 'abcdefghijklmnopqrstuvwxyz';
      const result = testAccess.truncateValue(longValue, 10);
      expect(result).toBe('abcdefg...');
      expect(result.length).toBe(10);
    });

    it('should return original value when length equals maxLength', () => {
      const exactValue = 'exactly24characters!!!!!';
      const result = testAccess.truncateValue(exactValue, 24);
      expect(result).toBe(exactValue);
    });

    it('should truncate RtId display text correctly', () => {
      const options = testAccess.copyOptions;
      // RtId is 24 chars, which equals maxLength, so no truncation
      expect(options[0].displayText).toBe(mockRtId);
    });

    it('should truncate long RtEntityId display text', () => {
      const options = testAccess.copyOptions;
      const rtEntityId = `${mockRtCkTypeId}@${mockRtId}`;
      // RtEntityId is longer than 40 chars, so should be truncated
      if (rtEntityId.length > 40) {
        expect(options[3].displayText.endsWith('...')).toBeTrue();
        expect(options[3].displayText.length).toBe(40);
      }
    });
  });

  describe('Clipboard copy functionality', () => {
    let clipboardSpy: jasmine.Spy;

    beforeEach(() => {
      component.rtId = mockRtId;
      component.rtCkTypeId = mockRtCkTypeId;
      fixture.detectChanges();

      clipboardSpy = spyOn(navigator.clipboard, 'writeText').and.returnValue(Promise.resolve());
    });

    it('should copy RtId to clipboard', async () => {
      const options = testAccess.copyOptions;
      await testAccess.copyToClipboard(options[0]);

      expect(clipboardSpy).toHaveBeenCalledWith(mockRtId);
    });

    it('should copy CkTypeId to clipboard', async () => {
      component.ckTypeId = mockCkTypeId;
      const options = testAccess.copyOptions;
      await testAccess.copyToClipboard(options[1]);

      expect(clipboardSpy).toHaveBeenCalledWith(mockCkTypeId);
    });

    it('should copy RtCkTypeId to clipboard', async () => {
      const options = testAccess.copyOptions;
      await testAccess.copyToClipboard(options[2]);

      expect(clipboardSpy).toHaveBeenCalledWith(mockRtCkTypeId);
    });

    it('should copy RtEntityId to clipboard', async () => {
      const options = testAccess.copyOptions;
      await testAccess.copyToClipboard(options[3]);

      const expectedRtEntityId = `${mockRtCkTypeId}@${mockRtId}`;
      expect(clipboardSpy).toHaveBeenCalledWith(expectedRtEntityId);
    });

    it('should show success notification after copy', async () => {
      const options = testAccess.copyOptions;
      await testAccess.copyToClipboard(options[0]);

      expect(notificationServiceMock.showSuccess).toHaveBeenCalledWith('RtId copied', 2000);
    });

    it('should show correct label in success notification for each option', async () => {
      const options = testAccess.copyOptions;

      await testAccess.copyToClipboard(options[0]);
      expect(notificationServiceMock.showSuccess).toHaveBeenCalledWith('RtId copied', 2000);

      await testAccess.copyToClipboard(options[1]);
      expect(notificationServiceMock.showSuccess).toHaveBeenCalledWith('CkTypeId copied', 2000);

      await testAccess.copyToClipboard(options[2]);
      expect(notificationServiceMock.showSuccess).toHaveBeenCalledWith('RtCkTypeId copied', 2000);

      await testAccess.copyToClipboard(options[3]);
      expect(notificationServiceMock.showSuccess).toHaveBeenCalledWith('RtEntityId copied', 2000);
    });

    it('should show error notification when clipboard fails', async () => {
      clipboardSpy.and.returnValue(Promise.reject(new Error('Clipboard error')));

      const options = testAccess.copyOptions;
      await testAccess.copyToClipboard(options[0]);

      expect(notificationServiceMock.showError).toHaveBeenCalledWith('Failed to copy to clipboard');
    });

    it('should log error to console when clipboard fails', async () => {
      const consoleSpy = spyOn(console, 'error');
      const error = new Error('Clipboard error');
      clipboardSpy.and.returnValue(Promise.reject(error));

      const options = testAccess.copyOptions;
      await testAccess.copyToClipboard(options[0]);

      expect(consoleSpy).toHaveBeenCalledWith('Failed to copy to clipboard:', error);
    });
  });

  describe('Component rendering', () => {
    beforeEach(() => {
      component.rtId = mockRtId;
      component.rtCkTypeId = mockRtCkTypeId;
      fixture.detectChanges();
    });

    it('should render dropdown button', () => {
      const dropdownButton = fixture.nativeElement.querySelector('kendo-dropdownbutton');
      expect(dropdownButton).toBeTruthy();
    });

    it('should have "Copy ID" button text', () => {
      const dropdownButton = fixture.nativeElement.querySelector('kendo-dropdownbutton');
      expect(dropdownButton.textContent).toContain('Copy ID');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty rtId', () => {
      component.rtId = '';
      component.rtCkTypeId = mockRtCkTypeId;
      fixture.detectChanges();

      const options = testAccess.copyOptions;
      expect(options[0].value).toBe('');
      expect(options[3].value).toBe(`${mockRtCkTypeId}@`);
    });

    it('should handle empty rtCkTypeId', () => {
      component.rtId = mockRtId;
      component.rtCkTypeId = '';
      fixture.detectChanges();

      const options = testAccess.copyOptions;
      expect(options[2].value).toBe('');
      expect(options[3].value).toBe(`@${mockRtId}`);
    });

    it('should handle special characters in IDs', () => {
      component.rtId = 'id-with-special_chars.123';
      component.rtCkTypeId = 'Namespace/Type~With~Tilde';
      fixture.detectChanges();

      const options = testAccess.copyOptions;
      expect(options[0].value).toBe('id-with-special_chars.123');
      expect(options[2].value).toBe('Namespace/Type~With~Tilde');
    });
  });
});
