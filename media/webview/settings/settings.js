import { postMessage, onMessage } from '../shared/utils/messaging.js';
import { getById, queryAll } from '../shared/utils/dom.js';

const PROVIDERS = ['openai', 'anthropic', 'google', 'flowcraft'];

// Curated model lists per provider — mirrors PROVIDER_INFO in src/types/api.ts.
// Keep in sync when the TypeScript list changes.
const MODELS_BY_PROVIDER = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-mini', 'o3-mini'],
  anthropic: [
    'claude-opus-4-20250514',
    'claude-sonnet-4-20250514',
    'claude-haiku-4-20250514',
    'claude-3-7-sonnet-20250219',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022'
  ],
  google: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  flowcraft: ['flowcraft-default']
};

let currentSettings = {};
let currentProviders = {};
let keysRevealed = false;

document.addEventListener('DOMContentLoaded', () => {
  postMessage('loadSettings');
  wire();

  onMessage({
    updateSettings: ({ settings, providers }) => {
      currentSettings = settings;
      currentProviders = providers;
      render();
    },
    connectionResult: ({ provider, success, message }) => {
      setStatus(provider, success ? 'ok' : 'err', success ? 'Connected' : (message || 'Failed to connect'));
      const btn = getById(`test-${provider}`);
      if (btn) { btn.disabled = false; btn.textContent = 'Test'; }
    },
    saveComplete: ({ success }) => {
      const btn = getById('save-btn');
      const foot = getById('foot-status');
      if (btn) {
        btn.textContent = success ? 'Saved' : 'Save failed';
        btn.disabled = false;
        setTimeout(() => { btn.textContent = 'Save changes'; }, 1400);
      }
      if (foot) {
        foot.textContent = success ? 'Changes saved' : 'Could not save changes';
        foot.className = 'st-foot-status ' + (success ? 'ok' : 'err');
        setTimeout(() => { foot.textContent = 'No unsaved changes'; foot.className = 'st-foot-status'; }, 2000);
      }
    }
  });
});

function wire() {
  // Test buttons
  queryAll('[id^="test-"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const provider = btn.id.replace('test-', '');
      const input = getById(`key-${provider}`);
      const apiKey = input && input.value;
      if (!apiKey) {
        setStatus(provider, 'err', 'Enter a key first');
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Testing…';
      setStatus(provider, 'warn', 'Checking…');
      postMessage('testConnection', { provider, apiKey });
    });
  });

  // Save
  getById('save-btn')?.addEventListener('click', save);

  // Reset
  getById('reset-btn')?.addEventListener('click', () => {
    if (confirm('Reset all settings to their defaults? Your API keys will be kept.')) postMessage('resetSettings');
  });

  // Reset API keys — delegates to the flowcraft.resetApiKey command
  getById('reset-keys-btn')?.addEventListener('click', () => {
    postMessage('resetApiKeys');
  });

  // Reveal / hide passwords
  getById('reveal-btn')?.addEventListener('click', () => {
    keysRevealed = !keysRevealed;
    PROVIDERS.forEach(p => {
      const input = getById(`key-${p}`);
      if (input) input.type = keysRevealed ? 'text' : 'password';
    });
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === 's') { e.preventDefault(); save(); }
    if (mod && e.key === 'r') { e.preventDefault(); if (confirm('Reset all settings to their defaults? Your API keys will be kept.')) postMessage('resetSettings'); }
  });
}

function save() {
  const btn = getById('save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  const providerModels = { ...(currentSettings.providerModels || {}) };
  PROVIDERS.forEach(p => {
    const sel = getById(`model-${p}`);
    if (!sel) return;
    const v = sel.value;
    if (!v) delete providerModels[p];
    else providerModels[p] = v;
  });

  const newSettings = {
    ...currentSettings,
    defaultProvider:     getById('default-provider').value,
    defaultDiagramType:  getById('default-type').value,
    defaultColorPalette: getById('default-palette').value,
    defaultComplexity:   getById('default-complexity').value,
    providerModels
  };

  const apiKeys = {};
  PROVIDERS.forEach(p => {
    const input = getById(`key-${p}`);
    if (input && input.value) apiKeys[p] = input.value;
  });

  postMessage('saveSettings', { settings: newSettings, apiKeys });
}

function render() {
  if (!currentSettings) return;

  Object.entries(currentProviders || {}).forEach(([provider, configured]) => {
    if (configured) setStatus(provider, 'ok', 'Connected');
    else            setStatus(provider, '',   'Not connected');
  });

  setSelect('default-provider',   currentSettings.defaultProvider);
  setSelect('default-type',       currentSettings.defaultDiagramType);
  setSelect('default-palette',    currentSettings.defaultColorPalette);
  setSelect('default-complexity', currentSettings.defaultComplexity);

  renderModelSelects();
}

function renderModelSelects() {
  const chosen = currentSettings.providerModels || {};
  PROVIDERS.forEach(p => {
    const sel = getById(`model-${p}`);
    if (!sel) return;
    const models = MODELS_BY_PROVIDER[p] || [];
    // Build: a "default" option (sends no override), then curated models.
    sel.innerHTML = '';
    const defOpt = document.createElement('option');
    defOpt.value = '';
    defOpt.textContent = 'Default (recommended)';
    sel.appendChild(defOpt);
    models.forEach(m => {
      const o = document.createElement('option');
      o.value = m;
      o.textContent = m;
      sel.appendChild(o);
    });
    sel.value = chosen[p] || '';
  });
}

function setStatus(provider, state, text) {
  const el = getById(`status-${provider}`);
  if (!el) return;
  el.className = 'st-status' + (state ? ' ' + state : '');
  el.textContent = text;
}

function setSelect(id, value) {
  const el = getById(id);
  if (el) el.value = value || '';
}
