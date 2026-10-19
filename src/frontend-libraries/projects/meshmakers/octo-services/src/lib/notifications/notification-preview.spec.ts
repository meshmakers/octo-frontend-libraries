import { renderNotificationPreview } from './notification-preview';

const COLUMNS = ['name', 'info', 'startTime'];
const standIn = (column: string): string => `[${column}]`;

describe('renderNotificationPreview', () => {
  it('fills ${count} in the subject with the total and leaves anything else standing', () => {
    const preview = renderNotificationPreview('${count} failed ${name}', '', {
      columns: COLUMNS, rows: [{ name: 'x' }], totalCount: 7, markup: false, standIn
    });

    expect(preview.subject).toBe('7 failed ${name}');
  });

  it('writes one body block per row, separated by a blank line, like the engine', () => {
    const preview = renderNotificationPreview('', '${NAME}: ${info} (${count})', {
      columns: COLUMNS,
      rows: [{ name: 'EC_REQ_ONL', info: 'rejected' }, { Name: 'CM_REV_SP', info: null }],
      totalCount: 2,
      markup: false,
      standIn
    });

    expect(preview.body).toBe('EC_REQ_ONL: rejected (2)\n\nCM_REV_SP:  (2)');
  });

  it('shows the stand-ins as one row, counted as one, when the query returns no rows', () => {
    const preview = renderNotificationPreview('${count} failed', '${name} - ${info}', {
      columns: COLUMNS, rows: [], totalCount: 0, markup: false, standIn
    });

    expect(preview.subject).toBe('1 failed');
    expect(preview.body).toBe('[name] - [info]');
  });

  it('keeps a token that is no column, so the preview shows what the send would refuse', () => {
    const preview = renderNotificationPreview('', '${name} ${unknown}', {
      columns: COLUMNS, rows: [{ name: 'x' }], totalCount: 1, markup: false, standIn
    });

    expect(preview.body).toBe('x ${unknown}');
  });

  it('formats a date-time cell as yyyy-MM-dd HH:mm in local time', () => {
    const at = new Date(2026, 9, 19, 8, 5);
    const preview = renderNotificationPreview('', '${startTime}', {
      columns: COLUMNS, rows: [{ startTime: at.toISOString() }], totalCount: 1, markup: false, standIn
    });

    expect(preview.body).toBe('2026-10-19 08:05');
  });

  it('encodes values for a markup body so a value cannot inject markup or markdown', () => {
    const preview = renderNotificationPreview('', '<p>${info}</p>', {
      columns: COLUMNS, rows: [{ info: '<b>*x*</b> & y' }], totalCount: 1, markup: true, standIn
    });

    expect(preview.body).toBe('<p>&lt;b&gt;&#42;x&#42;&lt;/b&gt; &amp; y</p>');
  });

  it('leaves a plain body unencoded', () => {
    const preview = renderNotificationPreview('', '${info}', {
      columns: COLUMNS, rows: [{ info: '<b>x</b>' }], totalCount: 1, markup: false, standIn
    });

    expect(preview.body).toBe('<b>x</b>');
  });
});
