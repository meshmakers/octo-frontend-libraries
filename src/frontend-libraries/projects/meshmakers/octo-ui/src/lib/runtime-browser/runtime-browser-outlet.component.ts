import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Simple outlet component for runtime browser routes.
 * Use as the parent component when mounting runtime browser routes as children.
 */
@Component({
  selector: 'mm-runtime-browser-outlet',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class RuntimeBrowserOutletComponent {}
