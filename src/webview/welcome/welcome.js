import { postMessage, onMessage } from '../shared/utils/messaging.js';
import { getById } from '../shared/utils/dom.js';

const ACTIONS = [
  { id: 'action-diagram',     command: 'generateDiagram' },
  { id: 'action-selection',   command: 'generateFromSelection' },
  { id: 'action-infographic', command: 'createInfographic' },
  { id: 'action-image',       command: 'generateImage' },
  { id: 'action-history',     command: 'viewHistory' },
];

document.addEventListener('DOMContentLoaded', () => {
  postMessage('checkUsage');
  wireActions();
  wireShortcuts();
  wireLinks();

  onMessage({ updateUsage: renderUsage });
});

function wireActions() {
  for (const { id, command } of ACTIONS) {
    const el = getById(id);
    if (!el) continue;
    el.addEventListener('click', () => postMessage(command));
  }
}

function wireShortcuts() {
  // Press 1–5 to trigger the matching tile. Ignore when typing in an input.
  document.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return;
    const idx = parseInt(e.key, 10);
    if (!Number.isInteger(idx) || idx < 1 || idx > ACTIONS.length) return;
    const { command } = ACTIONS[idx - 1];
    postMessage(command);
    const tile = getById(ACTIONS[idx - 1].id);
    if (tile) {
      tile.animate(
        [{ background: 'var(--fc-surface-hi)' }, { background: 'transparent' }],
        { duration: 220, easing: 'ease-out' }
      );
    }
  });
}

function wireLinks() {
  const settings = getById('link-settings');
  if (settings) {
    settings.addEventListener('click', (e) => {
      e.preventDefault();
      postMessage('openSettings');
    });
  }
}

function renderUsage(usage) {
  if (!usage) return;

  const progress  = getById('usage-progress');
  const fill      = getById('usage-fill');
  const text      = getById('usage-text');
  const limit     = getById('usage-limit');
  const badge     = getById('subscription-badge');
  const footMode  = getById('foot-mode');

  if (usage.subscribed) {
    badge.className = 'tag tag-pro';
    badge.innerHTML = '<span class="dot"></span>pro';
    if (progress) progress.classList.add('hidden');
    text.textContent  = `${usage.diagramsCreated} diagrams generated`;
    limit.textContent = '∞';
    if (footMode) footMode.textContent = 'pro';
  } else {
    badge.className = 'tag';
    badge.innerHTML = '<span class="dot"></span>free';
    if (progress) progress.classList.remove('hidden');

    const pct = Math.min(100, (usage.diagramsCreated / usage.freeLimit) * 100);
    if (fill) {
      fill.style.width = `${pct}%`;
      fill.classList.remove('warn', 'err');
      if (pct >= 90)      fill.classList.add('err');
      else if (pct >= 70) fill.classList.add('warn');
    }

    text.textContent  = `[${usage.diagramsCreated}/${usage.freeLimit}] diagrams`;
    limit.textContent = `${Math.max(0, usage.freeLimit - usage.diagramsCreated)} left`;
    if (footMode) footMode.textContent = 'byok';
  }
}
