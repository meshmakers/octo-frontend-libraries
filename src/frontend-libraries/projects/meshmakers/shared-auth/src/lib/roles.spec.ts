import { Roles } from './roles';

describe('Roles', () => {
  // The values are the role names the identity service puts into the `role` claim; a typo here
  // silently hides a page, so they are pinned against the names seeded by System.Identity.Bootstrap.
  it('exposes the platform file roles next to the reporting roles (AB#6171 D5)', () => {
    expect(Roles.FileViewer).toBe('FileViewer');
    expect(Roles.FileManagement).toBe('FileManagement');
    expect(Roles.ReportingViewer).toBe('ReportingViewer');
    expect(Roles.ReportingManagement).toBe('ReportingManagement');
  });
});
