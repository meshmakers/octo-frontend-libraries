import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Demo shell of `@meshmakers/octo-ui/entity-forms`: a short explanation above the
 * `<mm-entity-page>` routes (list / new / :rtId) for the SFTP configuration form.
 */
@Component({
  selector: 'app-entity-forms-demo',
  standalone: true,
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="entity-forms-demo">
      <p class="intro">
        <code>&lt;mm-entity-page&gt;</code> rendered by <code>entityFormRoutes(&#123; formKey: 'sftp-configuration' &#125;)</code>.
        The form layout comes from the tenant's <code>System.UI/EntityForm</code> definitions (seeded
        <code>form-sftp-configuration</code>), falling back to the built-in default form when System.UI
        is not installed. Secrets (password, private key) are write-only.
      </p>
      <div class="page">
        <router-outlet />
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .entity-forms-demo { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .intro { margin: 8px 16px 0; opacity: 0.8; }
    .page { flex: 1 1 auto; min-height: 0; }
  `],
})
export class EntityFormsDemoComponent {}
