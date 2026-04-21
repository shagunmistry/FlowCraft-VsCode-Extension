#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -z "${VSCE_PAT:-}" ]]; then
  echo "error: VSCE_PAT is not set (Azure DevOps PAT for the FlowCraft publisher)" >&2
  exit 1
fi

BUMP="${1:-patch}"

npm ci
npm run compile
node scripts/copy-webview-files.js
npm run lint

npx vsce publish "$BUMP"
