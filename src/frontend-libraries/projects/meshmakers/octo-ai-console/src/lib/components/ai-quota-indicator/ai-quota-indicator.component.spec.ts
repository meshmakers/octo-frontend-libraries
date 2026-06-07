import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AiQuotaIndicatorComponent } from './ai-quota-indicator.component';

describe('AiQuotaIndicatorComponent', () => {
  let fixture: ComponentFixture<AiQuotaIndicatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AiQuotaIndicatorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AiQuotaIndicatorComponent);
  });

  it('renders the daily row with ok state below 80%', () => {
    fixture.componentRef.setInput('dailyConsumed', 100);
    fixture.componentRef.setInput('dailyCap', 1000);
    fixture.detectChanges();

    const bar = fixture.nativeElement.querySelector('.mm-ai-quota__bar');
    expect(bar.classList.contains('mm-ai-quota__bar--ok')).toBeTrue();
  });

  it('flips to warning state at 80% and critical at 100%', () => {
    fixture.componentRef.setInput('dailyConsumed', 800);
    fixture.componentRef.setInput('dailyCap', 1000);
    fixture.detectChanges();
    expect(
      fixture.nativeElement
        .querySelector('.mm-ai-quota__bar')
        .classList.contains('mm-ai-quota__bar--warning'),
    ).toBeTrue();

    fixture.componentRef.setInput('dailyConsumed', 1000);
    fixture.componentRef.setInput('dailyCap', 1000);
    fixture.detectChanges();
    expect(
      fixture.nativeElement
        .querySelector('.mm-ai-quota__bar')
        .classList.contains('mm-ai-quota__bar--critical'),
    ).toBeTrue();
  });

  it('hides the monthly row when the cap is not supplied', () => {
    fixture.componentRef.setInput('dailyConsumed', 0);
    fixture.componentRef.setInput('dailyCap', 1000);
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('.mm-ai-quota__row');
    expect(rows.length).toBe(1);
  });

  it('clamps display to 100% when consumed exceeds cap', () => {
    fixture.componentRef.setInput('dailyConsumed', 2000);
    fixture.componentRef.setInput('dailyCap', 1000);
    fixture.detectChanges();

    const fill = fixture.nativeElement.querySelector('.mm-ai-quota__fill');
    expect(fill.style.width).toBe('100%');
  });
});
