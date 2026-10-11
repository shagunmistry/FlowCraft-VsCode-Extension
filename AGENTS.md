# AGENTS.md

Guidance for AI coding agents working in this repo. Full project guidance is in [CLAUDE.md](CLAUDE.md); read it first.

## Release rule (important)

**Always bump the version as part of any change that touches the shipped extension, without waiting to be asked.** Do not leave it for "later" or for the user to remember; an unbumped change merges and silently never ships. If unsure of the size, use `patch` and say so.

Pushes to `main` are deployed to the VS Code Marketplace automatically by `.github/workflows/publish.yml`, **but only when the push changes `"version"` in `package.json`**. A user-facing change merged without a version bump is never published.

When you change `src/`, webview assets, `package.json` contributions, or the Marketplace README/CHANGELOG:

1. `npm version <patch|minor|major> --no-git-tag-version` (updates `package.json` and `package-lock.json`).
2. Add a `## [x.y.z] - YYYY-MM-DD` entry at the top of `CHANGELOG.md`.
3. `npm run compile && npm run lint` (CI also runs the tests first and publishes nothing if they fail).
4. Make sure the bump is in the **last commit** pushed to `main` — CI only diffs `HEAD^ HEAD`.

Do not run `vsce publish` locally and do not commit `.vsix` files. Details and rationale: "Releasing" in [CLAUDE.md](CLAUDE.md).
