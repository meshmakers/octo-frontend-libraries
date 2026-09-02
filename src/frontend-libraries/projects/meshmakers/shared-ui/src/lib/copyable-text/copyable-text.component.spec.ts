import type { MockedObject } from "vitest";
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { CopyableTextComponent } from './copyable-text.component';
import { NotificationDisplayService } from '../services/notification-display.service';
import { By } from '@angular/platform-browser';

describe('CopyableTextComponent', () => {
    let component: CopyableTextComponent;
    let fixture: ComponentFixture<CopyableTextComponent>;
    let notificationServiceSpy: MockedObject<NotificationDisplayService>;

    beforeEach(async () => {
        notificationServiceSpy = {
            showSuccess: vi.fn().mockName("NotificationDisplayService.showSuccess"),
            showError: vi.fn().mockName("NotificationDisplayService.showError")
        } as unknown as MockedObject<NotificationDisplayService>;

        await TestBed.configureTestingModule({
            imports: [CopyableTextComponent],
            providers: [
                { provide: NotificationDisplayService, useValue: notificationServiceSpy }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(CopyableTextComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        component.value = 'test-value';
        fixture.detectChanges();
        expect(component).toBeTruthy();
    });

    it('should display the value when provided', () => {
        component.value = 'my-test-value';
        fixture.detectChanges();

        const valueElement = fixture.debugElement.query(By.css('.value'));
        expect(valueElement.nativeElement.textContent).toContain('my-test-value');
    });

    it('should display em-dash when value is null', () => {
        component.value = null;
        fixture.detectChanges();

        const valueElement = fixture.debugElement.query(By.css('.value'));
        expect(valueElement.nativeElement.textContent).toContain('—');
    });

    it('should display em-dash when value is undefined', () => {
        component.value = undefined;
        fixture.detectChanges();

        const valueElement = fixture.debugElement.query(By.css('.value'));
        expect(valueElement.nativeElement.textContent).toContain('—');
    });

    it('should display em-dash when value is empty string', () => {
        component.value = '';
        fixture.detectChanges();

        const valueElement = fixture.debugElement.query(By.css('.value'));
        expect(valueElement.nativeElement.textContent).toContain('—');
    });

    it('should display em-dash when value is whitespace only', () => {
        component.value = '   ';
        fixture.detectChanges();

        const valueElement = fixture.debugElement.query(By.css('.value'));
        expect(valueElement.nativeElement.textContent).toContain('—');
    });

    it('should display label when provided', () => {
        component.value = 'test';
        component.label = 'My Label';
        fixture.detectChanges();

        const labelElement = fixture.debugElement.query(By.css('.label'));
        expect(labelElement).toBeTruthy();
        expect(labelElement.nativeElement.textContent).toContain('My Label');
    });

    it('should not display label when not provided', () => {
        component.value = 'test';
        fixture.detectChanges();

        const labelElement = fixture.debugElement.query(By.css('.label'));
        expect(labelElement).toBeNull();
    });

    it('should show copy button when value is present', () => {
        component.value = 'test-value';
        fixture.detectChanges();

        const copyButton = fixture.debugElement.query(By.css('.copy-button'));
        expect(copyButton).toBeTruthy();
    });

    it('should hide copy button when value is empty', () => {
        component.value = null;
        fixture.detectChanges();

        const copyButton = fixture.debugElement.query(By.css('.copy-button'));
        expect(copyButton).toBeNull();
    });

    it('should copy value to clipboard and show notification on button click', fakeAsync(() => {
        component.value = 'test-value';
        component.copyLabel = 'Test Label';
        fixture.detectChanges();

        // Mock clipboard API
        const clipboardSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();

        const copyButton = fixture.debugElement.query(By.css('.copy-button'));
        copyButton.nativeElement.click();
        tick();

        expect(clipboardSpy).toHaveBeenCalledWith('test-value');
        expect(notificationServiceSpy.showSuccess).toHaveBeenCalledWith('Test Label copied to clipboard', 2000);
    }));

    it('should use label as notification text when copyLabel is not provided', fakeAsync(() => {
        component.value = 'test-value';
        component.label = 'My Label';
        fixture.detectChanges();

        vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();

        const copyButton = fixture.debugElement.query(By.css('.copy-button'));
        copyButton.nativeElement.click();
        tick();

        expect(notificationServiceSpy.showSuccess).toHaveBeenCalledWith('My Label copied to clipboard', 2000);
    }));

    it('should use "Value" as notification text when neither copyLabel nor label is provided', fakeAsync(() => {
        component.value = 'test-value';
        fixture.detectChanges();

        vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();

        const copyButton = fixture.debugElement.query(By.css('.copy-button'));
        copyButton.nativeElement.click();
        tick();

        expect(notificationServiceSpy.showSuccess).toHaveBeenCalledWith('Value copied to clipboard', 2000);
    }));

    it('should emit copied event on successful copy', fakeAsync(() => {
        component.value = 'test-value';
        fixture.detectChanges();

        vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
        const copiedSpy = vi.spyOn(component.copied, 'emit').mockReturnValue(undefined);

        const copyButton = fixture.debugElement.query(By.css('.copy-button'));
        copyButton.nativeElement.click();
        tick();

        expect(copiedSpy).toHaveBeenCalledWith('test-value');
    }));

    it('should show error notification when clipboard write fails', fakeAsync(() => {
        component.value = 'test-value';
        fixture.detectChanges();

        vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('Clipboard error'));
        vi.spyOn(console, 'error').mockReturnValue(undefined);

        const copyButton = fixture.debugElement.query(By.css('.copy-button'));
        copyButton.nativeElement.click();
        tick();

        expect(notificationServiceSpy.showError).toHaveBeenCalledWith('Failed to copy to clipboard');
    }));

    it('should not emit copied event when clipboard write fails', fakeAsync(() => {
        component.value = 'test-value';
        fixture.detectChanges();

        vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('Clipboard error'));
        vi.spyOn(console, 'error').mockReturnValue(undefined);
        const copiedSpy = vi.spyOn(component.copied, 'emit').mockReturnValue(undefined);

        const copyButton = fixture.debugElement.query(By.css('.copy-button'));
        copyButton.nativeElement.click();
        tick();

        expect(copiedSpy).not.toHaveBeenCalled();
    }));

    it('should have correct button title', () => {
        component.value = 'test-value';
        component.buttonTitle = 'Custom tooltip';
        fixture.detectChanges();

        const copyButton = fixture.debugElement.query(By.css('.copy-button'));
        expect(copyButton.nativeElement.getAttribute('title')).toBe('Custom tooltip');
    });

    it('should use default button title when not specified', () => {
        component.value = 'test-value';
        fixture.detectChanges();

        const copyButton = fixture.debugElement.query(By.css('.copy-button'));
        expect(copyButton.nativeElement.getAttribute('title')).toBe('Copy to clipboard');
    });
});
