import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AiJobStatusBadgeComponent } from './ai-job-status-badge.component';

describe('AiJobStatusBadgeComponent', () => {
  let fixture: ComponentFixture<AiJobStatusBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AiJobStatusBadgeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AiJobStatusBadgeComponent);
  });

  it('renders the status text in the badge element', () => {
    fixture.componentRef.setInput('status', 'Running');
    fixture.detectChanges();

    const span = fixture.nativeElement.querySelector('.mm-ai-status-badge');
    expect(span.textContent.trim()).toBe('Running');
    expect(span.classList.contains('mm-ai-status-badge--running')).toBeTrue();
  });

  it('collapses Cancelled into the failed variant', () => {
    fixture.componentRef.setInput('status', 'Cancelled');
    fixture.detectChanges();

    const span = fixture.nativeElement.querySelector('.mm-ai-status-badge');
    expect(span.classList.contains('mm-ai-status-badge--failed')).toBeTrue();
  });

  it('collapses QuotaBlocked / RateLimited into the blocked variant', () => {
    fixture.componentRef.setInput('status', 'QuotaBlocked');
    fixture.detectChanges();
    const span = fixture.nativeElement.querySelector('.mm-ai-status-badge');
    expect(span.classList.contains('mm-ai-status-badge--blocked')).toBeTrue();
  });
});
