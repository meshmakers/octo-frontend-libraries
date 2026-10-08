import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationDisplayService } from '@meshmakers/shared-ui';
import { PaletteRunMode } from './command-palette.models';
import { COMMAND_PALETTE_MESSAGES, formatCommandPaletteMessage, resolveCommandPaletteMessages } from './command-palette.messages';

/**
 * Navigation and clipboard helpers shared by the palette providers. All
 * palette targets are absolute router URLs (`/<tenant>/…`), so a result
 * behaves the same whichever page the palette was opened on.
 */
@Injectable({ providedIn: 'root' })
export class PaletteNavigationService {
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationDisplayService);
  private readonly messages = resolveCommandPaletteMessages(inject(COMMAND_PALETTE_MESSAGES, { optional: true }));

  /** The tenant of the current URL (first path segment), or null outside a tenant. */
  currentTenantId(): string | null {
    const path = (this.router.url ?? '').split('#')[0].split('?')[0];
    const first = path.split('/').find(segment => segment.length > 0);
    return first ? decodeURIComponent(first.split(';')[0]) : null;
  }

  /**
   * Turns a command link into an absolute URL: links starting with `/` are
   * absolute already, all others are relative to the tenant (as the drawer
   * resolves them via `navigateRelativeToRoute`).
   */
  tenantUrl(link: string): string {
    if (link.startsWith('/')) {
      return link;
    }
    const tenantId = this.currentTenantId();
    const relative = link.replace(/^\.?\/?/, '');
    return tenantId ? `/${encodeURIComponent(tenantId)}${relative ? '/' + relative : ''}` : `/${relative}`;
  }

  /** Opens an absolute router URL in place or in a new browser tab. */
  async open(url: string, mode: PaletteRunMode = 'open'): Promise<void> {
    if (mode === 'newTab') {
      window.open(this.toHref(url), '_blank', 'noopener');
      return;
    }
    await this.router.navigateByUrl(url);
  }

  /** Opens an external link (href) in a new tab, as the drawer does. */
  openExternal(href: string, target = '_blank'): void {
    window.open(href, target, 'noopener,noreferrer');
  }

  /** Copies a value and confirms it with a short notification. */
  async copy(value: string, label: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      this.notifications.showSuccess(formatCommandPaletteMessage(this.messages.copied, { label }), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      this.notifications.showError(this.messages.copyFailed);
    }
  }

  private toHref(url: string): string {
    try {
      return new URL(`.${url}`, document.baseURI).href;
    } catch {
      return url;
    }
  }
}
