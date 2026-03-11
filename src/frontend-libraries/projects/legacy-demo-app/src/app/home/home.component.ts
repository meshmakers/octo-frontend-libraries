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
      path: '/confirmation-demo',
      title: 'Confirmation Dialogs',
      description: 'Four dialog types: YesNo, YesNoCancel, OkCancel, and Ok using ConfirmationService.',
      icon: 'help_outline',
      color: '#9C27B0'
    },
    {
      path: '/progress-demo',
      title: 'Progress Windows',
      description: 'Determinate and indeterminate progress dialogs with cancel support via ProgressWindowService.',
      icon: 'hourglass_empty',
      color: '#FF9800'
    },
    {
      path: '/details-demo',
      title: 'Details & Validation',
      description: 'AbstractDetailsComponent with CommonValidators: phone, httpUri, ensureSameValue, conditionalRequired.',
      icon: 'assignment',
      color: '#009688'
    },
    {
      path: '/table-demo',
      title: 'Data Table',
      description: 'MmOctoTableComponent with sorting, pagination, action columns, virtual columns, and search filtering.',
      icon: 'table_chart',
      color: '#2196F3'
    },
    {
      path: '/entity-select-demo',
      title: 'Entity Select',
      description: 'MmEntitySelectInputComponent with OctoSdkDemo/Customer entities via GraphQL.',
      icon: 'search',
      color: '#3F51B5'
    },
    {
      path: '/error-demo',
      title: 'Error Notifications',
      description: 'MmNotificationBarComponent showing error snackbars via MessageService with various message types.',
      icon: 'error_outline',
      color: '#F44336'
    },
    {
      path: '/file-upload-demo',
      title: 'File Upload',
      description: 'File upload dialog with type filtering for ZIP, JSON, and YAML formats.',
      icon: 'upload_file',
      color: '#4CAF50'
    },
  ];

  constructor(private router: Router) {}

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }
}
