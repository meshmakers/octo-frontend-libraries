import {ComponentFixture, TestBed} from '@angular/core/testing';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {MatDialogRef, MAT_DIALOG_DATA} from '@angular/material/dialog';
import {MatSnackBar} from '@angular/material/snack-bar';

import {MmFileUploadComponent} from './mm-file-upload.component';

describe('MmFileUploadComponent', () => {
  let component: MmFileUploadComponent;
  let fixture: ComponentFixture<MmFileUploadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MmFileUploadComponent],
      providers: [
        {provide: MatDialogRef, useValue: jasmine.createSpyObj('MatDialogRef', ['close'])},
        {provide: MAT_DIALOG_DATA, useValue: {mimeTypes: 'image/png', fileExtensions: '.png'}},
        {provide: MatSnackBar, useValue: jasmine.createSpyObj('MatSnackBar', ['open'])}
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MmFileUploadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
