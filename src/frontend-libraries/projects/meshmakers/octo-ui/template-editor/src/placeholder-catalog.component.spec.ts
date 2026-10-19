import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlaceholderCatalogComponent } from './placeholder-catalog.component';
import { TemplatePlaceholderGroup } from './template-placeholders';

const GROUPS: TemplatePlaceholderGroup[] = [
  {
    id: 'customer',
    label: 'Kunde',
    placeholders: [
      { token: '${customer.firstName}', label: 'Vorname', sample: 'Max' },
      { token: '${customer.lastName}', label: 'Nachname', sample: 'Muster' },
      { token: '${customer.iban}', label: 'IBAN', note: 'Nur bei Abrechnung' }
    ]
  },
  {
    id: 'community',
    label: 'Gemeinschaft',
    placeholders: [{ token: '${community.name}', label: 'Name', sample: 'EEG Sonnenfeld' }]
  }
];

describe('PlaceholderCatalogComponent', () => {
  let fixture: ComponentFixture<PlaceholderCatalogComponent>;
  let el: HTMLElement;

  function render(groups: TemplatePlaceholderGroup[] = GROUPS, templateText = ''): void {
    fixture.componentRef.setInput('groups', groups);
    fixture.componentRef.setInput('templateText', templateText);
    fixture.detectChanges();
  }

  function entries(): string[] {
    return [...el.querySelectorAll('.entry-token')].map(token => token.textContent?.trim() ?? '');
  }

  function rail(): string[] {
    return [...el.querySelectorAll('.group-name')].map(name => name.textContent?.trim() ?? '');
  }

  function search(term: string): void {
    const input = el.querySelector('.panel-search input') as HTMLInputElement;
    input.value = term;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PlaceholderCatalogComponent] }).compileComponents();
    fixture = TestBed.createComponent(PlaceholderCatalogComponent);
    el = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => fixture.destroy());

  it('opens on the first group so the entry list is never empty', () => {
    render();

    expect(entries()).toEqual(['${customer.firstName}', '${customer.lastName}', '${customer.iban}']);
  });

  it('switches the list when another group is selected', () => {
    render();

    (el.querySelectorAll('.group-item')[1] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(entries()).toEqual(['${community.name}']);
  });

  it('shows no group rail for a single group', () => {
    render([GROUPS[1]]);

    expect(el.querySelector('.group-rail')).toBeNull();
    expect(entries()).toEqual(['${community.name}']);
  });

  it('shows the label, the sample and the note of an entry', () => {
    render();

    const text = el.querySelector('.entry-list')?.textContent ?? '';
    expect(text).toContain('Vorname');
    expect(text).toContain('Max');
    expect(text).toContain('Nur bei Abrechnung');
  });

  it('matches the label as well as the token, ignoring case', () => {
    render();

    search('NACHNAME');

    expect(entries()).toEqual(['${customer.lastName}']);
  });

  it('jumps to the group holding the match and hides groups without one', () => {
    render();

    search('sonnen');
    expect(entries()).toEqual([]);

    search('community');
    expect(rail()).toEqual(['Gemeinschaft']);
    expect(entries()).toEqual(['${community.name}']);
  });

  it('reports no results rather than silently showing an empty list, and clears the search', () => {
    render();

    search('nothing-like-this');
    expect(el.querySelector('.panel-empty-title')?.textContent).toContain('nothing-like-this');

    (el.querySelector('.panel-empty-action') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(entries().length).toBe(3);
  });

  it('counts every occurrence already in the template, and only of this token', () => {
    render(GROUPS, '${customer.firstName} ${customer.firstName} ${customer.firstNameX}');

    const usage = [...el.querySelectorAll('.entry-usage')].map(badge => badge.textContent?.trim());
    expect(usage).toEqual(['2×']);
  });

  it('keeps an unavailable group in the rail, opens on the first available one and explains the other', () => {
    render([{ ...GROUPS[0], unavailable: 'Not filled in this template' }, GROUPS[1]]);

    expect(rail()).toEqual(['Kunde', 'Gemeinschaft']);
    expect(entries()).toEqual(['${community.name}']);

    (el.querySelectorAll('.group-item')[0] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('.group-unavailable')?.textContent).toContain('Not filled in this template');
  });

  it('inserts nothing from an unavailable group', () => {
    render([{ ...GROUPS[0], unavailable: 'Not filled in this template' }]);
    const picked: string[] = [];
    fixture.componentInstance.insertPlaceholder.subscribe(token => picked.push(token));

    (el.querySelector('.entry') as HTMLButtonElement).click();

    expect(picked).toEqual([]);
    expect(el.querySelector('.entry')?.getAttribute('aria-disabled')).toBe('true');
  });

  it('shows only the last step of a navigating token, the whole token in its tooltip', () => {
    const token = '${relatesTo.basicEnergyMeteringPoint->customer.energyCommunityCustomer->contact.firstName}';
    render([{ id: 'eda', label: 'EDA-Prozess', placeholders: [{ token, label: 'Kunde · Vorname' }] }]);

    expect(entries()).toEqual(['${…contact.firstName}']);
    expect(el.querySelector('.entry')?.getAttribute('title')).toBe(token);
  });

  it('emits the token and confirms it on screen', () => {
    render();
    const picked: string[] = [];
    fixture.componentInstance.insertPlaceholder.subscribe(token => picked.push(token));

    (el.querySelector('.entry') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(picked).toEqual(['${customer.firstName}']);
    expect(el.querySelector('.panel-inserted')?.textContent).toContain('${customer.firstName}');
  });
});
