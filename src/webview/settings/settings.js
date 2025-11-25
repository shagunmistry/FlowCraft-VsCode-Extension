import { postMessage, onMessage } from '../shared/utils/messaging.js';
import { getById, queryAll } from '../shared/utils/dom.js';

let currentSettings = {};
let currentProviders = {};

document.addEventListener('DOMContentLoaded', () => {
  // Load initial settings
  postMessage('loadSettings');

  // Setup interactions
  setupEventListeners();

  // Message handler
  onMessage({
    updateSettings: (data) => {
      currentSettings = data.settings;
      currentProviders = data.providers;
      renderSettings();
    },
    connectionResult: (data) => {
      const statusEl = getById(`status-${data.provider}`);
      if (statusEl) {
        statusEl.textContent = data.message;
        // Reset class then add specific color
        statusEl.className = 'form-helper';
        if (data.success) {
            statusEl.textContent = 'Connection Verified';
            statusEl.style.color = 'var(--color-success)'; // using style directly or class if defined
        } else {
            statusEl.style.color = 'var(--color-error)';
        }
      }
      
      // Re-enable button
      const btn = getById(`test-${data.provider}`);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'Test Connection';
      }
    }
  });
});

function setupEventListeners() {
  // Test connection buttons
  queryAll('[id^="test-"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const provider = btn.id.replace('test-', '');
      const input = getById(`key-${provider}`);
      const apiKey = input.value;

      if (!apiKey) {
        const statusEl = getById(`status-${provider}`);
        statusEl.textContent = 'Enter an API key first';
        statusEl.style.color = 'var(--color-error)';
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<div class="spinner" style="width: 12px; height: 12px; border-width: 2px;"></div> Checking...';
      
      postMessage('testConnection', {
        provider,
        apiKey
      });
    });
  });

  // Save button
  getById('save-btn')?.addEventListener('click', () => {
    const btn = getById('save-btn');
    const originalText = btn.textContent;
    btn.textContent = 'Saving...';
    btn.disabled = true;
    
    saveAllSettings();
    
    setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
    }, 1000);
  });

  // Reset button
  getById('reset-btn')?.addEventListener('click', () => {
    if(confirm('Reset all settings to default?')) {
        postMessage('resetSettings');
    }
  });
}

function renderSettings() {
  if (!currentSettings) return;

  // Update status text based on configured providers
  Object.entries(currentProviders).forEach(([provider, configured]) => {
    const statusEl = getById(`status-${provider}`);
    if (statusEl) {
        if (configured) {
            statusEl.textContent = 'Configured';
            statusEl.style.color = 'var(--color-success)'; // Green for configured
        } else {
            statusEl.textContent = 'Not Configured';
            statusEl.style.color = 'var(--color-text-secondary)';
        }
    }
  });

  // General Settings
  setSelectValue('default-provider', currentSettings.defaultProvider);
  setSelectValue('default-type', currentSettings.defaultDiagramType);
  setSelectValue('default-palette', currentSettings.defaultColorPalette);
  setSelectValue('default-complexity', currentSettings.defaultComplexity);
}

function setSelectValue(id, value) {
  const el = getById(id);
  if (el) el.value = value || '';
}

function saveAllSettings() {
  const newSettings = { ...currentSettings };
  
  // Get values from form
  newSettings.defaultProvider = getById('default-provider').value;
  newSettings.defaultDiagramType = getById('default-type').value;
  newSettings.defaultColorPalette = getById('default-palette').value;
  newSettings.defaultComplexity = getById('default-complexity').value;

  // Get API keys
  const apiKeys = {};
  const providers = ['openai', 'anthropic', 'google', 'flowcraft'];
  
  providers.forEach(provider => {
    const input = getById(`key-${provider}`);
    // Only update if value is present (empty fields might mean "keep existing" or "clear" depends on backend)
    // Assuming backend handles empty string as "don't update" or we send all. 
    // If user allows clearing, we might need a clearer UI for "Clear Key".
    // For now, send if value exists.
    if (input && input.value) {
      apiKeys[provider] = input.value;
    }
  });

  postMessage('saveSettings', {
    settings: newSettings,
    apiKeys
  });
}
