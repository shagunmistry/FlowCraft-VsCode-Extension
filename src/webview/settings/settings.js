import { postMessage, onMessage } from '../shared/utils/messaging.js';
import { getById, queryAll } from '../shared/utils/dom.js';

const PROVIDERS = ['openai', 'anthropic', 'google', 'flowcraft'];

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
      setStatus(provider, success ? 'ok' : 'err', success ? 'verified' : (message || 'failed'));
      const btn = getById(`test-${provider}`);
      if (btn) { btn.disabled = false; btn.textContent = 'test'; }
    },
    saveComplete: ({ success }) => {
      const btn = getById('save-btn');
      const foot = getById('foot-status');
      if (btn) {
        btn.textContent = success ? 'saved' : 'save failed';
        btn.disabled = false;
        setTimeout(() => { btn.textContent = 'save changes'; }, 1400);
      }
      if (foot) {
        foot.textContent = success ? 'changes written' : 'write failed';
        foot.className = 'st-foot-cell ' + (success ? 'ok' : 'err');
        setTimeout(() => { foot.textContent = 'idle'; foot.className = 'st-foot-cell'; }, 1800);
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
        setStatus(provider, 'err', 'enter a key first');
        return;
      }
      btn.disabled = true;
      btn.textContent = '…';
      setStatus(provider, 'warn', 'checking…');
      postMessage('testConnection', { provider, apiKey });
    });
  });

  // Save
  getById('save-btn')?.addEventListener('click', save);

  // Reset
  getById('reset-btn')?.addEventListener('click', () => {
    if (confirm('reset all settings to defaults?')) postMessage('resetSettings');
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
    if (mod && e.key === 'r') { e.preventDefault(); if (confirm('reset all settings to defaults?')) postMessage('resetSettings'); }
  });
}

function save() {
  const btn = getById('save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'saving…'; }

  const newSettings = {
    ...currentSettings,
    defaultProvider:     getById('default-provider').value,
    defaultDiagramType:  getById('default-type').value,
    defaultColorPalette: getById('default-palette').value,
    defaultComplexity:   getById('default-complexity').value,
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
    if (configured) setStatus(provider, 'ok', 'configured');
    else            setStatus(provider, '',   'unset');
  });

  setSelect('default-provider',   currentSettings.defaultProvider);
  setSelect('default-type',       currentSettings.defaultDiagramType);
  setSelect('default-palette',    currentSettings.defaultColorPalette);
  setSelect('default-complexity', currentSettings.defaultComplexity);
}

function setStatus(provider, state, text) {
  const el = getById(`status-${provider}`);
  if (!el) return;
  el.className = 'status' + (state ? ' ' + state : '');
  el.textContent = text;
}

function setSelect(id, value) {
  const el = getById(id);
  if (el) el.value = value || '';
}
