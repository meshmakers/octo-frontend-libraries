import { firstNameOf, greetingPhrase, homeGreeting, homeMeta } from './home-greeting';

function at(hour: number): Date {
  return new Date(2026, 9, 6, hour, 30);
}

describe('home-greeting', () => {
  it('picks the phrase by the local hour', () => {
    expect(greetingPhrase(at(4))).toBe('Good evening');
    expect(greetingPhrase(at(5))).toBe('Good morning');
    expect(greetingPhrase(at(11))).toBe('Good morning');
    expect(greetingPhrase(at(12))).toBe('Good afternoon');
    expect(greetingPhrase(at(17))).toBe('Good afternoon');
    expect(greetingPhrase(at(18))).toBe('Good evening');
    expect(greetingPhrase(at(23))).toBe('Good evening');
  });

  it('prefers the given_name claim', () => {
    expect(firstNameOf({ given_name: ' Gerald ' }, 'Somebody Else')).toBe('Gerald');
  });

  it('falls back to the first word of the display name', () => {
    expect(firstNameOf({ given_name: null }, 'Gerald Lochner')).toBe('Gerald');
    expect(firstNameOf(null, '  ')).toBeNull();
    expect(firstNameOf(null, null)).toBeNull();
  });

  it('greets with or without a name', () => {
    expect(homeGreeting({ given_name: 'Gerald' }, null, at(9))).toBe('Good morning, Gerald');
    expect(homeGreeting(null, null, at(20))).toBe('Good evening');
  });

  it('names the tenant in the meta line', () => {
    expect(homeMeta('meshmakers')).toEqual([{ label: 'Tenant', value: 'meshmakers' }]);
    expect(homeMeta(null)).toEqual([]);
  });

  it('uses translated messages', () => {
    const messages = { greetingMorning: 'Guten Morgen', greetingWithName: '{greeting} {name}!', tenant: 'Mandant' };
    expect(homeGreeting({ given_name: 'Gerald' }, null, at(9), messages)).toBe('Guten Morgen Gerald!');
    expect(greetingPhrase(at(20), messages)).toBe('Good evening');
    expect(homeMeta('meshmakers', messages)).toEqual([{ label: 'Mandant', value: 'meshmakers' }]);
  });
});
