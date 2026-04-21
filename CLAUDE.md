# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

VS Code extension that generates Mermaid diagrams (and upcoming infographics/images) from code selections or prompts, published as `FlowCraft.flowcraft` on the Marketplace. It is one of three sibling projects in the FlowcraftProject monorepo — see the parent `../CLAUDE.md` for how it relates to the `FlowCraft` Next.js app and `flowcraft-api` FastAPI backend.

## Commands

```bash
npm install                 # package-lock.json is the lockfile
npm run compile             # tsc -p ./  (emits to out/)
npm run watch               # tsc -w
npm run lint                # eslint src --ext ts
npm run test                # vscode-test (runs .test.ts under src/test/)
node scripts/copy-webview-files.js   # copy src/webview/* → media/webview/*
npx vsce package            # build .vsix
```

Note: `scripts.vscode:prepublish` and `scripts.pretest` invoke `pnpm run …`. Use pnpm if you hit lockfile drift, otherwise invoke the underlying commands directly (`tsc -p ./`, `node scripts/copy-webview-files.js`) — webview HTML/CSS/JS **must** be copied into `media/webview/` before the extension is loaded, because webview providers load assets from `media/`, not `src/`.

Launch locally: press **F5** in VS Code to open an Extension Development Host with this extension loaded.

## Architecture

### Activation flow (`src/extension.ts`)

`activate()` wires up the object graph in this order, and new features should follow the same pattern:

1. `initLogger("FlowCraft")` — global output channel logger (`src/utils/logger.ts`).
2. `StateManager` (`src/state/state-manager.ts`) — persists to `context.globalState`; composes `DiagramStore`, `SettingsStore`, `UsageStore` and emits change events to listeners.
3. `APIKeyService` — wraps `context.secrets` with per-provider keys prefixed `flowcraft.apikey.<provider>`; `migrateOldKeys()` converts legacy single-provider storage on startup.
4. `FlowCraftClient` (`src/api/flowcraft-client.ts`) — talks to the FlowCraft API (`https://flowcraft-api-cb66lpneaq-ue.a.run.app` by default, overridable via `FLOWCRAFT_API_URL` env var). Handles retries, timeouts, and maps typed errors from `src/api/errors.ts`.
5. `UsageService`, `DiagramService` — orchestrate client + state + secrets.
6. `WelcomeViewProvider`, `SettingsViewProvider` — register sidebar webviews under the `flowcraft` activity-bar container.
7. Commands are registered individually and pushed to `context.subscriptions`. The chat participant `flowcraft.diagramAssistant` is wired through `ChatParticipantHandler.ts`.

### Multi-provider API key model (critical)

The extension is BYOK. The default provider comes from the setting `flowcraft.api.provider` (enum: `openai` | `anthropic` | `google` | `flowcraft`). The flow used by every generation command is `ensureProviderApiKey(stateManager, apiKeyService)`:

1. Read `defaultProvider` from `StateManager.getSetting("defaultProvider")`.
2. Look up a stored key for that provider via `APIKeyService.retrieve(provider)`.
3. If missing, prompt with a provider-specific `InputBox` whose `validateInput` enforces that provider's prefix (`sk-`, `sk-ant-`, etc.), then `store()` it.

**v2.1.0 fix context:** earlier versions only checked the OpenAI key regardless of the configured provider — any new code path that calls the API must route through `ensureProviderApiKey` (or equivalent), not read an OpenAI key directly. The legacy `OPENAI_KEY_SECRET = "flowcraft.openai.key"` constant is retained only for the `flowcraft.resetApiKey` command and migration.

### API endpoints used

- `POST {FLOWCRAFT_API_URL}/diagrams/generate` — v1, used by the legacy flow/class diagram commands.
- `POST {FLOWCRAFT_API_URL}/v2/diagrams/generate` — v2, used by `flowcraft.openGenerationView`. Returns `response.mermaid_code` and `response.inserted_diagram.data[0].id`; the extension opens `https://flowcraft.app/vscode/<id>` in the user's browser rather than rendering inline.

Authentication header is `X-api-key: <user's provider key>` — the FlowCraft API accepts third-party provider keys directly and fans out to the right LLM via LiteLLM.

### Per-provider model selection

Each generation request carries an optional `model` field in the body. The value is resolved in `DiagramService.generate()` by reading `settings.providerModels[provider]` — persisted in `SettingsStore` and edited through the Settings webview's "models · per provider" section. The curated list per provider lives in two places that must stay in sync: `src/types/api.ts` (`PROVIDER_INFO.supportedModels`, used by TS code) and `src/webview/settings/settings.js` (`MODELS_BY_PROVIDER`, used by the webview dropdown). When `providerModels[provider]` is unset, the field is omitted from the request body and the API falls back to its env-provided default.

### Webviews (`src/webview/` ↔ `media/webview/`)

Source HTML/CSS/JS lives under `src/webview/{welcome,settings,generation,history,viewer,shared}/`. TypeScript is compiled to `out/`, but webview assets are plain static files and must be copied into `media/webview/` by `scripts/copy-webview-files.js` before the webview providers in `src/views/` can load them via `webview.asWebviewUri`. Webview `index.html` files expect to be served from `media/webview/<name>/`.

### Extension contribution surface (`package.json`)

- Activity-bar container `flowcraft` hosts two webview views: `flowcraft.welcomeView` and `flowcraft.settingsView`.
- Two keybindings: `cmd+shift+d` → open generation view; `cmd+shift+g` → generate from selection.
- Context-menu entries on `editor/context` and `explorer/context` dispatch to `flowcraft.generateFromSelection` / `flowcraft.generateFromFile`, which in turn execute the v1 `generateFlowDiagram*` commands.
- Chat participant `flowcraft.diagramAssistant` exposes slash commands (`/flowchart`, `/sequence`, `/classDiagram`, `/stateDiagram`, `/erDiagram`, `/explainDiagram`) — implemented in `src/ChatParticipantHandler.ts`.
- Configuration schema under `flowcraft.*` defines provider, diagram defaults, cache TTL, request timeout, concurrency limits.

### Size limits

All generation paths hard-cap input at **10,000 characters** and reject empty input. If you add a new generation command, mirror this check to avoid oversized requests hitting the API.

## TypeScript settings

`tsconfig.json` is strict with `noUnusedLocals`, `noUnusedParameters`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`. `rootDir: src`, `outDir: out`, module `Node16`, target `ES2022`. Tests (`**/*.test.ts`) are excluded from the compile.
