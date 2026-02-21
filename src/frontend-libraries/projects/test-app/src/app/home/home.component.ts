import { Component } from '@angular/core';
import { Router } from '@angular/router';

interface DemoRoute {
  path: string;
  title: string;
  description: string;
  icon: string;
  color: string;
}

@Component({
  selector: 'app-home',
  standalone: false,
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent {
  demoRoutes: DemoRoute[] = [
    {
      path: '/table-demo',
      title: 'Table Demonstrations',
      description: 'Explore various table implementations including simple tables, advanced tables with actions, and virtual columns.',
      icon: 'table_chart',
      color: '#2196F3'
    },
    {
      path: '/error-demo',
      title: 'Error Message Dialogs',
      description: 'Test error notification dialogs with different message lengths, formats, and copy-to-clipboard functionality.',
      icon: 'error_outline',
      color: '#F44336'
    },
    {
      path: '/file-upload-demo',
      title: 'File Upload',
      description: 'Upload files with support for ZIP, JSON, and YAML formats. Includes progress feedback and error handling.',
      icon: 'upload_file',
      color: '#4CAF50'
    },
  ];

  constructor(private router: Router) {}

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }
}