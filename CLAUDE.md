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

## Releasing — bump the version or nothing ships

Deployment is automatic: `.github/workflows/publish.yml` runs on every push to `main`, runs the tests (`xvfb-run -a npm test`, which compiles and lints first), and then runs `vsce publish` **only if that push bumped `"version"` in `package.json`**. The Marketplace rejects a version that already exists, so the workflow deliberately skips publishing when the version is unchanged.

**If you change anything users would receive** (code under `src/`, webview assets, `package.json` contributions, README/CHANGELOG shown on the Marketplace), you must bump the version in the same change, or the change will merge and silently never be published. Docs-only or CI-only changes (e.g. this file, `.github/`) do not need a bump.

Checklist for an agent making a user-facing change:

1. Bump the version (don't hand-edit it in two places): `npm version <patch|minor|major> --no-git-tag-version` — updates both `package.json` and `package-lock.json`. Use `patch` for fixes and copy/model-list tweaks, `minor` for new features, `major` for breaking changes (e.g. 2.9.1 → 2.10.0 for the OpenRouter-only keys change, since existing users must re-enter a key).
2. Add a `## [x.y.z] - YYYY-MM-DD` entry at the top of `CHANGELOG.md` (Keep a Changelog style: Added / Changed / Fixed). Call out anything users must do (e.g. re-enter an API key).
3. Run `npm run compile && npm run lint`, and `node scripts/copy-webview-files.js` if you touched `src/webview/` (the `media/webview/` copies are committed).
4. Put the version bump in the **last commit pushed to `main`**. The workflow checks only `git diff HEAD^ HEAD -- package.json` (checkout depth 2), so a bump in an earlier commit of a multi-commit push, or one reverted by a later commit, will not publish. The simplest safe pattern is a final `chore: release x.y.z` commit containing the bump and the CHANGELOG entry.
5. Don't run `vsce publish` locally and don't commit `.vsix` files — CI publishes using the `VSCE_PAT` repo secret. If the Test step fails, nothing is published; fix the tests and push a new commit (that commit must also touch the version line again, or bump to the next patch, since the bump must appear in the tip commit's diff).

If a release is intended but you are unsure about the bump size, pick the smaller one that is still accurate and say so in the commit message; never leave the version unchanged on a user-facing change.

## Architecture

### Activation flow (`src/extension.ts`)

`activate()` wires up the object graph in this order, and new features should follow the same pattern:

1. `initLogger("FlowCraft")` — global output channel logger (`src/utils/logger.ts`).
2. `StateManager` (`src/state/state-manager.ts`) — persists to `context.globalState`; composes `DiagramStore`, `SettingsStore`, `UsageStore` and emits change events to listeners.
3. `APIKeyService` — wraps `context.secrets` with keys prefixed `flowcraft.apikey.<provider>` (only `openrouter` now); `migrateOldKeys()` deletes pre-OpenRouter OpenAI/Anthropic/Google/FlowCraft secrets on startup and returns true so `activate()` can show a one-time "add an OpenRouter key" notice.
4. `FlowCraftClient` (`src/api/flowcraft-client.ts`) — talks to the FlowCraft API (`https://flowcraft-api-cb66lpneaq-ue.a.run.app` by default, overridable via `FLOWCRAFT_API_URL` env var). Handles retries, timeouts, and maps typed errors from `src/api/errors.ts`.
5. `UsageService`, `DiagramService` — orchestrate client + state + secrets.
6. `WelcomeViewProvider`, `SettingsViewProvider` — register sidebar webviews under the `flowcraft` activity-bar container.
7. Commands are registered individually and pushed to `context.subscriptions`. The chat participant `flowcraft.diagramAssistant` is wired through `ChatParticipantHandler.ts`.

### OpenRouter-only BYOK key model (critical)

The extension is BYOK and the API routes every text model through OpenRouter, so there is exactly one provider: `Provider.OpenRouter` (`openrouter`). The enum is kept (rather than deleted) so provider-keyed code — secrets, settings maps, `AuthResolver` — stays generic. The flow used by every generation command is `ensureProviderApiKey(stateManager, apiKeyService)`:

1. Read `defaultProvider` from `StateManager.getSetting("defaultProvider")` (always `openrouter`; `SettingsStore.fromJSON` coerces old persisted values).
2. Look up the stored key via `APIKeyService.retrieve(provider)`.
3. If missing, prompt with an `InputBox` whose `validateInput` enforces the `sk-or-` prefix, then `store()` it.

Key format is validated in three places that must agree: `src/api/providers.ts` (`validateApiKey`), `src/utils/validation.ts`, and `src/utils/provider-links.ts` (`validateKeyFormat`, mirrored in `src/webview/settings/settings.js`). Old OpenAI/Anthropic/Google keys are rejected by the API. The legacy `OPENAI_KEY_SECRET = "flowcraft.openai.key"` constant is retained only so `flowcraft.resetApiKey` scrubs it.

### API endpoints used

- `POST {FLOWCRAFT_API_URL}/v2/diagrams/generate` — used by every generation command (the generation view, context-menu "Use Current File" / "Use Selection", and the legacy flow/class diagram flows). Accepts `{title, description, type, source?, model?}`. Returns `response.mermaid_code` and `response.inserted_diagram.data[0].id`; the extension opens `https://flowcraft.app/vscode/<id>` in the user's browser rather than rendering inline.

The deployed FlowCraft API no longer exposes the unprefixed v1 `/diagrams/generate` route — only `/v2/...` is mounted (see `flowcraft-api/src/main.py`). New code paths must call the v2 URL.

Authentication header is `X-api-key: <user's OpenRouter key>` (`sk-or-…`) — the FlowCraft API uses it directly against OpenRouter (OpenAI SDK, no LiteLLM). `/v2/vscode/verify` checks the key live.

### Model selection

Each generation request carries an optional `model` field: an OpenRouter slug such as `anthropic/claude-sonnet-5.5`. It is read from `settings.providerModels.openrouter` (edited in the Settings webview "Model" field, a free-text input with a datalist of suggestions). `DiagramService.generate()` and the inline `/v2/diagrams/generate` calls in `extension.ts` (via `withModel()`) attach it; when unset the field is omitted and the API uses its `DEFAULT_MODEL`. The suggested slugs live in two places that must stay in sync: `src/types/api.ts` (`PROVIDER_INFO.supportedModels`) and `src/webview/settings/settings.js` (`MODEL_SUGGESTIONS`). The API rejects malformed slugs (must match `provider/model`).

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
