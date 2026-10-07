/*
 * Public API Surface of @meshmakers/shared-ui/shell (AB#5621)
 */

/**
 * App shell building blocks of the OctoMesh Refinery Studio, usable by any host app
 * (independent of OctoMesh: no octo-* or shared-auth imports):
 * rail, space header with tab strip, settings side navigation, top bar and user menu,
 * plus the services that turn the host's command tree into areas and tabs.
 *
 * Usage (host AppComponent):
 *
 * ```ts
 * import {
 *   ShellNavigationService, SpaceHeaderService, ShellRailComponent, SpaceShellComponent,
 *   ShellTopBarComponent, SettingsSideNavComponent, shellEnvironmentChip
 * } from '@meshmakers/shared-ui/shell';
 *
 * @Component({
 *   imports: [ShellTopBarComponent, ShellRailComponent, SpaceShellComponent, SettingsSideNavComponent, RouterOutlet],
 *   template: `
 *     <mm-shell-top-bar brandName="My App" brandMarkSrc="assets/mark.svg"
 *       [tenantId]="tenantId()" [environment]="environment()"
 *       [user]="user()" [sessionLoading]="auth.sessionLoading()" (signIn)="auth.login()" (signOut)="auth.logout()"
 *       [theme]="themeMode.preference()" (themeChange)="themeMode.setPreference($event)"
 *       [languages]="languages" [language]="language()" (languageChange)="setLanguage($event)"
 *       (searchRequested)="palette.open()">
 *       <mm-tenant-switcher shellTenant [currentTenantId]="tenantId()" (tenantSelected)="openTenant($event)" />
 *     </mm-shell-top-bar>
 *     <mm-shell-rail [areas]="nav.topAreas()" [bottomAreas]="nav.bottomAreas()"
 *       [activeAreaId]="nav.activeArea()?.id ?? null"
 *       (areaSelected)="nav.openArea($event)" (itemSelected)="nav.open($event)" />
 *     <mm-space-shell [area]="nav.activeArea()" [activeTabId]="nav.activeTab()?.id ?? null"
 *       [chips]="spaceHeader.chips()" [showTabs]="nav.showTabs()" (tabSelected)="nav.open($event)">
 *       <kendo-breadcrumb spaceCrumbs [items]="crumbs()" />
 *     </mm-space-shell>
 *     <router-outlet />`
 * })
 * export class AppComponent {
 *   protected readonly nav = inject(ShellNavigationService);
 *   protected readonly spaceHeader = inject(SpaceHeaderService);
 * }
 * ```
 *
 * The navigation model is the host's `CommandSettingsService` command tree (shared-services):
 * top-level items with id `areaId('<space>')` become rail areas, their children
 * (`tabId('<space>', '<tab>')`) tabs; a top-level separator with id `RAIL_BOTTOM_SEPARATOR_ID`
 * pins the following areas to the bottom. Route data `{ space, tab, objectDetail, spaceTabs }`
 * refines the active area/tab.
 *
 * Optional providers:
 * - `SHELL_MESSAGES` — translations (`Partial<ShellMessages>`, English defaults; every component
 *   also has a `messages` input that wins over the token);
 * - `SHELL_SETTINGS_SPACE` — the space that uses the settings side navigation (default `'settings'`,
 *   `null` for none);
 * - `NOTIFICATION_DISPLAY_OPTIONS` (shared-ui) with `SHELL_NOTIFICATION_OPTIONS` for the toast stacking.
 *
 * User, theme, mode, density, language and environment are inputs with matching outputs;
 * applying and persisting them (per user) is the host's job.
 */

// --- Messages / i18n ---
export {
  DEFAULT_SHELL_MESSAGES,
  SHELL_MESSAGES,
  resolveShellMessages,
  formatShellMessage,
} from './shell.messages';
export type { ShellMessages } from './shell.messages';

// --- Navigation model ---
export { areaId, spaceOfAreaId, tabId, RAIL_BOTTOM_SEPARATOR_ID, SHELL_SETTINGS_SPACE } from './shell-areas';
export { ShellNavigationService } from './shell-navigation.service';
export type { ShellNavNode, ShellRouteData, ShellNavItemKind } from './shell-navigation.service';
export { SpaceHeaderService } from './space-header.service';
export type { SpaceStatusChip } from './space-header.service';
export { ShellSearchTriggerService } from './shell-search-trigger.service';
export { shellBreadcrumbs, crumbPath, isAreaCrumb } from './shell-breadcrumbs';
export type { ShellAreaCrumb, ShellBreadcrumbOptions } from './shell-breadcrumbs';

// --- Pure helpers / configuration ---
export { greetingPhrase, firstNameOf, homeGreeting, homeMeta } from './home-greeting';
export type { SpaceMetaItem, GreetingUser } from './home-greeting';
export { shellEnvironmentChip } from './shell-environment';
export type { ShellEnvironmentChip, ShellEnvironmentMode, ShellStatus } from './shell-environment';
export { SHELL_NOTIFICATION_OPTIONS } from './shell-notifications';

// --- Components ---
export { ShellRailComponent, RAIL_FLYOUT_OPEN_DELAY, RAIL_FLYOUT_CLOSE_DELAY } from './rail/rail.component';
export { SpaceShellComponent } from './space-shell/space-shell.component';
export { SettingsSideNavComponent } from './settings-side-nav/settings-side-nav.component';
export { SettingsSideNavBadgesService } from './settings-side-nav/settings-side-nav-badges.service';
export type { SettingsSideNavBadge } from './settings-side-nav/settings-side-nav-badges.service';
export { ShellTopBarComponent } from './top-bar/top-bar.component';
export type { ShellModeOption } from './top-bar/top-bar.component';
export { ShellUserMenuComponent, DEFAULT_SHELL_LANGUAGES } from './user-menu/user-menu.component';
export type { ShellDensityOption, ShellLanguage, ShellThemePreference, ShellUser } from './user-menu/user-menu.component';
