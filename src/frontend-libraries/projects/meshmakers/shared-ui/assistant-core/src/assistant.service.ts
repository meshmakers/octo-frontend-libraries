import { DestroyRef, Injectable, Signal, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BreadCrumbService } from '@meshmakers/shared-services';
import { Observable, Subject, Subscription, firstValueFrom, isObservable, lastValueFrom } from 'rxjs';
import { filter } from 'rxjs/operators';
import { deriveAssistantContext } from './assistant-context';
import { ASSISTANT_MESSAGES, formatAssistantMessage, resolveAssistantMessages } from './assistant.messages';
import {
  ASSISTANT_ENABLED,
  ASSISTANT_SLASH_COMMANDS,
  AssistantSlashCommand,
  ASSISTANT_PAGE_CONTEXT,
  AssistantPageContext,
  ASSISTANT_TRANSPORT,
  AssistantContextChip,
  AssistantExplainTarget,
  AssistantOpenRequest,
  AssistantProposal,
  AssistantProposalDecision,
  AssistantProposalDecisionKind,
  AssistantAsyncResult,
  AssistantAttachmentOptions,
  AssistantSendRequest,
  AssistantSessionSummary,
  AssistantStreamEvent,
  AssistantThreadItem
} from './assistant.models';

const NO_SESSIONS = signal<readonly AssistantSessionSummary[]>([]).asReadonly();
const NO_ACTIVE_SESSION = signal<string | null>(null).asReadonly();

/** Awaits a promise or the last value of an observable; an observable that completes empty (e.g. `EMPTY` for a void result) yields `undefined` instead of rejecting. */
/** `/word rest` → the word (lower-case) and the trimmed rest; anything else → null. */
function parseSlashCommand(text: string): { word: string; args: string } | null {
  const match = /^(\/[\w-]+)(?:\s+([\s\S]*))?$/.exec(text);
  return match ? { word: match[1].toLowerCase(), args: (match[2] ?? '').trim() } : null;
}

