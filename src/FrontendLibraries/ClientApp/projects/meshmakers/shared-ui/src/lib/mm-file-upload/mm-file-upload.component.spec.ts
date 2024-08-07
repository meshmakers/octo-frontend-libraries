import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MmFileUploadComponent } from './mm-file-upload.component';

describe('MmFileUploadComponent', () => {
  let component: MmFileUploadComponent;
  let fixture: ComponentFixture<MmFileUploadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MmFileUploadComponent]
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
