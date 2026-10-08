import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NotificationDisplayService } from '@meshmakers/shared-ui';
import { PaletteNavigationService } from './palette-navigation.service';
import { COMMAND_PALETTE_MESSAGES } from './command-palette.messages';

describe('PaletteNavigationService', () => {
  const router = { url: '/meshtest/communication/adapters?x=1', navigateByUrl: vi.fn().mockResolvedValue(true) };
  const notifications = { showSuccess: vi.fn(), showError: vi.fn() };
  let service: PaletteNavigationService;

  beforeEach(() => {
    vi.clearAllMocks();
    router.url = '/meshtest/communication/adapters?x=1';
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: NotificationDisplayService, useValue: notifications }
      ]
    });
    service = TestBed.inject(PaletteNavigationService);
  });

  it('reads the tenant from the first URL segment', () => {
    expect(service.currentTenantId()).toBe('meshtest');
    router.url = '/';
    expect(service.currentTenantId()).toBeNull();
  });

  it('resolves links relative to the tenant and keeps absolute ones', () => {
    expect(service.tenantUrl('communication/pools')).toBe('/meshtest/communication/pools');
    expect(service.tenantUrl('./ai/console')).toBe('/meshtest/ai/console');
    expect(service.tenantUrl('/meshtest/development/jobs')).toBe('/meshtest/development/jobs');
    expect(service.tenantUrl('')).toBe('/meshtest');
  });

  it('navigates in place or opens a new tab', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    await service.open('/meshtest/communication/pools');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/meshtest/communication/pools');
    await service.open('/meshtest/communication/pools', 'newTab');
    expect(open).toHaveBeenCalledWith(expect.stringMatching(/\/meshtest\/communication\/pools$/), '_blank', 'noopener');
    open.mockRestore();
  });

  it('copies and confirms', async () => {
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    await service.copy('abc', 'RtId');
    expect(writeText).toHaveBeenCalledWith('abc');
    expect(notifications.showSuccess).toHaveBeenCalledWith('RtId copied', 2000);
    writeText.mockRejectedValueOnce(new Error('denied'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await service.copy('abc', 'RtId');
    expect(notifications.showError).toHaveBeenCalled();
    error.mockRestore();
    writeText.mockRestore();
  });
});

describe('PaletteNavigationService messages', () => {
  it('uses COMMAND_PALETTE_MESSAGES for the clipboard notifications', async () => {
    const notifications = { showSuccess: vi.fn(), showError: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { url: '/' } },
        { provide: NotificationDisplayService, useValue: notifications },
        { provide: COMMAND_PALETTE_MESSAGES, useValue: { copied: '{label} kopiert' } }
      ]
    });
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    await TestBed.inject(PaletteNavigationService).copy('abc', 'RtId');
    expect(notifications.showSuccess).toHaveBeenCalledWith('RtId kopiert', 2000);
    writeText.mockRestore();
  });
});
