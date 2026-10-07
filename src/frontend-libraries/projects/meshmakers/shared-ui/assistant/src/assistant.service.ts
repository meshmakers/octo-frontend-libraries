import { DestroyRef, Injectable, Signal, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BreadCrumbService } from '@meshmakers/shared-services';
import { Observable, Subject, Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { deriveAssistantContext } from './assistant-context';
import { ASSISTANT_MESSAGES } from './assistant.messages';
import {
  ASSISTANT_ENABLED,
  ASSISTANT_PAGE_CONTEXT,
  AssistantPageContext,
  ASSISTANT_TRANSPORT,
  AssistantContextChip,
  AssistantExplainTarget,
  AssistantOpenRequest,
  AssistantProposal,
  AssistantProposalDecision,
  AssistantProposalDecisionKind,
  AssistantStreamEvent,
  AssistantThreadItem
} from './assistant.models';

/**
 * State and entry points of the assistant panel (ui-concept §5.3, AB#5549).
 *
 * - **Flag.** Everything is gated by {@link ASSISTANT_ENABLED} (off by default):
 *   while it is off every entry point is a no-op that returns `false`, and the
 *   service does not even listen to the router.
 * - **Entry points.** {@link open} (top-bar ✦, Cmd/Ctrl+J, palette `?` scope),
 *   {@link requestExplain} ("✦ Explain <object>", AB#5545/5547), {@link toggle}.
 *   They open the panel with a prefilled composer and context; they never send.
 * - **Thread.** Survives closing the panel and navigating. Items only come from the
 *   {@link ASSISTANT_TRANSPORT}; the default transport is not connected, so the
 *   library itself never adds an assistant turn.
 * - **Context.** Tenant (route param `tenantId`), page (`ASSISTANT_PAGE_CONTEXT`, else the first
 *   breadcrumb of shared-services' `BreadCrumbService`) and entity chips; see {@link deriveAssistantContext}.
 * - **Proposals.** Run / Edit / Discard are published on {@link proposalDecisions$}
 *   and nothing else — executing a write is the backend's confirm round-trip (AB#5550).
 */
@Injectable({ providedIn: 'root' })
export class AssistantService {
  /** The feature flag. Read it to gate any assistant affordance. */
  readonly enabled = inject(ASSISTANT_ENABLED);

  private readonly transport = inject(ASSISTANT_TRANSPORT);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  /** Only resolved while enabled: a disabled assistant binds nothing. */
  private readonly pageContext: AssistantPageContext | null = null;
  private readonly messages = inject(ASSISTANT_MESSAGES, { optional: true });

  private readonly _isOpen = signal(false);
  private readonly _draft = signal('');
  private readonly _focusRequest = signal(0);
  private readonly _explicitEntity = signal<AssistantExplainTarget | null>(null);
  private readonly _removedChips = signal<ReadonlySet<string>>(new Set());
  private readonly _thread = signal<AssistantThreadItem[]>([]);
  private readonly _sending = signal(false);
  private readonly _routeTick = signal(0);
  private readonly _breadcrumbs = signal<string[]>([]);
  private readonly decisions = new Subject<AssistantProposalDecision>();
  private returnFocusTo: HTMLElement | null = null;
  private pending: Subscription | null = null;
  private itemCounter = 0;

  /** Whether the panel is shown. */
  readonly isOpen = this._isOpen.asReadonly();
  /** Composer text; prefilled by entry points. */
  readonly draft = this._draft.asReadonly();
  /** Bumped whenever an entry point wants the composer focused. */
  readonly focusRequest = this._focusRequest.asReadonly();
  /** The rendered thread. */
  readonly thread = this._thread.asReadonly();
  /** A turn is streaming. */
  readonly sending = this._sending.asReadonly();
  readonly transportStatus = this.transport.status;
  readonly transportMessage = this.transport.statusMessage;
  /** The composer may send: the transport is ready and no turn is running. */
  readonly canSend = computed(() => this.transport.status() === 'ready' && !this._sending());

  /** Context of the current page minus the chips the person removed. */
  readonly contextChips: Signal<AssistantContextChip[]> = computed(() => {
    this._routeTick();
    const removed = this._removedChips();
    return deriveAssistantContext({
      root: this.router.routerState?.snapshot?.root,
      url: this.router.url ?? '',
      breadcrumbs: this._breadcrumbs(),
      areaText: this.pageContext?.areaText() ?? null,
      tabText: this.pageContext?.tabText() ?? null,
      explicitEntity: this._explicitEntity()
    }, this.messages).filter(chip => !removed.has(chip.id));
  });

  /** Run / Edit / Discard on proposal cards. Only emitted, never executed here. */
  readonly proposalDecisions$: Observable<AssistantProposalDecision> = this.decisions.asObservable();

  constructor() {
    if (!this.enabled) {
      return;
    }
    this.pageContext = inject(ASSISTANT_PAGE_CONTEXT, { optional: true });
    inject(BreadCrumbService).breadCrumbItems.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(items => this._breadcrumbs.set(items.map(item => item.text ?? '').filter(text => text.length > 0)));
    this.router.events.pipe(filter(event => event instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        // An explicit Explain target belongs to the page it was requested on.
        this._explicitEntity.set(null);
        this._routeTick.update(tick => tick + 1);
      });
    this.destroyRef.onDestroy(() => this.pending?.unsubscribe());
  }

  /** Opens the panel (or re-focuses it) with an optional prefill. Returns false while disabled. */
  open(request: AssistantOpenRequest = {}): boolean {
    if (!this.enabled) {
      return false;
    }
    if (!this._isOpen()) {
      const active = document.activeElement;
      this.returnFocusTo = active instanceof HTMLElement && active !== document.body ? active : null;
    }
    if (request.entity) {
      this._explicitEntity.set(request.entity);
      this._removedChips.update(removed => removed.size ? new Set() : removed);
    }
    if (request.prompt !== undefined) {
      this._draft.set(request.prompt);
    }
    this._isOpen.set(true);
    this._focusRequest.update(count => count + 1);
    return true;
  }

  /** "✦ Explain <object>": opens the panel with `/explain <label>` and the object as context chip. */
  requestExplain(target: AssistantExplainTarget): boolean {
    return this.open({ prompt: target.prompt ?? `/explain ${target.label}`, entity: target });
  }

  /** Hides the panel and gives focus back to where it was (the ✦ button if that is gone). */
  close(): void {
    if (!this._isOpen()) {
      return;
    }
    this._isOpen.set(false);
    const target = this.returnFocusTo?.isConnected
      ? this.returnFocusTo
      : document.querySelector<HTMLElement>('[data-assistant-toggle]');
    this.returnFocusTo = null;
    target?.focus();
  }

  /**
   * Forgets an open panel without moving focus — the host calls it when the
   * panel can no longer be shown (tenant left or denied, connection lost), so it
   * does not pop up again later with a stale return-focus target.
   */
  dismiss(): void {
    this._isOpen.set(false);
    this.returnFocusTo = null;
  }

  /** Opens when closed, closes when open. Returns false while disabled. */
  toggle(): boolean {
    if (!this.enabled) {
      return false;
    }
    if (this._isOpen()) {
      this.close();
    } else {
      this.open();
    }
    return true;
  }

  setDraft(text: string): void {
    this._draft.set(text);
  }

  /** Drops a context chip; it stays dropped until its value changes. */
  removeChip(id: string): void {
    this._removedChips.update(removed => new Set(removed).add(id));
  }

  /**
   * Sends one user turn through the transport. Does nothing (returns false) unless
   * the transport is `ready` — the default transport never is.
   */
  send(text: string): boolean {
    const trimmed = text.trim();
    if (!this.enabled || !trimmed || !this.canSend()) {
      return false;
    }
    this.append({ kind: 'user', id: this.nextId('user'), text: trimmed });
    this._draft.set('');
    this._sending.set(true);
    this.pending = this.transport.send({ text: trimmed, context: this.contextChips() }).subscribe({
      next: event => this.apply(event),
      error: (error: unknown) => {
        this.append({ kind: 'error', id: this.nextId('error'), text: error instanceof Error ? error.message : String(error) });
        this.finishTurn();
      },
      complete: () => this.finishTurn()
    });
    return true;
  }

  /** Stops the running turn (the composer's stop button). */
  stop(): void {
    this.pending?.unsubscribe();
    this.finishTurn();
  }

  /**
   * Records a decision on a proposal card and publishes it on
   * {@link proposalDecisions$}. Run and Discard settle the card; Edit leaves it open.
   * Nothing is executed here.
   */
  decideProposal(kind: AssistantProposalDecisionKind, proposal: AssistantProposal): void {
    if (kind !== 'edit') {
      this._thread.update(items => items.map(item =>
        item.kind === 'proposal' && item.proposal.id === proposal.id ? { ...item, decision: kind } : item));
    }
    this.decisions.next({ kind, proposal });
  }

  private apply(event: AssistantStreamEvent): void {
    switch (event.type) {
      case 'message-delta': {
        const id = `assistant:${event.messageId}`;
        const existing = this._thread().find(item => item.id === id);
        if (existing?.kind === 'assistant') {
          this._thread.update(items => items.map(item =>
            item.id === id && item.kind === 'assistant' ? { ...item, markdown: item.markdown + event.text } : item));
        } else {
          this.append({ kind: 'assistant', id, markdown: event.text, streaming: true });
        }
        break;
      }
      case 'message-end':
        this.endMessage(`assistant:${event.messageId}`);
        break;
      case 'tool-call': {
        const id = `tool:${event.call.callId}`;
        if (this._thread().some(item => item.id === id)) {
          this._thread.update(items => items.map(item => item.id === id ? { ...item, call: event.call } as AssistantThreadItem : item));
        } else {
          this.append({ kind: 'tool-call', id, call: event.call });
        }
        break;
      }
      case 'proposal':
        this.append({ kind: 'proposal', id: `proposal:${event.proposal.id}`, proposal: event.proposal, decision: null });
        break;
      case 'error':
        this.append({ kind: 'error', id: this.nextId('error'), text: event.message });
        break;
    }
  }

  private finishTurn(): void {
    this.pending = null;
    this._sending.set(false);
    this._thread.update(items => items.map(item =>
      item.kind === 'assistant' && item.streaming ? { ...item, streaming: false } : item));
  }

  private endMessage(id: string): void {
    this._thread.update(items => items.map(item =>
      item.id === id && item.kind === 'assistant' ? { ...item, streaming: false } : item));
  }

  private append(item: AssistantThreadItem): void {
    this._thread.update(items => [...items, item]);
  }

  private nextId(prefix: string): string {
    this.itemCounter += 1;
    return `${prefix}:${this.itemCounter}`;
  }
}

/**
 * Cmd+J (macOS) / Ctrl+J toggles the assistant panel (ui-concept §4.3), also
 * from text fields — it types nothing. Events another handler consumed and
 * IME composition are ignored.
 */
export function assistantHotkey(event: KeyboardEvent): boolean {
  return !event.defaultPrevented && !event.isComposing && event.key?.toLowerCase() === 'j'
    && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey;
}
