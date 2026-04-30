import { BRANDING_ROUTES } from './branding-settings.routes';

describe('BRANDING_ROUTES', () => {
  it('has a single root route with loadComponent', () => {
    expect(BRANDING_ROUTES.length).toBe(1);
    expect(BRANDING_ROUTES[0].path).toBe('');
    expect(typeof BRANDING_ROUTES[0].loadComponent).toBe('function');
  });

  it('loadComponent resolves to SettingsPageComponent', async () => {
    const ctor = await BRANDING_ROUTES[0].loadComponent!();
    expect(ctor).toBeDefined();
    expect((ctor as { name: string }).name).toBe('SettingsPageComponent');
  });
});
