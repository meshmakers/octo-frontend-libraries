import { ThemeGradient, ThemePalette } from './theme.models';

describe('theme.models', () => {
  it('ThemeGradient shape compiles with startColor + endColor', () => {
    const g: ThemeGradient = { startColor: '#000', endColor: '#fff' };
    expect(g.startColor).toBe('#000');
    expect(g.endColor).toBe('#fff');
  });

  it('ThemePalette shape includes all required color fields and gradients', () => {
    const p: ThemePalette = {
      primaryColor: '#1',
      secondaryColor: '#2',
      tertiaryColor: '#3',
      neutralColor: '#4',
      backgroundColor: '#5',
      headerGradient: { startColor: '#a', endColor: '#b' },
      footerGradient: { startColor: '#c', endColor: '#d' },
    };
    expect(p.primaryColor).toBe('#1');
    expect(p.headerGradient.endColor).toBe('#b');
    expect(p.footerGradient.startColor).toBe('#c');
  });
});
