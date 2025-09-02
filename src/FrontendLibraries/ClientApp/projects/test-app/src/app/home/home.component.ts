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
    {
      path: '/nfc-demo',
      title: 'NFC Scanner',
      description: 'Scan NFC tags to extract serial numbers, employee IDs, and messages with MACO-specific data parsing.',
      icon: 'nfc',
      color: '#FF9800'
    },
    {
      path: '/qr-demo',
      title: 'QR Code Scanner',
      description: 'Scan QR codes with dialog or inline modes. Includes MACO URL parsing for location and machine ID extraction.',
      icon: 'qr_code_scanner',
      color: '#9C27B0'
    }
  ];

  constructor(private router: Router) {}

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }
}