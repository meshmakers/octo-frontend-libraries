import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AiSessionListComponent } from './ai-session-list.component';
import { AiSessionDto } from '../../models/ai-session';

describe('AiSessionListComponent', () => {
  let fixture: ComponentFixture<AiSessionListComponent>;

  const session = (sessionRtId: string, startedAt: string): AiSessionDto => ({
    sessionRtId,
    jobRtId: `job-${sessionRtId}`,
    goalSummary: `Goal ${sessionRtId}`,
    status: 'Running',
    startedAt,
    tokensConsumed: 0,
    ownerUserId: 'user-1',
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AiSessionListComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(AiSessionListComponent);
  });

  it('renders the empty state when there are no sessions', () => {
    fixture.componentRef.setInput('sessions', []);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('.mm-ai-session-list__empty'),
    ).not.toBeNull();
  });

  it('orders sessions by startedAt descending (newest first)', () => {
    const sessions = [
      session('a', '2026-01-01T00:00:00Z'),
      session('b', '2026-01-03T00:00:00Z'),
      session('c', '2026-01-02T00:00:00Z'),
    ];
    fixture.componentRef.setInput('sessions', sessions);
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll(
      '.mm-ai-session-list__row',
    );
    expect(rows.length).toBe(3);
    // Goal text mirrors the rtId — so the first rendered row should be 'Goal b'.
    expect(rows[0].textContent).toContain('Goal b');
    expect(rows[1].textContent).toContain('Goal c');
    expect(rows[2].textContent).toContain('Goal a');
  });

  it('emits select with the rtId on row click', (done) => {
    fixture.componentRef.setInput('sessions', [
      session('a', '2026-01-01T00:00:00Z'),
    ]);
    fixture.detectChanges();

    fixture.componentInstance.sessionSelected.subscribe((rtId: string) => {
      expect(rtId).toBe('a');
      done();
    });

    fixture.nativeElement
      .querySelector('.mm-ai-session-list__button')
      .click();
  });
});
