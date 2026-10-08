import { TemplateRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SpaceHeaderService } from './space-header.service';

describe('SpaceHeaderService', () => {
  let service: SpaceHeaderService;
  const template = {} as TemplateRef<unknown>;

  beforeEach(() => {
    service = TestBed.inject(SpaceHeaderService);
  });

  it('clears contributions made at or before the marker', () => {
    service.setChips([{ label: 'a', status: 'info' }]);
    service.setActions(template);
    const marker = service.mark();

    service.clearOlderThan(marker);

    expect(service.chips()).toEqual([]);
    expect(service.actions()).toBeNull();
  });

  it('keeps contributions made after the marker, per field', () => {
    service.setChips([{ label: 'old', status: 'info' }]);
    service.setActions(template);
    const marker = service.mark();
    service.setChips([{ label: 'new', status: 'success' }]);

    service.clearOlderThan(marker);

    expect(service.chips().map(c => c.label)).toEqual(['new']);
    expect(service.actions()).toBeNull();
  });
});
