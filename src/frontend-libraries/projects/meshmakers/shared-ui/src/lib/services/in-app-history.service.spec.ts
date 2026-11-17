import type { Mock } from 'vitest';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { provideLocationMocks, SpyLocation } from '@angular/common/testing';
import { provideRouter, Router } from '@angular/router';
import { IN_APP_HISTORY_DEPTH_STATE_KEY, InAppHistoryService, provideInAppHistory } from './in-app-history.service';

@Component({ template: '', standalone: true })
class PageComponent {}

const routes = [
  { path: 'list', component: PageComponent },
  { path: 'form', component: PageComponent },
  { path: 'other', component: PageComponent }
];

describe('InAppHistoryService', () => {
  let router: Router;
  let location: SpyLocation;

  function setUp(): InAppHistoryService {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideLocationMocks(), provideInAppHistory()]
    });
    router = TestBed.inject(Router);
    location = TestBed.inject(Location) as SpyLocation;
    // Browser Back/Forward reach the router only through this listener (bootstrapping sets it up in an app).
    router.setUpLocationChangeListener();
    return TestBed.inject(InAppHistoryService);
  }

  /** Waits until the router has handled the popstate of a `location.back()` (it defers it by a macrotask). */
  async function settle(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve));
    await TestBed.inject(Router).navigated;
    await new Promise(resolve => setTimeout(resolve));
  }

  function depthOfCurrentEntry(): unknown {
    return (location.getState() as Record<string, unknown> | null)?.[IN_APP_HISTORY_DEPTH_STATE_KEY];
  }

  it('cannot go back on a directly opened page', async () => {
    const service = setUp();
    await router.navigateByUrl('/form');

    expect(service.canGoBack()).toBe(false);
    expect(depthOfCurrentEntry()).toBe(0);
  });

  it('navigates to the fallback with replaceUrl instead of leaving the app on a directly opened page', async () => {
    const service = setUp();
    await router.navigateByUrl('/form');
    const back = vi.spyOn(location, 'back');
    const entries = location.urlChanges.length;

    const result = await service.back(['/list']);

    expect(result).toBe(true);
    expect(back).not.toHaveBeenCalled();
    expect(location.path()).toBe('/list');
    // The fallback replaced the form's entry: no new history entry, so browser Back does not return to the form.
    expect(location.urlChanges.length).toBe(entries + 1);
    expect(location.urlChanges[location.urlChanges.length - 1]).toBe('replace: /list');
    expect(service.canGoBack()).toBe(false);
  });

  it('goes back when the app pushed the current entry', async () => {
    const service = setUp();
    await router.navigateByUrl('/list');
    await router.navigateByUrl('/form');

    expect(service.canGoBack()).toBe(true);
    expect(depthOfCurrentEntry()).toBe(1);

    const result = await service.back(['/other']);
    await settle();

    expect(result).toBe(true);
    expect(location.path()).toBe('/list');
    expect(service.canGoBack()).toBe(false);
  });

  it('keeps the depth for a replaceUrl navigation', async () => {
    const service = setUp();
    await router.navigateByUrl('/list');
    await router.navigateByUrl('/form', { replaceUrl: true });

    expect(service.canGoBack()).toBe(false);
    expect(depthOfCurrentEntry()).toBe(0);
  });

  it('keeps the depth for a navigation to the same URL', async () => {
    const service = setUp();
    await router.navigateByUrl('/list');
    await router.navigateByUrl('/form');
    await router.navigateByUrl('/form', { onSameUrlNavigation: 'reload' });

    expect(depthOfCurrentEntry()).toBe(1);
    expect(service.canGoBack()).toBe(true);
  });

  it('takes the depth of an entry restored by browser Forward', async () => {
    const service = setUp();
    await router.navigateByUrl('/list');
    await router.navigateByUrl('/form');
    location.back();
    await settle();
    expect(service.canGoBack()).toBe(false);

    location.forward();
    await settle();

    expect(location.path()).toBe('/form');
    expect(service.canGoBack()).toBe(true);
  });

  it('takes the depth stored in the entry after a reload', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideLocationMocks(), provideInAppHistory()]
    });
    location = TestBed.inject(Location) as SpyLocation;
    // The entry as a reload finds it: written by an earlier page load of the app, two app entries before it.
    location.replaceState('/form', '', { navigationId: 7, [IN_APP_HISTORY_DEPTH_STATE_KEY]: 2 });
    const service = TestBed.inject(InAppHistoryService);
    router = TestBed.inject(Router);

    router.initialNavigation();
    await settle();

    expect(location.path()).toBe('/form');
    expect(depthOfCurrentEntry()).toBe(2);
    expect(service.canGoBack()).toBe(true);
  });

  it('ignores a malformed stored depth', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideLocationMocks(), provideInAppHistory()]
    });
    location = TestBed.inject(Location) as SpyLocation;
    location.replaceState('/form', '', { navigationId: 7, [IN_APP_HISTORY_DEPTH_STATE_KEY]: 'x' });
    const service = TestBed.inject(InAppHistoryService);
    router = TestBed.inject(Router);

    router.initialNavigation();
    await settle();

    expect(service.canGoBack()).toBe(false);
    expect(depthOfCurrentEntry()).toBe(0);
  });

  it('keeps other state of the entry when it writes the depth', async () => {
    const service = setUp();
    await router.navigateByUrl('/list');
    await router.navigateByUrl('/form', { state: { origin: 'list' } });

    expect(service.canGoBack()).toBe(true);
    expect((location.getState() as Record<string, unknown>)['origin']).toBe('list');
  });

  it('does not count a navigation that skips the location change', async () => {
    const service = setUp();
    await router.navigateByUrl('/list');
    await router.navigateByUrl('/form', { skipLocationChange: true });

    expect(service.canGoBack()).toBe(false);
  });

  it('accepts a URL tree as fallback and passes the extras on', async () => {
    const service = setUp();
    await router.navigateByUrl('/form');

    await service.back(router.parseUrl('/list?tab=2'), { replaceUrl: false });

    expect(location.path()).toBe('/list?tab=2');
    expect(location.urlChanges[location.urlChanges.length - 1]).toBe('replace: /list?tab=2');
  });

  it('returns false when the fallback navigation is refused', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([...routes, { path: 'blocked', component: PageComponent, canActivate: [() => false] }]),
        provideLocationMocks(),
        provideInAppHistory()
      ]
    });
    router = TestBed.inject(Router);
    location = TestBed.inject(Location) as SpyLocation;
    const service = TestBed.inject(InAppHistoryService);
    await router.navigateByUrl('/form');

    const result = await service.back(['/blocked']);

    expect(result).toBe(false);
    expect(location.path()).toBe('/form');
  });

  describe('with unsaved changes on the page', () => {
    let confirmLeave: Mock<() => boolean>;

    function setUpGuarded(): InAppHistoryService {
      confirmLeave = vi.fn<() => boolean>();
      TestBed.configureTestingModule({
        providers: [
          // Stands in for UnsavedChangesGuard: the form is dirty, so leaving asks first.
          provideRouter(routes.map(route => route.path === 'form' ? { ...route, canDeactivate: [() => confirmLeave()] } : route)),
          provideLocationMocks(),
          provideInAppHistory()
        ]
      });
      router = TestBed.inject(Router);
      location = TestBed.inject(Location) as SpyLocation;
      router.setUpLocationChangeListener();
      return TestBed.inject(InAppHistoryService);
    }

    it('asks before falling back on a directly opened page, and stays when the user declines', async () => {
      const service = setUpGuarded();
      await router.navigateByUrl('/form');
      confirmLeave.mockReturnValue(false);

      const result = await service.back(['/list']);

      expect(confirmLeave).toHaveBeenCalledOnce();
      expect(result).toBe(false);
      expect(location.path()).toBe('/form');
    });

    it('asks before falling back on a directly opened page, and leaves within the app when the user agrees', async () => {
      const service = setUpGuarded();
      await router.navigateByUrl('/form');
      confirmLeave.mockReturnValue(true);

      const result = await service.back(['/list']);

      expect(confirmLeave).toHaveBeenCalledOnce();
      expect(result).toBe(true);
      expect(location.path()).toBe('/list');
    });

    it('asks before going back to the previous page of the app, and stays when the user declines', async () => {
      const service = setUpGuarded();
      await router.navigateByUrl('/list');
      await router.navigateByUrl('/form');
      confirmLeave.mockReturnValue(false);

      await service.back(['/other']);
      await settle();

      expect(confirmLeave).toHaveBeenCalledOnce();
      expect(location.path()).toBe('/form');
    });
  });
});