function settle<T>(result: AssistantAsyncResult<T>): Promise<T | undefined> {
  return isObservable(result) ? lastValueFrom(result, { defaultValue: undefined }) : result;
}

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
 * - **Optional transport capabilities (AB#5621).** Sessions ({@link sessionsSupported},
 *   {@link openSession}, {@link deleteSession}, {@link newThread}), file attachments
 *   ({@link attachments}, {@link draftFiles}) and starter questions ({@link starterQuestions}) are
 *   only offered when the transport implements them; otherwise they are inert.
 * - **Slash commands (AB#5621).** A command of `ASSISTANT_SLASH_COMMANDS` with `expand` is sent as
 *   the prompt it returns; see {@link send}.
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
  private readonly slashCommands: readonly AssistantSlashCommand[] = inject(ASSISTANT_SLASH_COMMANDS);

  private readonly _isOpen = signal(false);
  private readonly _draft = signal('');
  private readonly _focusRequest = signal(0);
  private readonly _explicitEntity = signal<AssistantExplainTarget | null>(null);
  private readonly _removedChips = signal<ReadonlySet<string>>(new Set());
  private readonly _thread = signal<AssistantThreadItem[]>([]);
  private readonly _sending = signal(false);
  private readonly _draftFiles = signal<readonly File[]>([]);
  private readonly _starterQuestions = signal<readonly string[]>([]);
  private starterRequest = 0;
  /** Bumped by every thread switch (open session, new chat, loadThread); stale session loads are dropped. */
  private threadGeneration = 0;
  private readonly _routeTick = signal(0);
  private readonly _breadcrumbs = signal<string[]>([]);
  private readonly decisions = new Subject<AssistantProposalDecision>();
  private returnFocusTo: HTMLElement | null = null;
  private pending: Subscription | null = null;
  private itemCounter = 0;
  /** Bumped by {@link stop}: an async slash-command expansion that resolves later is dropped. */
  private expansionGeneration = 0;

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

  /** The transport has saved sessions (`sessions` + `loadSession`): the panel shows its chat list. */
  readonly sessionsSupported = !!this.transport.sessions && typeof this.transport.loadSession === 'function';
  /** Saved sessions can be deleted (`deleteSession`). */
  readonly sessionDeleteSupported = this.sessionsSupported && typeof this.transport.deleteSession === 'function';
  /** Saved sessions of the transport (empty without session support). */
  readonly sessions: Signal<readonly AssistantSessionSummary[]> = this.transport.sessions ?? NO_SESSIONS;
  /** The session the next send writes to (`null` = fresh chat or no session support). */
  readonly activeSessionId: Signal<string | null> = this.transport.activeSessionId ?? NO_ACTIVE_SESSION;

  /** Accepted attachments, or `null` when the transport takes no files (no attach UI). */
  readonly attachments: AssistantAttachmentOptions | null = this.transport.attachments ?? null;
  /** Files attached in the composer; sent and cleared with the next turn. */
  readonly draftFiles = this._draftFiles.asReadonly();

  /** Starter questions for an empty thread (see {@link loadStarterQuestions}). */
  readonly starterQuestions = this._starterQuestions.asReadonly();

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

  /** Replaces the attached files (ignored while the transport takes no files). */
  setDraftFiles(files: readonly File[]): void {
    if (this.attachments) {
      this._draftFiles.set([...files]);
    }
  }

  /**
   * Asks the transport for its starter questions (the panel calls it when it opens).
   * No-op without `starterQuestions`; a failing source leaves the list empty. Of an observable
   * only the first emitted value counts (it need not complete); one that completes empty yields none.
   */
  loadStarterQuestions(): void {
    const source = this.transport.starterQuestions;
    if (!this.enabled || typeof source !== 'function') {
      return;
    }
    const request = ++this.starterRequest;
    const accept = (questions: readonly string[] | null | undefined): void => {
      if (request === this.starterRequest) {
        this._starterQuestions.set((questions ?? []).filter(q => typeof q === 'string' && q.trim().length > 0));
      }
    };
    try {
      const result = source.call(this.transport);
      if (Array.isArray(result)) {
        accept(result);
      } else if (isObservable(result)) {
        // The first emitted value counts, so a never-completing source (BehaviorSubject, signal stream) works too.
        firstValueFrom(result as Observable<readonly string[]>, { defaultValue: [] as readonly string[] }).then(accept, () => accept([]));
      } else {
        (result as Promise<readonly string[]>).then(accept, () => accept([]));
      }
    } catch {
      accept([]);
    }
  }

  /** Reloads the transport's session list. Resolves false without session support or on failure. */
  async refreshSessions(): Promise<boolean> {
    if (!this.enabled || !this.sessionsSupported || typeof this.transport.refreshSessions !== 'function') {
      return false;
    }
    try {
      await settle(this.transport.refreshSessions());
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Opens a saved session: stops a running turn, asks the transport for the session's thread and
   * shows it. On failure the current thread stays and an error row is added. Resolves whether the
   * session was opened.
   */
  async openSession(id: string): Promise<boolean> {
    if (!this.enabled || !this.sessionsSupported) {
      return false;
    }
    this.stop();
    const generation = ++this.threadGeneration;
    try {
      const items = await settle(this.transport.loadSession!(id));
      if (generation !== this.threadGeneration) {
        // Another session was opened (or a new chat started) meanwhile: that one wins.
        return false;
      }
      this.loadThread(items ?? []);
      return true;
    } catch {
      if (generation === this.threadGeneration) {
        this.append({ kind: 'error', id: this.nextId('error'), text: resolveAssistantMessages(this.messages).sessionLoadFailed });
      }
      return false;
    }
  }

  /**
   * Deletes a saved session; deleting the active one leaves an empty thread. On failure an error
   * row is added. Resolves whether it was deleted.
   */
  async deleteSession(id: string): Promise<boolean> {
    if (!this.enabled || !this.sessionDeleteSupported) {
      return false;
    }
    const wasActive = this.activeSessionId() === id;
    const generation = this.threadGeneration;
    try {
      await settle(this.transport.deleteSession!(id));
    } catch {
      this.append({ kind: 'error', id: this.nextId('error'), text: resolveAssistantMessages(this.messages).sessionDeleteFailed });
      return false;
    }
    // Only clear when the thread still shows the deleted session (no switch while deleting).
    if (wasActive && generation === this.threadGeneration) {
      this.stop();
      this.threadGeneration += 1;
      this._thread.set([]);
    }
    return true;
  }

  /**
   * Starts a fresh chat: stops a running turn, empties the thread and the attached files and tells
   * the transport (`newSession`, when it has one). Works without session support too.
   */
  newThread(): void {
    if (!this.enabled) {
      return;
    }
    this.stop();
    this.threadGeneration += 1;
    this._thread.set([]);
    this._draftFiles.set([]);
    this.transport.newSession?.();
    this.loadStarterQuestions();
  }

  /** Replaces the thread, e.g. with a conversation the host restored itself. Stops a running turn. */
  loadThread(items: readonly AssistantThreadItem[]): void {
    if (!this.enabled) {
      return;
    }
    this.stop();
    this.threadGeneration += 1;
    this._thread.set([...items]);
  }

  /** Drops a context chip; it stays dropped until its value changes. */
  removeChip(id: string): void {
    this._removedChips.update(removed => new Set(removed).add(id));
  }

  /**
   * Sends one user turn through the transport. Does nothing (returns false) unless
   * the transport is `ready` — the default transport never is.
   *
   * With a transport that takes attachments, `files` (default: {@link draftFiles}) go along and
   * the text may be empty; the attached files are cleared with the draft. Explicitly passed `files`
   * are not checked again against {@link attachments} (`accept`, `maxFiles`, `maxFileSizeBytes`) —
   * the composer validates on pick; a host passing files itself is responsible for them.
   *
   * **Slash commands (AB#5621).** When the text is `<command> [args]` and that command of
   * `ASSISTANT_SLASH_COMMANDS` has `expand`, its result is sent instead and shown as the user turn,
   * with the typed text as `slashCommand` (label in the thread, also on the send request). A
   * promise-returning `expand` makes the turn start once it resolves (the composer is busy and Stop
   * cancels meanwhile); returns true when the expansion started. If `expand` throws, rejects or yields
   * an empty prompt, nothing is sent: an error row is added and the draft (text and files) comes back.
   */
  send(text: string, files?: readonly File[]): boolean {
    const trimmed = text.trim();
    const attached = this.attachments ? [...(files ?? this._draftFiles())] : [];
    if (!this.enabled || (!trimmed && !attached.length) || !this.canSend()) {
      return false;
    }
    const parsed = parseSlashCommand(trimmed);
    const command = parsed ? this.slashCommands.find(c => c.command.toLowerCase() === parsed.word && typeof c.expand === 'function') : undefined;
    if (!parsed || !command) {
      this._draft.set('');
      this._draftFiles.set([]);
      this.startTurn(trimmed, attached);
      return true;
    }

    const restoreDraft = (): void => {
      if (!this._draft()) {
        this._draft.set(text);
      }
      if (this.attachments && !this._draftFiles().length) {
        this._draftFiles.set(attached);
      }
    };
    const fail = (): void => {
      this.append({
        kind: 'error', id: this.nextId('error'),
        text: formatAssistantMessage(resolveAssistantMessages(this.messages).slashCommandFailed, { command: command.command })
      });
      restoreDraft();
    };
    const accept = (prompt: unknown): boolean => {
      const expanded = typeof prompt === 'string' ? prompt.trim() : '';
      if (!expanded) {
        fail();
        return false;
      }
      this.startTurn(expanded, attached, trimmed);
      return true;
    };

    let result: string | Promise<string>;
    try {
      result = command.expand!(command.command, parsed.args);
    } catch {
      fail();
      return false;
    }
    this._draft.set('');
    this._draftFiles.set([]);
    if (typeof result === 'string' || !result || typeof (result as Promise<string>).then !== 'function') {
      return accept(result);
    }
    // Async: busy until the prompt is there; stop() (or a thread switch) drops it.
    const generation = ++this.expansionGeneration;
    this._sending.set(true);
    (result as Promise<string>).then(
      prompt => {
        if (generation === this.expansionGeneration) {
          this._sending.set(false);
          accept(prompt);
        }
      },
      () => {
        if (generation === this.expansionGeneration) {
          this._sending.set(false);
          fail();
        }
      });
    return true;
  }

  /** Stops the running turn (the composer's stop button), including a pending slash-command expansion. */
  stop(): void {
    this.expansionGeneration += 1;
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

  /** Appends the user turn and streams the transport's answer. */
  private startTurn(text: string, attached: File[], slashCommand?: string): void {
    const user: Extract<AssistantThreadItem, { kind: 'user' }> = { kind: 'user', id: this.nextId('user'), text };
    if (attached.length) {
      user.attachments = attached.map(file => ({ name: file.name, size: file.size }));
    }
    if (slashCommand !== undefined) {
      user.slashCommand = slashCommand;
    }
    this.append(user);
    this._sending.set(true);
    const request: AssistantSendRequest = { text, context: this.contextChips() };
    if (attached.length) {
      request.files = attached;
    }
    if (slashCommand !== undefined) {
      request.slashCommand = slashCommand;
    }
    this.pending = this.transport.send(request).subscribe({
      next: event => this.apply(event),
      error: (error: unknown) => {
        this.append({ kind: 'error', id: this.nextId('error'), text: error instanceof Error ? error.message : String(error) });
        this.finishTurn();
      },
      complete: () => this.finishTurn()
    });
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
