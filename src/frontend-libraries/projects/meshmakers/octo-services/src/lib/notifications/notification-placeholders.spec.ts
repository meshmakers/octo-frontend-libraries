import { placeholderList, unknownNotificationPlaceholders as unknownPlaceholders } from './notification-placeholders';

describe('notification placeholders', () => {
  const columns = ['name', 'employee.firstName'];

  it('accepts the query columns in the body, ignoring case and surrounding spaces', () => {
    expect(unknownPlaceholders('New rows', 'Hello ${ NAME } ${employee.firstname}', columns)).toEqual([]);
  });

  it('accepts ${count} in the subject and in the body', () => {
    expect(unknownPlaceholders('${count} new', '${Count} rows', columns)).toEqual([]);
  });

  it('reports a column the query does not return', () => {
    expect(unknownPlaceholders('New rows', '${name} ${doesNotExist}', columns)).toEqual(['doesNotExist']);
  });

  it('reports a column used in the subject, which knows only ${count}', () => {
    expect(unknownPlaceholders('New: ${name}', '${name}', columns)).toEqual(['name']);
  });

  it('reports each unknown placeholder once, in order of first use', () => {
    expect(unknownPlaceholders('${b}', '${a} ${B} ${a}', [])).toEqual(['b', 'a']);
  });

  it('does not let an unterminated ${ swallow the placeholders after it', () => {
    expect(unknownPlaceholders(null, 'Price ${ and ${missing}', columns)).toEqual(['missing']);
  });

  it('reads missing texts as empty', () => {
    expect(unknownPlaceholders(undefined, null, columns)).toEqual([]);
  });

  it('lists placeholders the way a message names them', () => {
    expect(placeholderList(['count', 'name'])).toBe('${count}, ${name}');
  });
});
