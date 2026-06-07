# @meshmakers/octo-ai-console

Reusable Angular UI building blocks for the OctoMesh AI Adapter session console (ADR-21).

The library targets host applications that want to surface an agent session — Refinery
Studio integrates it as the `AI Console` tab in #4122 — but every component is standalone
and can be dropped into any Angular host with the right `AiAdapterClientService` provider
configuration.

## Phase 1 surface

| Class                      | Kind       | Responsibility                                            |
|----------------------------|------------|-----------------------------------------------------------|
| `AiSessionListComponent`   | component  | List of sessions with status, age, quota indicator        |
| `AiChatStreamComponent`    | component  | Markdown render of the session transcript                 |
| `AiToolCallComponent`      | component  | Expandable tool-call card with inputs/outputs/duration    |
| `AiApprovalModalComponent` | component  | Approval payload preview + Approve/Reject + comment       |
| `AiQuotaIndicatorComponent`| component  | Daily/monthly usage bars with threshold colour state      |
| `AiJobStatusBadgeComponent`| component  | Status pill (Running/Paused/Failed/Completed/Queued)      |
| `AiAdapterClientService`   | service    | REST wrapper over the adapter's `/sessions` endpoints     |
| `AiSessionStreamService`   | service    | Observable over SignalR events with resume-from-sequence  |

## Styling

The library ships neutral defaults — every coloured token is exposed as a CSS custom
property (`--mm-ai-*`) so host applications can theme the console without overriding
`!important` cascades.

## Build

```bash
npm run build:octo-ai-console
```

## Concept references

- Concept §10 — Frontend integration
- ADR-21 — `@meshmakers/octo-ai-console` package boundaries
- Issue #4121
