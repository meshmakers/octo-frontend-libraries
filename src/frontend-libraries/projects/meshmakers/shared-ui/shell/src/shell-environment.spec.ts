import { shellEnvironmentChip } from './shell-environment';

describe('shellEnvironmentChip', () => {
  it('maps the tenant modes to label, short label and status', () => {
    expect(shellEnvironmentChip('PRODUCTION')).toEqual({ label: 'Production', short: 'Prod', status: 'error', production: true });
    expect(shellEnvironmentChip('STAGING')).toEqual({ label: 'Staging', short: 'Stage', status: 'warning' });
    expect(shellEnvironmentChip('DEVELOPMENT')).toEqual({ label: 'Development', short: 'Dev', status: 'success' });
    expect(shellEnvironmentChip('TESTING')).toEqual({ label: 'Testing', short: 'Test', status: 'info' });
    expect(shellEnvironmentChip('unknown')).toEqual({ label: 'Environment unknown', short: 'Env?', status: 'neutral' });
    expect(shellEnvironmentChip(null).status).toBe('neutral');
  });

  it('uses translated labels', () => {
    expect(shellEnvironmentChip('STAGING', { environmentStaging: 'Staging-Umgebung' }).label).toBe('Staging-Umgebung');
  });
});
