import { postMessage, onMessage } from '../shared/utils/messaging.js';
import { getById, queryAll } from '../shared/utils/dom.js';

const PROVIDERS = ['openrouter'];

// Suggested OpenRouter slugs — mirrors PROVIDER_INFO in src/types/api.ts.
// Any slug is accepted; keep in sync when the TypeScript list changes.
const MODEL_SUGGESTIONS = [
  'anthropic/claude-sonnet-5.5',
  'anthropic/claude-opus-5.5',
  'anthropic/claude-haiku-5.5',
  'openai/gpt-6.1-sol',
  'google/gemini-3.8-flash'
];
const MODEL_SLUG_RE = /^[\w.-]+\/[\w.:-]+$/;

let currentSettings = {};
let currentProviders = {};
let keysRevealed = false;

// Mirror of validateKeyFormat() in src/utils/provider-links.ts — the TS util is
// the unit-tested source of truth; this copy exists only because webview JS
// cannot import TS modules. Keep the two in sync.
function validateKeyFormat(provider, key) {
  const k = (key || '').trim();
  switch (provider) {
    case 'openrouter':
      return k.startsWith('sk-or-');
    default:
      return k.length > 10;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  postMessage('loadSettings');
  wire();

  onMessage({
    updateSettings: ({ settings, providers, account }) => {
      currentSettings = settings;
      currentProviders = providers;
      if (account) renderAccount(account);
      render();
    },
    accountUpdated: (account) => renderAccount(account),
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

  // Inline key-format validation: as the user types, toggle a pass/fail
  // indicator on the provider's status label (mirrors validateKeyFormat).
  PROVIDERS.forEach(p => {
    const input = getById(`key-${p}`);
    if (!input) return;
    input.addEventListener('input', () => {
      const val = input.value || '';
      if (!val) {
        // Empty: fall back to connection state (don't show a format error).
        const configured = !!(currentProviders && currentProviders[p]);
        setStatus(p, configured ? 'ok' : '', configured ? 'Connected' : 'Not connected');
        input.classList.remove('valid', 'invalid');
        return;
      }
      const ok = validateKeyFormat(p, val);
      input.classList.toggle('valid', ok);
      input.classList.toggle('invalid', !ok);
      setStatus(p, ok ? 'ok' : 'err', ok ? 'Looks valid' : 'Unexpected format');
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

  // Account: sign-in / sign-out / premium delegate to the extension commands.
  getById('account-signin')?.addEventListener('click', () => postMessage('signIn'));
  getById('account-signout')?.addEventListener('click', () => postMessage('signOut'));
  getById('account-upgrade')?.addEventListener('click', () => postMessage('upgrade'));
  getById('account-manage')?.addEventListener('click', () => postMessage('manageSubscription'));

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

  const providerModels = {};
  const modelInput = getById('model-openrouter');
  const model = modelInput ? modelInput.value.trim() : '';
  if (model) {
    if (!MODEL_SLUG_RE.test(model)) {
      const foot = getById('foot-status');
      if (foot) { foot.textContent = 'Model must look like provider/model-name'; foot.className = 'st-foot-status err'; }
      if (btn) { btn.disabled = false; btn.textContent = 'Save changes'; }
      return;
    }
    providerModels.openrouter = model;
  }

  const newSettings = {
    ...currentSettings,
    defaultProvider:     'openrouter',
    defaultDiagramType:  getById('default-type').value,
    defaultColorPalette: getById('default-palette').value,
    defaultComplexity:   getById('default-complexity').value,
    telemetryEnabled:    getById('telemetry-enabled') ? getById('telemetry-enabled').checked : true,
    providerModels
  };

  const apiKeys = {};
  PROVIDERS.forEach(p => {
    const input = getById(`key-${p}`);
    if (input && input.value) apiKeys[p] = input.value;
  });

  postMessage('saveSettings', { settings: newSettings, apiKeys });
}

function renderAccount(account) {
  const block   = getById('account-block');
  const status  = getById('account-status');
  const email   = getById('account-email');
  const inBtn   = getById('account-signin');
  const outBtn  = getById('account-signout');
  const upBtn   = getById('account-upgrade');
  const mgBtn   = getById('account-manage');
  const badge   = getById('account-plan-badge');
  if (!status) return;
  const signedIn   = !!(account && account.signedIn);
  const subscribed = !!(account && account.subscribed);
  if (block) block.classList.toggle('signed-in', signedIn);
  if (signedIn) {
    status.textContent = 'Signed in';
    if (email) email.textContent = account.email || '';
    if (inBtn) inBtn.hidden = true;
    if (outBtn) outBtn.hidden = false;
    // Premium: show plan badge + Upgrade (free) or Manage (subscribed).
    if (badge) {
      badge.hidden = false;
      badge.textContent = subscribed ? (planLabel(account.plan) || 'Premium') : 'Free';
      badge.classList.toggle('st-badge-premium', subscribed);
    }
    if (upBtn) upBtn.hidden = subscribed;
    if (mgBtn) mgBtn.hidden = !subscribed;
  } else {
    status.textContent = 'Signed out';
    if (email) email.textContent = '';
    if (inBtn) inBtn.hidden = false;
    if (outBtn) outBtn.hidden = true;
    if (upBtn) upBtn.hidden = true;
    if (mgBtn) mgBtn.hidden = true;
    if (badge) badge.hidden = true;
  }
}

function planLabel(plan) {
  if (!plan || typeof plan !== 'string') return '';
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

function render() {
  if (!currentSettings) return;

  Object.entries(currentProviders || {}).forEach(([provider, configured]) => {
    if (configured) setStatus(provider, 'ok', 'Connected');
    else            setStatus(provider, '',   'Not connected');
  });

  setSelect('default-type',       currentSettings.defaultDiagramType);
  setSelect('default-palette',    currentSettings.defaultColorPalette);
  setSelect('default-complexity', currentSettings.defaultComplexity);

  const telEl = getById('telemetry-enabled');
  if (telEl) telEl.checked = currentSettings.telemetryEnabled !== false;

  renderModelSelects();
}

function renderModelSelects() {
  const list = getById('model-suggestions');
  if (list && !list.children.length) {
    MODEL_SUGGESTIONS.forEach(m => {
      const o = document.createElement('option');
      o.value = m;
      list.appendChild(o);
    });
  }
  const input = getById('model-openrouter');
  if (input) input.value = (currentSettings.providerModels || {}).openrouter || '';
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
