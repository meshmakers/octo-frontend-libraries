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
    // Identity, not `.name`: the bundler renames the class expression to avoid a symbol
    // collision, so `.name` reports whatever suffix it picked rather than the source name.
    const { SettingsPageComponent } = await import('./settings-page.component');
    expect(ctor).toBe(SettingsPageComponent);
  });
});
