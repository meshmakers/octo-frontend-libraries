import { TestBed } from '@angular/core/testing';
import { EnvironmentInjector, createEnvironmentInjector, signal } from '@angular/core';
import { MESHBOARD_MESSAGES, injectMeshBoardMessages, resolveMeshBoardMessages, MeshBoardMessages } from './meshboard-messages';
import { provideMeshBoard, provideMeshBoardMessages } from '../registrations/default-widget-registrations';

describe('MeshBoard messages (AB#5622)', () => {
  it('defaults to English without a host layer', () => {
    const resolved = resolveMeshBoardMessages(null);
    expect(resolved.tableNotConfigured).toBe('Table not configured');
    expect(resolved.tableList).toBeUndefined();
  });

  it('keeps the default for a missing placeholder text and passes the list texts through', () => {
    const resolved = resolveMeshBoardMessages({ tableList: { noRecords: 'Keine Einträge vorhanden.' } });
    expect(resolved.tableNotConfigured).toBe('Table not configured');
    expect(resolved.tableList?.noRecords).toBe('Keine Einträge vorhanden.');
  });

  it('follows a signal source (runtime language switch)', () => {
    const language = signal<MeshBoardMessages>({ tableNotConfigured: 'Tabelle nicht konfiguriert' });
    TestBed.configureTestingModule({ providers: [{ provide: MESHBOARD_MESSAGES, useValue: language }] });
    const texts = TestBed.runInInjectionContext(() => injectMeshBoardMessages());
    expect(texts().tableNotConfigured).toBe('Tabelle nicht konfiguriert');
    language.set({ tableNotConfigured: 'Table not set up' });
    expect(texts().tableNotConfigured).toBe('Table not set up');
  });

  it('is provided by provideMeshBoard({ messages }) and provideMeshBoardMessages()', () => {
    const parent = TestBed.inject(EnvironmentInjector);
    const viaOptions = createEnvironmentInjector([provideMeshBoard({ includeDefaultWidgets: false, messages: { tableNotConfigured: 'A' } })], parent);
    expect(viaOptions.get(MESHBOARD_MESSAGES)).toEqual({ tableNotConfigured: 'A' });
    const direct = createEnvironmentInjector([provideMeshBoardMessages({ tableNotConfigured: 'B' })], parent);
    expect(direct.get(MESHBOARD_MESSAGES)).toEqual({ tableNotConfigured: 'B' });
    const none = createEnvironmentInjector([provideMeshBoard({ includeDefaultWidgets: false })], parent);
    expect(none.get(MESHBOARD_MESSAGES, null)).toBeNull();
  });
});
