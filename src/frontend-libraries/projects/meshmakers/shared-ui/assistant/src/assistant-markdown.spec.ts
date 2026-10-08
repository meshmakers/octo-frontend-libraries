import { classifyAssistantHref, renderAssistantMarkdown } from './assistant-markdown';

describe('renderAssistantMarkdown', () => {
  it('renders ordinary markdown', () => {
    expect(renderAssistantMarkdown('**bold** and `code`')).toContain('<strong>bold</strong> and <code>code</code>');
  });

  it('shows raw HTML as text: no script, no event handlers', () => {
    const html = renderAssistantMarkdown('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
  });

  it('never renders images; a safe source becomes a link with the alt text', () => {
    const html = renderAssistantMarkdown('![chart](https://evil.example/pixel.png) ![x](javascript:alert(1)) ![](data:image/png;base64,AAA)');
    expect(html).not.toContain('<img');
    expect(html).toContain('<a href="https://evil.example/pixel.png" target="_blank" rel="noopener noreferrer">chart</a>');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('data:');
    expect(html).toContain('image');
  });

  it('keeps safe links and marks external ones', () => {
    expect(renderAssistantMarkdown('[docs](https://docs.example "Docs")'))
      .toContain('<a href="https://docs.example" title="Docs" target="_blank" rel="noopener noreferrer">docs</a>');
    expect(renderAssistantMarkdown('[adapter](/meshmakers/communication/adapters)'))
      .toContain('<a href="/meshmakers/communication/adapters">adapter</a>');
  });

  it('turns javascript:, data: and obfuscated schemes into plain labels', () => {
    for (const href of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<b>x</b>', 'vbscript:x']) {
      const html = renderAssistantMarkdown(`[click](${href})`);
      expect(html).not.toContain('<a');
      expect(html).toContain('click');
    }
    expect(renderAssistantMarkdown('<javascript:alert(1)>')).not.toContain('href="javascript');
    expect(renderAssistantMarkdown('[click](/\\evil.example)')).not.toContain('<a');
  });
});

describe('classifyAssistantHref', () => {
  it('classifies targets', () => {
    expect(classifyAssistantHref('https://x')).toBe('external');
    expect(classifyAssistantHref('mailto:a@b.c')).toBe('external');
    expect(classifyAssistantHref('/t/page')).toBe('relative');
    expect(classifyAssistantHref('#anchor')).toBe('relative');
    expect(classifyAssistantHref('java\nscript:alert(1)')).toBe('unsafe');
    expect(classifyAssistantHref('//evil.example')).toBe('unsafe');
    // Backslashes count as slashes in http(s) URLs: these are protocol-relative too.
    expect(classifyAssistantHref('/\\evil.example')).toBe('unsafe');
    expect(classifyAssistantHref('\\\\evil.example')).toBe('unsafe');
    expect(classifyAssistantHref('\\/evil.example')).toBe('unsafe');
    expect(classifyAssistantHref('/t/a\\b')).toBe('relative');
    expect(classifyAssistantHref('')).toBe('unsafe');
  });
});
