import type { MockedObject } from "vitest";
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DialogRef } from '@progress/kendo-angular-dialog';

import { InputDialogComponent } from './input-dialog.component';

describe('InputComponent', () => {
    let component: InputDialogComponent;
    let fixture: ComponentFixture<InputDialogComponent>;
    let mockDialogRef: MockedObject<DialogRef>;

    beforeEach(async () => {
        mockDialogRef = {
            close: vi.fn().mockName("DialogRef.close")
        } as unknown as MockedObject<DialogRef>;

        await TestBed.configureTestingModule({
            imports: [InputDialogComponent],
            providers: [
                provideNoopAnimations(),
                { provide: DialogRef, useValue: mockDialogRef }
            ]
        })
            .compileComponents();

        fixture = TestBed.createComponent(InputDialogComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
