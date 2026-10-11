# Change Log

All notable changes to the "flowcraft" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [2.10.0] - 2026-10-11

### Changed
- **One key for every model: FlowCraft now runs on OpenRouter.** Instead of separate OpenAI, Anthropic and Google keys, you add a single OpenRouter key (starts with `sk-or-`, create one at [openrouter.ai/keys](https://openrouter.ai/keys)) and it works with Claude, GPT, Gemini and more.
- **Model picker is now a model slug.** Settings has a single **Model** field with suggestions (for example `anthropic/claude-sonnet-5.5`); type any slug from [openrouter.ai/models](https://openrouter.ai/models), or leave it empty to let FlowCraft choose.
- The settings screen, key prompt, "Set Up API Key" command and Welcome screen now only mention OpenRouter. Out-of-credits and rate-limit errors point you to your OpenRouter account.

### Fixed
- Your chosen model is now sent on every generation, including right-click "Visualize this" and "Insert diagram here" (previously only some paths honored it).

### Action required
- **Re-enter your key once.** Existing OpenAI, Anthropic, Google and FlowCraft keys are removed on first launch because they are no longer accepted. FlowCraft shows a one-time prompt to add your OpenRouter key.

## [2.9.1] - 2026-10-10

### Changed
- Updated the model lists and defaults: Claude Opus 5.5 / Sonnet 5.5 / Haiku 5.5, Gemini 3.8 Flash, and GPT-6.1 Sol.

## [2.9.0] - 2026-06-11

### Added
- **Conversational refine loop.** The in-extension diagram viewer now has a **Refine** bar: type a natural-language change ("make it left-to-right", "add the error path", "simplify") and the diagram is regenerated from its *current* Mermaid source plus your instruction — no re-prompting from scratch. A **↶ Back** button steps back through your refinement history.
- **Right-click "Visualize this".** A single **FlowCraft: Visualize this** action on a file, a multi-file folder, or a highlighted selection generates a diagram with zero typing — the prompt is built from the code itself and the diagram type is chosen heuristically (flowchart for procedural code, class diagram for OOP, architecture graph for folders). Pick a different type from the viewer's **Type…** dropdown to re-generate.
- **Mermaid-in-Markdown authoring.** Markdown files now show **Preview** / **Refine** CodeLenses above every ` ```mermaid ` block — preview renders it in the viewer, refine rewrites the block in place from a natural-language instruction. A new **FlowCraft: Insert diagram here** command generates a Mermaid block from a prompt and inserts it at your cursor.

## [2.8.0] - 2026-06-01

### Added
- **First-run onboarding.** New installs now get a guided **Get Started** walkthrough (set up a provider key, generate your first diagram, discover more) that opens automatically the first time you launch FlowCraft without an API key. A new **FlowCraft: Set Up API Key** command walks you through picking a provider and pasting a validated key.
- **Upgrade nudges.** When you exhaust your free generations, FlowCraft now surfaces a one-time, non-blocking nudge with a link to upgrade — and the Welcome view's upgrade link is wired to the pricing page.

### Changed
- **Marketplace listing** refreshed: gallery banner, plus a Premium / pricing section in the README outlining what's free vs. Premium.

### Fixed
- **"Open on web" no longer silently does nothing** in the in-extension diagram viewer. Generated diagrams now record their server id, so the button reliably opens the diagram on flowcraft.app. When a diagram genuinely isn't on the web yet (created locally and not synced), the button is disabled and offers to **Sign in to sync** instead of showing a dead-end toast.
- **Toggling "Theme" on a diagram with a Mermaid error no longer pointlessly re-renders the broken diagram.** The viewer now remembers whether the last render succeeded; on a failed diagram, Theme and Export are disabled and a clear message points you to fix the diagram code first. The in-viewer error display is also friendlier.
- **The "flowcraft › generating" progress notification no longer appears stuck.** API-key resolution now happens *before* the progress spinner starts, so a key-entry prompt can't sit hidden behind a spinning notification. The spinner now strictly covers the network request and render.

## [2.6.0] - 2026-05-30

### Added
- **Premium Templates.** Run **FlowCraft: Insert Premium Template** to browse a curated library of Mermaid diagram templates and drop one into your workspace as a ready-to-edit diagram. Browsing is free; inserting a template requires FlowCraft Premium. Inserted templates open in an editor and (for subscribers) sync to your cloud history automatically.

## [2.5.0] - 2026-05-30

### Added
- **Cloud History Sync (Premium).** When you're signed in to FlowCraft and subscribed, diagrams you generate are automatically mirrored to your account — so they show up on the web dashboard and on your other machines. Run **FlowCraft: Sync Diagrams to Cloud** from the Command Palette to push everything and pull your cloud history on demand. Syncing is idempotent (re-syncing never creates duplicates). Generation itself stays free and BYOK; cloud sync is purely an account-level convenience for subscribers.

## [2.4.0] - 2026-05-29

### Added
- FlowCraft Premium account layer. Sign in to see your plan in **Settings → Account**, with **Upgrade to Premium** / **Manage subscription** links. Premium will unlock cloud history sync, premium templates, and advanced exports (rolling out next).

### Changed
- Diagram generation now **always** uses your own provider API key (BYOK), even when you're signed in to FlowCraft. Signing in only unlocks account-level premium features — it never routes your generations through FlowCraft's servers. This keeps generation free and private.

## [2.3.1] - 2026-05-29

### Fixed
- Chat participant (`@flowcraft` slash commands like `/flowchart`, `/sequence`) no longer ends every generation with a spurious "Something went wrong" error. It was posting the diagram to a placeholder URL after already rendering it; that dead call has been removed.

### Changed
- Slimmed the published package: internal files (`CLAUDE.md`, `.claude/`, `docs/`, `local_mds/`, `MAINTENANCE.md`) are no longer shipped in the `.vsix`.
- Chat-participant diagram generations are now included in anonymous telemetry counts (still no keys/prompts).

## [2.3.0] - 2026-05-29

### Added
- Anonymous, opt-out usage telemetry so we can understand which diagram types and providers are used and improve reliability. It never includes your API keys, prompts, or generated content, and honors VS Code's global telemetry setting. Toggle it under **Settings → Privacy → Share anonymous usage data**.

### Changed
- Infographics and AI Images are now generally available (previously marked "Coming Soon").
- The extension is now fully bring-your-own-key: FlowCraft-issued keys are no longer accepted for generation. Add your own OpenAI, Anthropic, or Google key in Settings.

## [2.2.1] - 2026-05-09

### Fixed
- Context-menu "Use Current File" / "Use Selection" and the legacy flow/class diagram commands were calling the retired v1 `/diagrams/generate` endpoint and returning a 404 ("An error occurred while generating the diagram"). All generation paths now call `/v2/diagrams/generate`.

## [2.1.0] - 2025-11-27

### Fixed
- Resolved an issue where only the OpenAI provider was being taken into account when multiple providers were configured.


## [2.0.3]

### Added
- Initial implementation of core functionality
    - Generate flow diagrams for code blocks and files

### Fixed
- Fixed the links to the extension's Documentation and Support pages