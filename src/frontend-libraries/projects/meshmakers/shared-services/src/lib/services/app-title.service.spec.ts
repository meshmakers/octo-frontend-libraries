import { TestBed } from '@angular/core/testing';
import { AppTitleService } from './app-title.service';

describe('AppTitleService', () => {
  let service: AppTitleService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AppTitleService]
    });
    service = TestBed.inject(AppTitleService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('initial state', () => {
    it('should have null as initial title', () => {
      expect(service.getTitle()).toBeNull();
    });

    it('should emit null from appTitle observable initially', (done) => {
      service.appTitle.subscribe(title => {
        expect(title).toBeNull();
        done();
      });
    });
  });

  describe('setTitle', () => {
    it('should set the title', () => {
      service.setTitle('Test Title');

      expect(service.getTitle()).toBe('Test Title');
    });

    it('should update appTitle observable', (done) => {
      const titles: (string | null)[] = [];

      service.appTitle.subscribe(title => {
        titles.push(title);
        if (titles.length === 2) {
          expect(titles[0]).toBeNull();
          expect(titles[1]).toBe('New Title');
          done();
        }
      });

      service.setTitle('New Title');
    });

    it('should allow changing the title multiple times', () => {
      service.setTitle('First');
      expect(service.getTitle()).toBe('First');

      service.setTitle('Second');
      expect(service.getTitle()).toBe('Second');

      service.setTitle('Third');
      expect(service.getTitle()).toBe('Third');
    });

    it('should emit all title changes to subscribers', () => {
      const receivedTitles: (string | null)[] = [];

      service.appTitle.subscribe(title => {
        receivedTitles.push(title);
      });

      service.setTitle('Title 1');
      service.setTitle('Title 2');
      service.setTitle('Title 3');

      expect(receivedTitles.length).toBe(4); // null + 3 titles
      expect(receivedTitles[0]).toBeNull();
      expect(receivedTitles[1]).toBe('Title 1');
      expect(receivedTitles[2]).toBe('Title 2');
      expect(receivedTitles[3]).toBe('Title 3');
    });

    it('should handle empty string as title', () => {
      service.setTitle('');

      expect(service.getTitle()).toBe('');
    });

    it('should handle special characters in title', () => {
      service.setTitle('Title with <special> & "characters"');

      expect(service.getTitle()).toBe('Title with <special> & "characters"');
    });
  });

  describe('getTitle', () => {
    it('should return current title synchronously', () => {
      service.setTitle('Sync Title');

      const title = service.getTitle();

      expect(title).toBe('Sync Title');
    });
  });

  describe('appTitle observable', () => {
    it('should allow multiple subscribers', () => {
      const subscriber1Titles: (string | null)[] = [];
      const subscriber2Titles: (string | null)[] = [];

      service.appTitle.subscribe(title => subscriber1Titles.push(title));
      service.appTitle.subscribe(title => subscriber2Titles.push(title));

      service.setTitle('Shared Title');

      expect(subscriber1Titles).toEqual([null, 'Shared Title']);
      expect(subscriber2Titles).toEqual([null, 'Shared Title']);
    });

    it('should emit current value to new subscribers (BehaviorSubject)', () => {
      service.setTitle('Existing Title');

      const receivedTitle: (string | null)[] = [];
      service.appTitle.subscribe(title => receivedTitle.push(title));

      expect(receivedTitle).toEqual(['Existing Title']);
    });
  });
});
