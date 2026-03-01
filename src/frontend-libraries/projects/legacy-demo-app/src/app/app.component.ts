import { Component, inject } from "@angular/core";
import { Router } from "@angular/router";
import { AuthorizeService } from '@meshmakers/shared-auth';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-root',
  standalone: false,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'Legacy UI Showcase';
  protected readonly authService = inject(AuthorizeService);

  navItems: NavItem[] = [
    { path: '/home', label: 'Home', icon: 'home' },
    { path: '/confirmation-demo', label: 'Confirmation', icon: 'help_outline' },
    { path: '/progress-demo', label: 'Progress', icon: 'hourglass_empty' },
    { path: '/details-demo', label: 'Details & Validation', icon: 'assignment' },
    { path: '/table-demo', label: 'Data Table', icon: 'table_chart' },
    { path: '/entity-select-demo', label: 'Entity Select', icon: 'search' },
    { path: '/error-demo', label: 'Error Notifications', icon: 'error_outline' },
    { path: '/file-upload-demo', label: 'File Upload', icon: 'upload_file' },
  ];

  constructor(private router: Router) {}

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }

  isActive(path: string): boolean {
    return this.router.url === path;
  }

  onLogin(): void {
    this.authService.login();
  }

  onLogout(): void {
    this.authService.logout();
  }
}
