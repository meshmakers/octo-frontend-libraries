import { convertToParamMap } from '@angular/router';
import { urlWithoutEditParam, wantsEditModeFromUrl } from './edit-mode-url';

describe('edit-mode-url', () => {
  it('enters edit mode for edit=1 on an editable route only', () => {
    expect(wantsEditModeFromUrl(convertToParamMap({ edit: '1' }), false, false)).toBe(true);
    expect(wantsEditModeFromUrl(convertToParamMap({ edit: '1' }), true, false)).toBe(false); // read-only route
    expect(wantsEditModeFromUrl(convertToParamMap({ edit: '1' }), false, true)).toBe(false); // already editing
    expect(wantsEditModeFromUrl(convertToParamMap({ edit: '0' }), false, false)).toBe(false);
    expect(wantsEditModeFromUrl(convertToParamMap({}), false, false)).toBe(false);
  });

  it('removes only the edit parameter from the URL', () => {
    expect(urlWithoutEditParam('/t1/ui/meshboards/b1?edit=1')).toBe('/t1/ui/meshboards/b1');
    expect(urlWithoutEditParam('/t1/ui/meshboards/b1?tf_type=year&edit=1&es_x=r1#w')).toBe('/t1/ui/meshboards/b1?tf_type=year&es_x=r1#w');
    expect(urlWithoutEditParam('/t1/ui/meshboards/b1?tf_type=year')).toBeNull();
    expect(urlWithoutEditParam('/t1/ui/meshboards/b1')).toBeNull();
  });
});
