# @meshmakers/shared-services

Angular library providing common application services for messaging, navigation, breadcrumbs, and HTTP error handling.

## Table of Contents

- [Installation](#installation)
- [Setup](#setup)
- [Services](#services)
  - [MessageService](#messageservice)
  - [AppTitleService](#apptitleservice)
  - [BreadCrumbService](#breadcrumbservice)
  - [CommandService](#commandservice)
  - [CommandSettingsService](#commandsettingsservice)
  - [ComponentMenuService](#componentmenuservice)
- [Interceptors](#interceptors)
  - [MmHttpErrorInterceptor](#mmhttperrorinterceptor)
- [Models](#models)
- [Examples](#examples)

## Installation

The library is part of the meshmakers monorepo. Import it from `@meshmakers/shared-services`.

```typescript
import {
  MessageService,
  AppTitleService,
  BreadCrumbService,
  CommandService,
  CommandSettingsService,
  MmHttpErrorInterceptor,
  NotificationMessage,
  CommandItem
} from '@meshmakers/shared-services';
```

## Setup

### Using Provider Function (Recommended)

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideMmSharedServices, CommandOptions } from '@meshmakers/shared-services';

const commandOptions = new CommandOptions();

export const appConfig: ApplicationConfig = {
  providers: [
    provideMmSharedServices(commandOptions)
  ]
};
```

### Manual Provider Setup

```typescript
import { ApplicationConfig } from '@angular/core';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import {
  MessageService,
  AppTitleService,
  BreadCrumbService,
  CommandService,
  CommandSettingsService,
  MmHttpErrorInterceptor
} from '@meshmakers/shared-services';

export const appConfig: ApplicationConfig = {
  providers: [
    MessageService,
    AppTitleService,
    BreadCrumbService,
    CommandService,
    CommandSettingsService,
    { provide: HTTP_INTERCEPTORS, useClass: MmHttpErrorInterceptor, multi: true }
  ]
};
```

## Services

### MessageService

Service for displaying notifications and tracking error messages throughout the application.

#### Message Levels

- `error` - Error messages (logged to console.error)
- `warning` - Warning messages (logged to console.warn)
- `info` - Informational messages (logged to console.log)
- `success` - Success messages (logged to console.log)

#### Methods

| Method | Parameters | Description |
|--------|------------|-------------|
| `showError(message)` | `message: string` | Show error message |
| `showErrorWithDetails(message, details)` | `message: string, details: string` | Show error with details |
| `showWarning(message)` | `message: string` | Show warning message |
| `showWarningWithDetails(message, details)` | `message: string, details: string` | Show warning with details |
| `showInformation(message)` | `message: string` | Show info message |
| `showSuccess(message)` | `message: string` | Show success message |
| `getErrorMessageCount()` | - | Get count of error messages |
| `getErrorMessage(index)` | `index: number` | Get specific error message |
| `getLatestErrorMessage()` | - | Get observable of latest error |

#### Observable Streams

| Property | Type | Description |
|----------|------|-------------|
| `messages$` | `Observable<NotificationMessage>` | Stream of all messages |
| `latestErrorMessage` | `BehaviorSubject<NotificationMessage \| null>` | Latest error |

#### Usage Example

```typescript
import { Component, inject } from '@angular/core';
import { MessageService } from '@meshmakers/shared-services';

@Component({
  selector: 'app-my-component',
  template: `
    <button (click)="saveData()">Save</button>
    <button (click)="deleteData()">Delete</button>
  `
})
export class MyComponent {
  private readonly messageService = inject(MessageService);

  saveData(): void {
    try {
      // Save operation...
      this.messageService.showSuccess('Data saved successfully!');
    } catch (error) {
      this.messageService.showErrorWithDetails(
        'Failed to save data',
        error.message
      );
    }
  }

  deleteData(): void {
    this.messageService.showWarningWithDetails(
      'Delete Confirmation',
      'Are you sure you want to delete this item? This action cannot be undone.'
    );
  }
}
```

#### Subscribing to Messages

```typescript
import { Component, inject, OnInit } from '@angular/core';
import { MessageService, NotificationMessage } from '@meshmakers/shared-services';

@Component({
  selector: 'app-notification-display',
  template: `<!-- Your notification UI -->`
})
export class NotificationDisplayComponent implements OnInit {
  private readonly messageService = inject(MessageService);

  ngOnInit(): void {
    // Subscribe to all messages
    this.messageService.messages$.subscribe((message: NotificationMessage) => {
      this.displayNotification(message);
    });

    // Or subscribe only to errors
    this.messageService.getLatestErrorMessage().subscribe((error) => {
      if (error) {
        console.log('Latest error:', error.message);
      }
    });
  }

  private displayNotification(message: NotificationMessage): void {
    // Show toast/notification based on message.level
  }
}
```

### AppTitleService

Service for managing the application title across components.

#### Methods

| Method | Parameters | Description |
|--------|------------|-------------|
| `setTitle(title)` | `title: string` | Set the application title |
| `getTitle()` | - | Get current title synchronously |

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `appTitle` | `Observable<string \| null>` | Observable of title changes |

#### Usage Example

```typescript
import { Component, inject, OnInit } from '@angular/core';
import { AppTitleService } from '@meshmakers/shared-services';

@Component({
  selector: 'app-root',
  template: `
    <header>
      <h1>{{ title }}</h1>
    </header>
    <router-outlet></router-outlet>
  `
})
export class AppComponent implements OnInit {
  private readonly appTitleService = inject(AppTitleService);
  protected title = 'My Application';

  ngOnInit(): void {
    this.appTitleService.appTitle.subscribe((newTitle) => {
      this.title = newTitle ?? 'My Application';
    });
  }
}

// In a child component
@Component({
  selector: 'app-dashboard',
  template: `<h2>Dashboard</h2>`
})
export class DashboardComponent implements OnInit {
  private readonly appTitleService = inject(AppTitleService);

  ngOnInit(): void {
    this.appTitleService.setTitle('Dashboard - My Application');
  }
}
```

### BreadCrumbService

Service for automatic breadcrumb generation based on route configuration.

#### Route Data Configuration

Add `breadcrumb` data to your routes:

```typescript
// app.routes.ts
import { Routes } from '@angular/router';
import { BreadCrumbRouteItem } from '@meshmakers/shared-services';

export const routes: Routes = [
  {
    path: 'users',
    component: UsersComponent,
    data: {
      breadcrumb: [
        { label: 'Home', url: '/' },
        { label: 'Users', url: '/users' }
      ] as BreadCrumbRouteItem[]
    }
  },
  {
    path: 'users/:userId',
    component: UserDetailComponent,
    data: {
      breadcrumb: [
        { label: 'Home', url: '/' },
        { label: 'Users', url: '/users' },
        { label: 'User {{userId}}', url: ':userId' }  // Dynamic parameter
      ] as BreadCrumbRouteItem[]
    }
  }
];
```

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `breadCrumbItems` | `Observable<BreadCrumbData[]>` | Current breadcrumb items |

#### Methods

| Method | Parameters | Description |
|--------|------------|-------------|
| `updateBreadcrumbLabels(data)` | `data: any` | Update dynamic labels with data |

#### Usage Example

```typescript
import { Component, inject } from '@angular/core';
import { BreadCrumbService, BreadCrumbData } from '@meshmakers/shared-services';
import { BreadCrumbComponent } from '@progress/kendo-angular-navigation';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [BreadCrumbComponent, AsyncPipe],
  template: `
    <kendo-breadcrumb
      [items]="breadCrumbService.breadCrumbItems | async"
      (itemClick)="onBreadcrumbClick($event)">
    </kendo-breadcrumb>
  `
})
export class NavigationComponent {
  protected readonly breadCrumbService = inject(BreadCrumbService);

  onBreadcrumbClick(item: BreadCrumbData): void {
    // Navigate to item.url
  }
}
```

#### Dynamic Label Updates

```typescript
// After loading entity data
async ngOnInit(): Promise<void> {
  const user = await this.userService.getUser(this.userId);

  // Update breadcrumb labels with actual data
  await this.breadCrumbService.updateBreadcrumbLabels({
    userId: user.name  // Replaces {{userId}} in label
  });
}
```

### CommandService

Service for managing drawer navigation items and handling navigation commands.

#### Methods

| Method | Description |
|--------|-------------|
| `initialize()` | Initialize drawer items from CommandSettingsService |
| `setSelectedDrawerItem(item)` | Handle drawer item selection and navigate |

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `drawerItems` | `Observable<DrawerItem[]>` | Drawer items for Kendo Drawer |

#### Usage Example

```typescript
import { Component, inject } from '@angular/core';
import { CommandService } from '@meshmakers/shared-services';
import { DrawerComponent, DrawerSelectEvent } from '@progress/kendo-angular-layout';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [DrawerComponent, AsyncPipe],
  template: `
    <kendo-drawer
      [items]="commandService.drawerItems | async"
      (select)="onSelect($event)">
    </kendo-drawer>
  `
})
export class SidebarComponent {
  protected readonly commandService = inject(CommandService);

  async onSelect(event: DrawerSelectEvent): Promise<void> {
    await this.commandService.setSelectedDrawerItem(event.item);
  }
}
```

### CommandSettingsService

Base service for defining navigation command items. Extend this to provide your application's navigation structure.

#### Creating Custom Command Settings

```typescript
import { Injectable, inject } from '@angular/core';
import { CommandSettingsService, CommandItem } from '@meshmakers/shared-services';
import { ActivatedRoute } from '@angular/router';
import { homeIcon, settingsIcon, userIcon } from '@progress/kendo-svg-icons';

@Injectable({ providedIn: 'root' })
export class MyCommandSettingsService extends CommandSettingsService {
  private readonly activatedRoute = inject(ActivatedRoute);

  private readonly _commandItems: CommandItem[] = [
    {
      id: 'home',
      type: 'link',
      text: 'Home',
      svgIcon: homeIcon,
      link: '/'
    },
    {
      id: 'users',
      type: 'section',
      text: 'Users',
      svgIcon: userIcon,
      children: [
        {
          id: 'user-list',
          type: 'link',
          text: 'All Users',
          link: '/users'
        },
        {
          id: 'user-add',
          type: 'link',
          text: 'Add User',
          link: '/users/new'
        }
      ]
    },
    { id: 'sep1', type: 'separator' },
    {
      id: 'settings',
      type: 'link',
      text: 'Settings',
      svgIcon: settingsIcon,
      link: '/settings',
      isVisible: () => this.checkPermission()
    }
  ];

  override get commandItems(): CommandItem[] {
    return this._commandItems;
  }

  override get navigateRelativeToRoute(): ActivatedRoute {
    return this.activatedRoute;
  }

  private async checkPermission(): Promise<boolean> {
    // Check user permissions
    return true;
  }
}
```

#### Register Custom Service

```typescript
// app.config.ts
import { CommandSettingsService } from '@meshmakers/shared-services';
import { MyCommandSettingsService } from './services/my-command-settings.service';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: CommandSettingsService, useClass: MyCommandSettingsService }
  ]
};
```

### ComponentMenuService

Service for managing component-level context menus defined in route data.

#### Route Configuration

```typescript
export const routes: Routes = [
  {
    path: 'editor',
    component: EditorComponent,
    data: {
      navigationMenu: [
        {
          id: 'save',
          type: 'link',
          text: 'Save',
          onClick: async (args) => { /* save logic */ }
        },
        {
          id: 'export',
          type: 'link',
          text: 'Export',
          href: '/api/export'
        }
      ] as CommandItem[]
    }
  }
];
```

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `menuItems` | `Observable<MenuItem[]>` | Menu items for Kendo Menu |

## Interceptors

### MmHttpErrorInterceptor

HTTP interceptor that automatically handles common HTTP errors.

#### Behavior

- **Status 0 (Network Error)**: Shows "Cannot connect to server" message
- **Status 400 with API Error**: Parses `ApiErrorDto` and shows detailed error message

#### Setup

```typescript
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { MmHttpErrorInterceptor } from '@meshmakers/shared-services';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: MmHttpErrorInterceptor, multi: true }
  ]
};
```

#### API Error Format

The interceptor expects 400 errors with this format:

```typescript
interface ApiErrorDto {
  statusCode: number;
  statusDescription: string;
  message: string;
  details?: {
    code: string;
    description: string;
  }[];
}
```

## Models

### NotificationMessage

```typescript
interface NotificationMessage {
  level: 'error' | 'warning' | 'info' | 'success';
  message: string;
  details?: string;
  timestamp: Date;
}
```

### CommandItem

```typescript
interface CommandItem {
  id: string;
  type: 'link' | 'section' | 'separator';
  text?: string;
  svgIcon?: SVGIcon;
  selected?: boolean;

  // Navigation - uses Angular Router
  link?: string | ((args: CommandItemExecuteEventArgs) => Promise<string>);

  // External link - opens in new window
  href?: string | ((args: CommandItemExecuteEventArgs) => Promise<string>);
  target?: string;

  // Click handler
  onClick?: (args: CommandItemExecuteEventArgs) => Promise<void>;

  // Visibility/Disabled state
  isVisible?: boolean | (() => Promise<boolean>);
  isDisabled?: boolean | (() => boolean);

  // Nested items
  children?: CommandItem[];
}
```

### BreadCrumbRouteItem

```typescript
interface BreadCrumbRouteItem {
  label: string;        // Display text (supports {{param}} syntax)
  url: string;          // URL (supports :param syntax)
  svgIcon?: SVGIcon;    // Optional icon
}
```

### BreadCrumbData

```typescript
class BreadCrumbData implements BreadCrumbItem {
  text?: string;
  title?: string;
  labelTemplate: string;  // Original template with placeholders
  url: string;
  svgIcon?: SVGIcon;
}
```

## Examples

### Complete App Setup

See `projects/template-app/src/app/app.config.ts` for a complete configuration example.

### Message Demo

See `projects/template-app/src/app/tenants/demos/message/message-demo.component.ts` for all message types and usage patterns.

### Custom Navigation

See `projects/template-app/src/app/services/my-command-settings.service.ts` for a comprehensive navigation configuration including:

- Static and dynamic links
- Sections with children
- Separators
- Visibility conditions
- External links

### App Bar with Breadcrumbs

See `projects/template-app/src/app/app.component.ts` for breadcrumb and menu integration.
